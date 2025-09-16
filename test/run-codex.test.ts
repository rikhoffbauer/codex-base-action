#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  EXECUTION_FILE,
  prepareRunConfig,
  type CodexOptions,
} from "../src/run-codex";

describe("prepareRunConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.INPUT_ACTION_INPUTS_PRESENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("should prepare config with basic arguments", () => {
    const options: CodexOptions = {};
    const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

    expect(prepared.codexArgs).toEqual(["exec", "--json", "-"]);
  });

  test("should include promptPath", () => {
    const options: CodexOptions = {};
    const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

    expect(prepared.promptPath).toBe("/tmp/test-prompt.txt");
  });

  test("should use provided prompt path", () => {
    const options: CodexOptions = {};
    const prepared = prepareRunConfig("/custom/prompt/path.txt", options);

    expect(prepared.promptPath).toBe("/custom/prompt/path.txt");
  });

  test("should expose the execution file path", () => {
    const options: CodexOptions = {};
    const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

    expect(prepared.executionFile).toBe(EXECUTION_FILE);
  });

  describe("codexArgs handling", () => {
    test("should parse and include custom codex arguments", () => {
      const options: CodexOptions = {
        codexArgs: "--full-auto --model o3-mini",
      };
      const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

      expect(prepared.codexArgs).toEqual([
        "exec",
        "--full-auto",
        "--model",
        "o3-mini",
        "--json",
        "-",
      ]);
    });

    test("should handle empty codexArgs", () => {
      const options: CodexOptions = {
        codexArgs: "",
      };
      const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

      expect(prepared.codexArgs).toEqual(["exec", "--json", "-"]);
    });

    test("should handle codexArgs with quoted strings", () => {
      const options: CodexOptions = {
        codexArgs: '--sandbox "workspace-write"',
      };
      const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

      expect(prepared.codexArgs).toEqual([
        "exec",
        "--sandbox",
        "workspace-write",
        "--json",
        "-",
      ]);
    });

    test("should avoid duplicating --json when provided", () => {
      const options: CodexOptions = {
        codexArgs: "--json --color never",
      };
      const prepared = prepareRunConfig("/tmp/test-prompt.txt", options);

      expect(prepared.codexArgs).toEqual([
        "exec",
        "--json",
        "--color",
        "never",
        "-",
      ]);
    });
  });
});
