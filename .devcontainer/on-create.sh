#!/usr/bin/env bash
# System packages, mise, and the flixw checkout. Language toolchains come from /mise.toml.
set -euo pipefail

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends build-essential time jq unzip >/dev/null

if ! command -v mise >/dev/null && [ ! -x "$HOME/.local/bin/mise" ]; then
  curl -fsSL https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"
grep -q 'mise activate' ~/.bashrc || echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
grep -q 'mise activate' ~/.zshrc 2>/dev/null || echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc

# flixw (github.com/wstein/flixw), pinned tag
if [ ! -d "$HOME/.local/src/flixw" ]; then
  mkdir -p "$HOME/.local/src"
  gh repo clone wstein/flixw "$HOME/.local/src/flixw" -- --branch "${FLIXW_VERSION:-v0.34.9}" --depth 1 \
    || git clone --depth 1 --branch "${FLIXW_VERSION:-v0.34.9}" https://github.com/wstein/flixw "$HOME/.local/src/flixw" \
    || echo "WARN: flixw clone failed (needs network/auth); continue manually"
fi
