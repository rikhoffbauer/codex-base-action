#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupCodexConfig } from "../src/setup-codex-config";
import { parse as parseToml } from "@iarna/toml";
import { tmpdir } from "os";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";

const testHomeDir = join(tmpdir(), "codex-cli-test-home", Date.now().toString());
const configPath = join(testHomeDir, ".codex", "config.toml");
const testConfigDir = join(testHomeDir, "codex-config-source");
const testConfigPath = join(testConfigDir, "config.toml");

describe("setupCodexConfig", () => {
  beforeEach(async () => {
    await mkdir(testHomeDir, { recursive: true });
    await mkdir(testConfigDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testHomeDir, { recursive: true, force: true });
  });

  test("should create an empty config when no input is provided", async () => {
    await setupCodexConfig(undefined, testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config).toEqual({});
  });

  test("should merge config from TOML string input", async () => {
    const inputConfig = `model = "o4-mini"
[sandbox]
mode = "workspace-write"
`;

    await setupCodexConfig(inputConfig, testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config.model).toBe("o4-mini");
    expect(config.sandbox).toEqual({ mode: "workspace-write" });
  });

  test("should merge config from TOML file path input", async () => {
    const fileConfig = `
[profiles.default]
model = "o3"
`; 
    await writeFile(testConfigPath, fileConfig);

    await setupCodexConfig(testConfigPath, testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config).toEqual({
      profiles: {
        default: {
          model: "o3",
        },
      },
    });
  });

  test("should throw error for invalid TOML string", () => {
    expect(() => setupCodexConfig("invalid = {", testHomeDir)).toThrow();
  });

  test("should throw error for non-existent file path", () => {
    expect(() => setupCodexConfig("/non/existent/config.toml", testHomeDir)).toThrow();
  });

  test("should ignore empty string input", async () => {
    await setupCodexConfig("", testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config).toEqual({});
  });

  test("should ignore whitespace-only input", async () => {
    await setupCodexConfig("   \n\t  ", testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config).toEqual({});
  });

  test("should merge with existing config", async () => {
    const baseConfig = `
[profiles.default]
sandbox = "read-only"
`;
    const overrideConfig = `
[profiles.default]
model = "o4"
`;

    await setupCodexConfig(baseConfig, testHomeDir);
    await setupCodexConfig(overrideConfig, testHomeDir);

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;

    expect(config).toEqual({
      profiles: {
        default: {
          sandbox: "read-only",
          model: "o4",
        },
      },
    });
  });
});
