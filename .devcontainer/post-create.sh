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

# Smoke checks
mise ls --current
java -version; julia --version; node --version; python3 --version; gcc --version | head -1
