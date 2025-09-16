# Contributing to Codex CLI Base Action

Thank you for your interest in contributing to the Codex CLI Base Action! This document covers the basics of setting up a local development environment and the conventions we follow for changes.

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Docker](https://www.docker.com/) (required to run GitHub Actions locally with [`act`](https://github.com/nektos/act))
- Either a paid ChatGPT plan (with the ability to export `~/.codex/auth.json`) or an OpenAI API key (needed when testing the action end-to-end)

### Repository setup

```bash
git clone https://github.com/your-username/codex-base-action.git
cd codex-base-action
bun install
```

Set your preferred authentication method when running integration tests locally:

```bash
# Option 1: Usage-based billing
export OPENAI_API_KEY="sk-your-api-key"

# Option 2: Paid ChatGPT plan
export CHATGPT_AUTH_JSON="$(cat ~/.codex/auth.json)"
```

## Development workflow

### Useful scripts

- `bun test` – run all tests
- `bun run typecheck` – perform TypeScript type checking
- `bun run format` – format the codebase with Prettier
- `bun run format:check` – verify formatting without applying changes

### Testing locally

Run unit tests:

```bash
bun test
```

Run the composite action in a local GitHub Actions runner:

```bash
./test-local.sh
```

The script installs `act` on-demand (Homebrew is required on macOS) and executes the sample workflow inside Docker. Ensure Docker is running before invoking the script.

## Pull request process

1. Create a feature branch from `main`.
2. Make your changes and include tests when applicable.
3. Run `bun test`, `bun run typecheck`, and `bun run format:check`.
4. Commit with conventional messages (e.g., `feat: add codex args parsing`).
5. Push your branch and open a pull request.
6. Wait for CI to pass and request a review from maintainers.

## Working on the action

When modifying behaviour that interacts with Codex CLI:

- Use `./test-local.sh` to execute the action end-to-end in a container.
- Test changes in a real GitHub workflow by referencing your branch:
  ```yaml
  uses: your-username/codex-base-action@your-branch
  ```
- Add logging with `console.log` if you need additional diagnostics.
- Check the generated execution log (`${RUNNER_TEMP}/codex-execution-output.json`) for insights into Codex behaviour.

## Troubleshooting

### Docker issues

Ensure Docker is running before using `act`:

```bash
docker ps
```

### Authentication

The action needs either `OPENAI_API_KEY` or `CHATGPT_AUTH_JSON` to authenticate Codex CLI. Double-check that the environment variable is available to the composite action or that your workflow passes the matching input (`openai_api_key` or `chatgpt_auth_json`) correctly.
