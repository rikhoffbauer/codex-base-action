#!/usr/bin/env bun

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  spyOn,
} from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, readFile, rm, writeFile, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import * as core from "@actions/core";
import { setupCodexAuth } from "../src/setup-codex-auth";

function uniqueHomeDir() {
  return join(tmpdir(), "codex-auth-tests", Date.now().toString(), Math.random().toString(36).slice(2));
}

describe("setupCodexAuth", () => {
  let homeDir: string;
  let setSecretSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    homeDir = uniqueHomeDir();
    await mkdir(homeDir, { recursive: true });
    setSecretSpy = spyOn(core, "setSecret").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    setSecretSpy.mockRestore();
    await rm(homeDir, { recursive: true, force: true });
  });

  test("skips setup when no auth input is provided", async () => {
    await setupCodexAuth(undefined, homeDir);

    await expect(
      access(join(homeDir, ".codex", "auth.json"), fsConstants.F_OK),
    ).rejects.toBeDefined();
    expect(setSecretSpy).not.toHaveBeenCalled();
  });

  test("writes auth.json when inline JSON is provided", async () => {
    const authJson = JSON.stringify({ session: "token" });

    await setupCodexAuth(authJson, homeDir);

    const written = await readFile(join(homeDir, ".codex", "auth.json"), "utf-8");
    expect(JSON.parse(written)).toEqual({ session: "token" });
    expect(setSecretSpy).toHaveBeenCalledWith(authJson);
  });

  test("loads auth.json from a file path input", async () => {
    const sourceDir = join(homeDir, "source");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "auth.json");
    const authJson = `${JSON.stringify({ refresh: "value" })}`;
    await writeFile(sourcePath, authJson);

    await setupCodexAuth(sourcePath, homeDir);

    const written = await readFile(join(homeDir, ".codex", "auth.json"), "utf-8");
    expect(JSON.parse(written)).toEqual({ refresh: "value" });
    expect(setSecretSpy).toHaveBeenCalledWith(authJson);
  });

  test("throws when file path cannot be read", async () => {
    await expect(setupCodexAuth("/not/a/real/path.json", homeDir)).rejects.toThrow(
      "Failed to read ChatGPT auth file",
    );
  });

  test("throws when provided file is not valid JSON", async () => {
    const sourceDir = join(homeDir, "bad");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "auth.json");
    await writeFile(sourcePath, "not-json");

    await expect(setupCodexAuth(sourcePath, homeDir)).rejects.toThrow(
      "does not contain valid JSON",
    );
  });
});
