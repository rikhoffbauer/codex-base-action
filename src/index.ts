#!/usr/bin/env bun

import * as core from "@actions/core";
import { preparePrompt } from "./prepare-prompt";
import { runCodex } from "./run-codex";
import { setupCodexAuth } from "./setup-codex-auth";
import { setupCodexConfig } from "./setup-codex-config";
import { validateEnvironmentVariables } from "./validate-env";

/**
 * Main entrypoint: validates environment, configures Codex, prepares the prompt, and runs Codex.
 *
 * This async routine performs the full action flow:
 * 1. Validates required environment variables.
 * 2. Loads Codex configuration and authentication from INPUT_CONFIG and INPUT_CHATGPT_AUTH_JSON.
 * 3. Prepares a prompt from INPUT_PROMPT / INPUT_PROMPT_FILE and obtains a prompt file path.
 * 4. Executes Codex with the prepared prompt, passing INPUT_CODEX_ARGS, OPENAI_API_KEY, and INPUT_PATH_TO_CODEX_EXECUTABLE.
 *
 * On error the function reports failure to the GitHub Actions runtime (via `core.setFailed` and `core.setOutput`)
 * and terminates the process with exit code 1.
 *
 * Environment variables used:
 * - INPUT_CONFIG
 * - INPUT_CHATGPT_AUTH_JSON
 * - INPUT_PROMPT
 * - INPUT_PROMPT_FILE
 * - INPUT_CODEX_ARGS
 * - OPENAI_API_KEY
 * - INPUT_PATH_TO_CODEX_EXECUTABLE
 *
 * @returns A promise that resolves when the action completes (or rejects/terminates on unhandled error).
 */
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
