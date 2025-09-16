#!/bin/bash

# Install act if not already installed
if ! command -v act &> /dev/null; then
    echo "Installing act..."
    brew install act
fi

# Run the test workflow locally
# Provide OPENAI_API_KEY or CHATGPT_AUTH_JSON before executing this script
echo "Running action locally with act..."

if [ -z "${OPENAI_API_KEY:-}" ] && [ -z "${CHATGPT_AUTH_JSON:-}" ]; then
    echo "Set OPENAI_API_KEY or CHATGPT_AUTH_JSON before running this script." >&2
    exit 1
fi

tmp_secrets="$(mktemp)"
trap 'rm -f "$tmp_secrets"' EXIT
chmod 600 "$tmp_secrets"

if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY" >>"$tmp_secrets"
fi

if [ -n "${CHATGPT_AUTH_JSON:-}" ]; then
    printf 'CHATGPT_AUTH_JSON=%s\n' "$CHATGPT_AUTH_JSON" >>"$tmp_secrets"
fi

if [ ! -s "$tmp_secrets" ]; then
    echo "Failed to capture secrets for act run." >&2
    exit 1
fi

act push --secret-file "$tmp_secrets" -W .github/workflows/test-base-action.yml --container-architecture linux/amd64
