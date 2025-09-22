import * as core from "@actions/core";
import { mkdir, readFile, writeFile, chmod } from "fs/promises";
import { homedir } from "os";

/**
 * Returns true if the given string is valid JSON.
 *
 * Attempts to parse `content` with JSON.parse and returns `true` on success, `false` if parsing throws.
 *
 * @param content - The string to validate as JSON.
 * @returns Whether `content` is valid JSON text.
 */
function isJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Prepare and persist Codex (ChatGPT) authentication JSON to the user's ~/.codex/auth.json.
 *
 * If `authInput` is a JSON string it is used directly; otherwise `authInput` is treated as a file path
 * and the file is read and validated as JSON. The function creates the target directory if needed,
 * writes the JSON (ensuring a trailing newline) to `~/.codex/auth.json`, and marks the secret so it
 * is masked in CI logs.
 *
 * @param authInput - Either a JSON string containing the auth data or a path to a file that contains JSON. If omitted or blank, the function returns without making changes.
 * @param homeDir - Optional override of the home directory used to resolve the target path (defaults to the current user's home directory).
 * @returns A promise that resolves once the auth file has been written (or immediately if `authInput` is blank).
 * @throws Error If a provided file path cannot be read or if the resulting content is not valid JSON.
 */
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
