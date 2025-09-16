# Codex CLI Base Action

This GitHub Action runs the [OpenAI Codex CLI](https://github.com/openai/codex) inside your workflows so you can automate code changes with the same agent that powers the local `codex` command.

The action prepares a prompt (inline or from a file), configures Codex CLI, authenticates with either your ChatGPT plan credentials or an OpenAI API key, and then executes `codex exec` in non-interactive mode. All events emitted by the CLI are captured as structured JSON so downstream steps can inspect or archive the run.

## Quick start

Add a step to your workflow that invokes the action with a prompt. Provide either the contents of your Codex `auth.json` file from a paid ChatGPT plan or an OpenAI API key.

### Use a ChatGPT plan (recommended)

```yaml
- name: Run Codex CLI with inline prompt
  uses: openai/codex-base-action@main
  with:
    prompt: "Summarize the latest changes and update CHANGELOG.md"
    chatgpt_auth_json: ${{ secrets.CODEX_AUTH_JSON }}
```

`CODEX_AUTH_JSON` should contain the literal contents of the `~/.codex/auth.json` file generated after running `codex login` locally and choosing **Sign in with ChatGPT**.

### Use an OpenAI API key

```yaml
- name: Run Codex CLI with inline prompt
  uses: openai/codex-base-action@main
  with:
    prompt: "Summarize the latest changes and update CHANGELOG.md"
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

You can also read the prompt from a file and pass additional CLI arguments:

```yaml
- name: Run Codex CLI with prompt file
  uses: openai/codex-base-action@main
  with:
    prompt_file: .github/codex/prompt.txt
    codex_args: "--full-auto --ask-for-approval never"
    chatgpt_auth_json: ${{ secrets.CODEX_AUTH_JSON }}
```

To customise Codex CLI defaults, supply a TOML config string or a path to a config file:

```yaml
- name: Run Codex CLI with custom config
  uses: openai/codex-base-action@main
  with:
    prompt: "Draft release notes for vNext"
    config: |
      model = "o4-mini"
      [sandbox]
      mode = "workspace-write"
    codex_args: "--full-auto"
    chatgpt_auth_json: ${{ secrets.CODEX_AUTH_JSON }}
```

> Replace `chatgpt_auth_json` with `openai_api_key` in any example if you prefer to authenticate with the OpenAI API.

## Inputs

| Input | Description | Required | Default |
| ----- | ----------- | -------- | ------- |
| `prompt` | The prompt to send to Codex CLI (mutually exclusive with `prompt_file`). | No* | `""` |
| `prompt_file` | Path to a file containing the prompt (mutually exclusive with `prompt`). | No* | `""` |
| `config` | Codex CLI configuration as a TOML string or a path to a TOML file. Values are merged with any existing `~/.codex/config.toml`. | No | `""` |
| `codex_args` | Additional arguments that should be appended to `codex exec` (for example `--full-auto --model o4-mini`). | No | `""` |
| `chatgpt_auth_json` | Contents of the Codex `auth.json` file (or a path to that file) generated after signing in with ChatGPT. | No | `""` |
| `openai_api_key` | OpenAI API key used to authenticate Codex CLI in headless mode. | No | `""` |
| `use_node_cache` | Enable npm dependency caching for repositories that need it. | No | `"false"` |
| `path_to_codex_executable` | Path to a pre-installed Codex CLI binary. When provided the automatic npm installation is skipped. | No | `""` |
| `path_to_bun_executable` | Path to a custom Bun binary if you need to override the bundled version. | No | `""` |

> [!NOTE]
> By default the action installs `@openai/codex@0.36.0` when a custom executable is not supplied.

\* Either `prompt` or `prompt_file` must be provided, but not both.

## Outputs

| Output | Description |
| ------ | ----------- |
| `conclusion` | `success` when Codex CLI exits with code `0`, otherwise `failure`. |
| `execution_file` | Absolute path to the JSON file containing the Codex CLI event log. |

## Environment variables

The following optional environment variables influence the composite action:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `NODE_VERSION` | Node.js version passed to `actions/setup-node`. | `20.x` |
| `CODEX_WORKING_DIR` | Directory to `cd` into before running the action. Useful when you want Codex to operate in a subfolder. | Workspace root |

## Authentication

Codex CLI accepts the same authentication methods in CI that it does on your local machine. Provide **one** of the following inputs:

- `chatgpt_auth_json` – recommended for ChatGPT Plus, Pro, Team, Edu, or Enterprise plans.
- `openai_api_key` – for usage-based billing with the OpenAI API.

### ChatGPT plans

1. Run `codex login` locally and choose **Sign in with ChatGPT**.
2. Copy the contents of the generated `~/.codex/auth.json` file.
3. Store the JSON as an encrypted secret (for example `CODEX_AUTH_JSON`) and pass it to the `chatgpt_auth_json` input.

When this input is provided the action writes the secret to `~/.codex/auth.json` on the runner before invoking `codex exec`. You can also point `chatgpt_auth_json` at a file path that you created earlier in the workflow if you prefer to fetch credentials dynamically.

### OpenAI API key

If you prefer usage-based billing, supply an API key with access to the Responses API via the `openai_api_key` input. The action will run `codex login --api-key` automatically before executing your prompt.

## Execution logs

The action runs `codex exec --json -` so that Codex emits JSON Lines events. Each event is parsed and written to `${RUNNER_TEMP}/codex-execution-output.json` as a JSON array. You can upload this file as an artifact or consume it in later steps for additional processing.

## Development

- Install dependencies: `bun install`
- Format code: `bun run format`
- Run tests: `bun test`
- Type-check: `bun run typecheck`

The action is built with [Bun](https://bun.sh/) and written in TypeScript.
