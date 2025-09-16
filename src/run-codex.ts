import * as core from "@actions/core";
import { spawn } from "child_process";
import { createReadStream } from "fs";
import { stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { parse as parseShellArgs } from "shell-quote";

const RUNNER_TEMP = process.env.RUNNER_TEMP || tmpdir();
export const EXECUTION_FILE = `${RUNNER_TEMP}/codex-execution-output.json`;

export type CodexOptions = {
  codexArgs?: string;
  openaiApiKey?: string | undefined;
  pathToCodexExecutable?: string | undefined;
};

type PreparedConfig = {
  codexArgs: string[];
  promptPath: string;
  env: Record<string, string>;
  executionFile: string;
};

function hasArgument(args: string[], flag: string): boolean {
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

export function prepareRunConfig(
  promptPath: string,
  options: CodexOptions,
): PreparedConfig {
  const codexArgs: string[] = ["exec"];

  if (options.codexArgs?.trim()) {
    const parsed = parseShellArgs(options.codexArgs);
    const customArgs = parsed.filter(
      (arg): arg is string => typeof arg === "string",
    );
    codexArgs.push(...customArgs);
  }

  if (!hasArgument(codexArgs, "--json")) {
    codexArgs.push("--json");
  }

  // Always read the prompt from stdin so that we can supply the prepared file
  if (!codexArgs.includes("-")) {
    codexArgs.push("-");
  }

  const customEnv: Record<string, string> = {};

  if (process.env.INPUT_ACTION_INPUTS_PRESENT) {
    customEnv.GITHUB_ACTION_INPUTS = process.env.INPUT_ACTION_INPUTS_PRESENT;
  }

  return {
    codexArgs,
    promptPath,
    env: customEnv,
    executionFile: EXECUTION_FILE,
  };
}

async function ensureCodexLogin(
  executable: string,
  env: Record<string, string>,
  openaiApiKey: string,
) {
  if (!openaiApiKey.trim()) {
    return;
  }

  const loginProcess = spawn(
    executable,
    ["login", "--api-key", openaiApiKey],
    {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    },
  );

  await new Promise<void>((resolve, reject) => {
    loginProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn codex login: ${error}`));
    });

    loginProcess.stderr.on("data", (data) => {
      const message = data.toString();
      // Surface any login warnings or errors for visibility
      if (message.trim()) {
        console.error(message.trim());
      }
    });

    loginProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`codex login failed with exit code ${code}`));
      }
    });
  });
}

export async function runCodex(promptPath: string, options: CodexOptions) {
  const config = prepareRunConfig(promptPath, options);

  const codexExecutable = options.pathToCodexExecutable || "codex";

  if (options.openaiApiKey?.trim()) {
    await ensureCodexLogin(codexExecutable, config.env, options.openaiApiKey);
  }

  let promptSize = "unknown";
  try {
    const stats = await stat(config.promptPath);
    promptSize = stats.size.toString();
  } catch (error) {
    // Ignore errors when reading prompt size; continue execution
  }

  console.log(`Prompt file size: ${promptSize} bytes`);

  if (options.codexArgs && options.codexArgs.trim() !== "") {
    console.log(`Custom Codex arguments: ${options.codexArgs}`);
  }

  console.log(`Running Codex with prompt from file: ${config.promptPath}`);
  console.log(`Full command: ${codexExecutable} ${config.codexArgs.join(" ")}`);

  const events: unknown[] = [];
  let buffer = "";

  const codexProcess = spawn(codexExecutable, config.codexArgs, {
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      ...config.env,
    },
  });

  codexProcess.on("error", (error) => {
    console.error("Error spawning Codex process:", error);
  });

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      events.push(parsed);
      process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    } catch (error) {
      events.push({ type: "text", value: trimmed });
      process.stdout.write(`${trimmed}\n`);
    }
  };

  const flushBuffer = (isFinal = false) => {
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleLine(line);
      newlineIndex = buffer.indexOf("\n");
    }

    if (isFinal && buffer.length > 0) {
      handleLine(buffer);
      buffer = "";
    }
  };

  codexProcess.stdout.on("data", (data) => {
    buffer += data.toString();
    flushBuffer(false);
  });

  codexProcess.stdout.on("error", (error) => {
    console.error("Error reading Codex stdout:", error);
  });

  const promptStream = createReadStream(config.promptPath);
  promptStream.pipe(codexProcess.stdin);

  promptStream.on("error", (error) => {
    console.error("Error reading prompt file:", error);
    codexProcess.stdin.end();
  });

  const exitCode = await new Promise<number>((resolve) => {
    codexProcess.on("close", (code) => {
      flushBuffer(true);
      resolve(code ?? 0);
    });

    codexProcess.on("error", () => {
      flushBuffer(true);
      resolve(1);
    });
  });

  try {
    await writeFile(config.executionFile, `${JSON.stringify(events, null, 2)}\n`);
    console.log(`Log saved to ${config.executionFile}`);
    core.setOutput("execution_file", config.executionFile);
  } catch (error) {
    core.warning(`Failed to write execution log: ${error}`);
  }

  if (exitCode === 0) {
    core.setOutput("conclusion", "success");
  } else {
    core.setOutput("conclusion", "failure");
    throw new Error(`Codex CLI process exited with code ${exitCode}`);
  }
}
