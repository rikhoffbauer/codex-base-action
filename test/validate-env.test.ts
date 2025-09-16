#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { validateEnvironmentVariables } from "../src/validate-env";

describe("validateEnvironmentVariables", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.INPUT_CHATGPT_AUTH_JSON;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should pass when OPENAI_API_KEY is provided", () => {
    process.env.OPENAI_API_KEY = "sk-test";

    expect(() => validateEnvironmentVariables()).not.toThrow();
  });

  test("should pass when ChatGPT auth JSON is provided", () => {
    process.env.INPUT_CHATGPT_AUTH_JSON = '{"session":"token"}';

    expect(() => validateEnvironmentVariables()).not.toThrow();
  });

  test("should pass when ChatGPT auth path is provided", () => {
    process.env.INPUT_CHATGPT_AUTH_JSON = "/tmp/auth.json";

    expect(() => validateEnvironmentVariables()).not.toThrow();
  });

  test("should fail when credentials are missing", () => {
    expect(() => validateEnvironmentVariables()).toThrow(
      "Provide either OPENAI_API_KEY or chatgpt_auth_json to authenticate Codex CLI.",
    );
  });

  test("should fail when OPENAI_API_KEY is empty", () => {
    process.env.OPENAI_API_KEY = "   ";

    expect(() => validateEnvironmentVariables()).toThrow(
      "Provide either OPENAI_API_KEY or chatgpt_auth_json to authenticate Codex CLI.",
    );
  });
});
