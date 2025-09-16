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

/**
 * Checks whether a command-line flag is present in an argument list.
 *
 * The function returns true if any element of `args` is exactly `flag`
 * or begins with `flag=` (to cover `--option=value` style).
 *
 * @param args - Array of command-line arguments to search.
 * @param flag - Flag to look for (e.g., `"--json"` or `"--option"`).
 * @returns True if `flag` is present exactly or as a `flag=...` prefixed argument.
 */
function hasArgument(args: string[], flag: string): boolean {
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

/**
 * Prepare the configuration needed to run the Codex CLI for a given prompt file.
 *
 * Builds the argument list for `codex` (starting with `exec`), appends any
 * user-provided shell-parsed `options.codexArgs`, ensures `--json` is present,
 * and ensures stdin is used (`-`) so the prompt file can be piped in.
 *
 * The returned config also includes a minimal custom environment that copies
 * `INPUT_ACTION_INPUTS_PRESENT` from the process environment to
 * `GITHUB_ACTION_INPUTS` when present, and the path where execution events
 * should be written (EXECUTION_FILE).
 *
 * @param promptPath - Filesystem path to the prepared prompt that will be piped to codex stdin.
 * @param options - Optional runner options; if `options.codexArgs` is provided it is parsed as shell args and merged.
 * @returns A PreparedConfig containing:
 *  - codexArgs: finalized argv array to pass to the codex executable,
 *  - promptPath: the provided promptPath,
 *  - env: custom environment variables to merge into the process environment,
 *  - executionFile: path to the JSON file where execution events will be recorded.
 */
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

/**
 * Ensure the Codex CLI is logged in using the provided OpenAI API key.
 *
 * If `openaiApiKey` is empty or only whitespace, this function returns immediately.
 * Otherwise it spawns `executable login --api-key <key>` with `env` merged into
 * `process.env` and resolves when the login process exits with code `0`.
 *
 * @param executable - Path or command name of the Codex CLI to invoke for login
 * @param env - Environment variables to merge with `process.env` for the spawned process
 * @param openaiApiKey - OpenAI API key to supply to the CLI; blank value skips login
 * @returns A promise that resolves when the login completes successfully
 * @throws Error if the process cannot be spawned or if the login process exits with a non-zero code
 */
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

/**
 * Run the Codex CLI with a prompt file, collect its JSON/text output events, and persist results for GitHub Actions.
 *
 * This function prepares the Codex command, optionally logs in with an OpenAI API key, streams the given prompt file
 * to the Codex process stdin, and reads stdout line-by-line. Lines that parse as JSON are recorded as structured events;
 * other lines are recorded as text events. All gathered events are written to the configured execution file, and
 * GitHub Actions outputs `execution_file` (path to the log) and `conclusion` (`success` or `failure`) are set. If the
 * Codex process exits with a non-zero code the function throws an Error.
 *
 * @param promptPath - Filesystem path to the prompt file that will be piped to Codex stdin.
 * @param options - Runtime options (e.g., extra Codex arguments, OpenAI API key, or an alternate Codex executable).
 * @returns A promise that resolves when the run completes successfully, or rejects if Codex exits with a non-zero code.
 */
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
