import * as core from "@actions/core";
import { mkdir, readFile, writeFile, chmod } from "fs/promises";
import { homedir } from "os";

function isJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch (error) {
    return false;
  }
}

export async function setupCodexAuth(
  authInput?: string,
  homeDir?: string,
) {
  if (!authInput || authInput.trim().length === 0) {
    console.log("No ChatGPT auth provided. Skipping Codex auth setup.");
    return;
  }

  const home = homeDir ?? homedir();
  const authDir = `${home}/.codex`;
  const authPath = `${authDir}/auth.json`;

  await mkdir(authDir, { recursive: true });

  let authContent = authInput;

  if (isJson(authContent)) {
    console.log("Received ChatGPT auth JSON from workflow input.");
  } else {
    const trimmedPath = authInput.trim();
    console.log(`Loading ChatGPT auth from file: ${trimmedPath}`);
    try {
      authContent = await readFile(trimmedPath, "utf-8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read ChatGPT auth file at ${trimmedPath}: ${reason}`,
      );
    }

    if (!isJson(authContent)) {
      throw new Error(
        `ChatGPT auth file at ${trimmedPath} does not contain valid JSON.`,
      );
    }
  }

  core.setSecret(authContent);

  const output = authContent.endsWith("\n")
    ? authContent
    : `${authContent}\n`;

  await writeFile(authPath, output, { mode: 0o600 });
  await chmod(authPath, 0o600);
  console.log(`Codex auth saved to ${authPath}`);
}
