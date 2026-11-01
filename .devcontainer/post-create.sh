#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
eval "$(mise activate bash)"

mise trust
mise install
eval "$(mise env)"

npm ci
pip install -q -r requirements-verifier.txt
julia --project=research/ci-quality-cube -e 'using Pkg; Pkg.instantiate()'

if [ -d "$HOME/.local/src/flixw" ] && command -v java >/dev/null; then
  java "$HOME/.local/src/flixw/src/assets/flixw-setup.java" global-upgrade "$HOME/.local/src/flixw/src/stage0/flixw.java"
  bin_dir="${FLIX_CACHE_HOME:-$HOME/.cache/flixw}/bin"
  [ -f "$bin_dir/flixw" ] && ln -sf "$bin_dir/flixw" "$HOME/.local/bin/flixw"
fi

if command -v fish >/dev/null; then
  ln -sf "$(command -v fish)" "$HOME/.local/bin/fish"
fi

# Smoke checks
mise ls --current
java -version; julia --version; node --version; python3 --version; gcc --version | head -1
