#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { preparePrompt, type PreparePromptInput } from "../src/prepare-prompt";
import { unlink, writeFile, readFile, stat } from "fs/promises";
import os from "node:os";
import path from "node:path";

describe("preparePrompt integration tests", () => {
  const promptPath = () => {
    const baseTmp = process.env.RUNNER_TEMP?.trim() ?? os.tmpdir();
    return path.join(baseTmp, "codex-action", "prompt.txt");
  };

  beforeEach(async () => {
    try {
      await unlink(promptPath());
    } catch {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    try {
      await unlink(promptPath());
    } catch {
      // Ignore if file doesn't exist
    }
  });

  test("should create temporary prompt file when only prompt is provided", async () => {
    const input: PreparePromptInput = {
      prompt: "This is a test prompt",
      promptFile: "",
    };

    const config = await preparePrompt(input);

    expect(config.path).toBe(promptPath());
    expect(config.type).toBe("inline");

    const fileContent = await readFile(config.path, "utf-8");
    expect(fileContent).toBe("This is a test prompt");

    const fileStat = await stat(config.path);
    expect(fileStat.size).toBeGreaterThan(0);
  });

  test("should use existing file when promptFile is provided", async () => {
    const testFilePath = path.join(os.tmpdir(), "test-prompt.txt");
    await writeFile(testFilePath, "Prompt from file");

    const input: PreparePromptInput = {
      prompt: "",
      promptFile: testFilePath,
    };

    const config = await preparePrompt(input);

    expect(config.path).toBe(testFilePath);
    expect(config.type).toBe("file");

    await unlink(testFilePath);
  });

  test("should fail when neither prompt nor promptFile is provided", async () => {
    const input: PreparePromptInput = {
      prompt: "",
      promptFile: "",
    };

    await expect(preparePrompt(input)).rejects.toThrow(
      "Neither 'prompt' nor 'prompt_file' was provided",
    );
  });

  test("should fail when promptFile points to non-existent file", async () => {
    const missingPath = path.join(os.tmpdir(), "non-existent-file.txt");
    const input: PreparePromptInput = {
      prompt: "",
      promptFile: missingPath,
    };

    await expect(preparePrompt(input)).rejects.toThrow(
      `Prompt file '${missingPath}' does not exist.`,
    );
  });

  test("should fail when prompt is empty", async () => {
    const emptyFilePath = path.join(os.tmpdir(), "empty-prompt.txt");
    await writeFile(emptyFilePath, "");

    const input: PreparePromptInput = {
      prompt: "",
      promptFile: emptyFilePath,
    };

    await expect(preparePrompt(input)).rejects.toThrow("Prompt file is empty");

    try {
      await unlink(emptyFilePath);
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should fail when both prompt and promptFile are provided", async () => {
    const testFilePath = path.join(os.tmpdir(), "test-prompt.txt");
    await writeFile(testFilePath, "Prompt from file");

    const input: PreparePromptInput = {
      prompt: "This should cause an error",
      promptFile: testFilePath,
    };

    await expect(preparePrompt(input)).rejects.toThrow(
      "Both 'prompt' and 'prompt_file' were provided. Please specify only one.",
    );

    await unlink(testFilePath);
  });
});
