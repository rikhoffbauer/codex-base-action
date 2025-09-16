# CODEX.md

## Common Commands

### Development

- Install dependencies: `bun install`
- Type-check: `bun run typecheck`
- Format code: `bun run format`
- Check formatting: `bun run format:check`
- Run tests: `bun test`

### Action Testing

- Test action locally: `./test-local.sh`
- Run specific test: `bun test test/run-codex.test.ts`

## Architecture Overview

This repository defines a GitHub Action that wraps the OpenAI Codex CLI. The action performs the following high-level steps:

1. Installs Bun and Node.js dependencies used by the wrapper scripts.
2. Installs the Codex CLI (unless a custom executable is provided).
3. Prepares the Codex configuration file at `~/.codex/config.toml`.
4. Builds a prompt file from inline text or a provided path.
5. Ensures Codex CLI credentials are available by accepting either ChatGPT `auth.json` content or an `OPENAI_API_KEY`, running `codex login --api-key` when an API key is supplied.
6. Runs `codex exec --json -` with any additional arguments supplied via `codex_args`.
7. Captures Codex CLI JSON events and writes them to `${RUNNER_TEMP}/codex-execution-output.json` for downstream processing.

## Important Details

- Prompts provided inline are written to `/tmp/codex-action/prompt.txt` before being streamed to Codex CLI.
- The wrapper always enables JSON output so every Codex event is captured.
- You can override the Codex CLI binary via the `path_to_codex_executable` input.
- Use the `config` input to merge additional TOML configuration into `~/.codex/config.toml`.
- Set `CODEX_WORKING_DIR` to run Codex from a different directory inside your repository.
