#!/bin/bash

# Install act if not already installed
if ! command -v act &> /dev/null; then
    echo "Installing act..."
    brew install act
fi

# Run the test workflow locally
# Provide OPENAI_API_KEY or CHATGPT_AUTH_JSON before executing this script
echo "Running action locally with act..."

secrets=()
if [ -n "${OPENAI_API_KEY:-}" ]; then
    secrets+=(--secret OPENAI_API_KEY="$OPENAI_API_KEY")
fi

if [ -n "${CHATGPT_AUTH_JSON:-}" ]; then
    secrets+=(--secret CHATGPT_AUTH_JSON="$CHATGPT_AUTH_JSON")
fi

if [ ${#secrets[@]} -eq 0 ]; then
    echo "Set OPENAI_API_KEY or CHATGPT_AUTH_JSON before running this script." >&2
    exit 1
fi

act push "${secrets[@]}" -W .github/workflows/test-base-action.yml --container-architecture linux/amd64
