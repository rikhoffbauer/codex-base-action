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

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      core.setSecret(openaiApiKey);
      const trimmedKey = openaiApiKey.trim();
      if (trimmedKey && trimmedKey !== openaiApiKey) {
        core.setSecret(trimmedKey);
      }
    }

    await setupCodexConfig(
      process.env.INPUT_CONFIG,
      undefined, // homeDir
    );

    try {
      await setupCodexAuth(
        process.env.INPUT_CHATGPT_AUTH_JSON,
        undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Authentication setup failed: ${message}`);
    }

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
