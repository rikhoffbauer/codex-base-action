#!/usr/bin/env bun

import * as core from "@actions/core";
import { preparePrompt } from "./prepare-prompt";
import { runCodex } from "./run-codex";
import { setupCodexAuth } from "./setup-codex-auth";
import { setupCodexConfig } from "./setup-codex-config";
import { validateEnvironmentVariables } from "./validate-env";

async function run() {
  try {
    validateEnvironmentVariables();

    await setupCodexConfig(
      process.env.INPUT_CONFIG,
      undefined, // homeDir
    );

    await setupCodexAuth(
      process.env.INPUT_CHATGPT_AUTH_JSON,
      undefined,
    );

    const promptConfig = await preparePrompt({
      prompt: process.env.INPUT_PROMPT || "",
      promptFile: process.env.INPUT_PROMPT_FILE || "",
    });

    await runCodex(promptConfig.path, {
      codexArgs: process.env.INPUT_CODEX_ARGS,
      openaiApiKey: process.env.OPENAI_API_KEY,
      pathToCodexExecutable: process.env.INPUT_PATH_TO_CODEX_EXECUTABLE,
    });
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
