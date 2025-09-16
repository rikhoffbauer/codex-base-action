/**
 * Validates the environment variables required for running Codex CLI
 */
export function validateEnvironmentVariables() {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const chatgptAuth =
    (process.env.INPUT_CHATGPT_AUTH_JSON ??
      process.env.CHATGPT_AUTH_JSON)?.trim();

  if (openaiApiKey && openaiApiKey.length > 0) {
    return;
  }

  if (chatgptAuth && chatgptAuth.length > 0) {
    return;
  }

  throw new Error(
    "Provide either OPENAI_API_KEY or chatgpt_auth_json to authenticate Codex CLI.",
  );
}
