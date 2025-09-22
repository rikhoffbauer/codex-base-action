import { existsSync, statSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import os from "node:os";
import path from "node:path";

export type PreparePromptInput = {
  prompt: string;
  promptFile: string;
};

export type PreparePromptConfig = {
  type: "file" | "inline";
  path: string;
};

/**
 * Validate provided prompt inputs and produce a PreparePromptConfig describing how the prompt should be provided.
 *
 * If `input.promptFile` is supplied the function ensures the file exists and is non-empty, then returns
 * `{ type: "file", path: input.promptFile }`. If an inline `input.prompt` is supplied and non-empty, the function
 * returns `{ type: "inline", path: "/tmp/codex-action/prompt.txt" }`.
 *
 * @param input - Object containing either `prompt` (inline prompt text) or `promptFile` (path to an existing prompt file). Exactly one must be provided.
 * @returns A PreparePromptConfig indicating `type` ("file" | "inline") and the filesystem `path` to the prompt.
 * @throws Error when neither or both inputs are provided:
 *   - "Neither 'prompt' nor 'prompt_file' was provided. At least one is required."
 *   - "Both 'prompt' and 'prompt_file' were provided. Please specify only one."
 * @throws Error when `promptFile` is provided but the file does not exist:
 *   - "Prompt file '<path>' does not exist."
 * @throws Error when `promptFile` exists but is empty:
 *   - "Prompt file is empty. Please provide a non-empty prompt."
 * @throws Error when an inline `prompt` is missing or only whitespace:
 *   - "Prompt is empty. Please provide a non-empty prompt."
 */
async function validateAndPreparePrompt(
  input: PreparePromptInput,
): Promise<PreparePromptConfig> {
  // Validate inputs
  if (!input.prompt && !input.promptFile) {
    throw new Error(
      "Neither 'prompt' nor 'prompt_file' was provided. At least one is required.",
    );
  }

  if (input.prompt && input.promptFile) {
    throw new Error(
      "Both 'prompt' and 'prompt_file' were provided. Please specify only one.",
    );
  }

  // Handle prompt file
  if (input.promptFile) {
    if (!existsSync(input.promptFile)) {
      throw new Error(`Prompt file '${input.promptFile}' does not exist.`);
    }

    // Validate that the file is not empty
    const stats = statSync(input.promptFile);
    if (stats.size === 0) {
      throw new Error(
        "Prompt file is empty. Please provide a non-empty prompt.",
      );
    }

    return {
      type: "file",
      path: input.promptFile,
    };
  }

  // Handle inline prompt
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new Error("Prompt is empty. Please provide a non-empty prompt.");
  }

  const baseTmp = process.env.RUNNER_TEMP?.trim() || os.tmpdir();
  const inlinePath = path.join(baseTmp, "codex-action", "prompt.txt");
  return {
    type: "inline",
    path: inlinePath,
  };
}

async function createTemporaryPromptFile(
  prompt: string,
  promptPath: string,
): Promise<void> {
  // Create the directory path
  await mkdir(path.dirname(promptPath), { recursive: true });
  await writeFile(promptPath, prompt);
}

export async function preparePrompt(
  input: PreparePromptInput,
): Promise<PreparePromptConfig> {
  const config = await validateAndPreparePrompt(input);

  if (config.type === "inline") {
    await createTemporaryPromptFile(input.prompt, config.path);
  }

  return config;
}
