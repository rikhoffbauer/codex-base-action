/**
 * Validates the environment variables required for running Codex CLI
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
