/**
 * Ensures required authentication environment variables for Codex CLI are present.
 *
 * Checks `OPENAI_API_KEY` and `INPUT_CHATGPT_AUTH_JSON` (both trimmed). If either is defined and non-empty, the function returns; otherwise it throws an Error with the message:
 * "Provide either OPENAI_API_KEY or chatgpt_auth_json to authenticate Codex CLI."
 *
 * @throws Error When neither `OPENAI_API_KEY` nor `INPUT_CHATGPT_AUTH_JSON` is provided or both are empty after trimming.
 */
export function validateEnvironmentVariables() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const chatgptAuth = process.env.INPUT_CHATGPT_AUTH_JSON;

  if (openaiApiKey && openaiApiKey.trim().length > 0) {
    return;
  }

  if (chatgptAuth && chatgptAuth.trim().length > 0) {
    return;
  }

  throw new Error(
    "Provide either OPENAI_API_KEY or chatgpt_auth_json to authenticate Codex CLI.",
  );
}
