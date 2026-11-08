#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runner for chain_controls.sh and the chain workflow: the independent Julia replay verify_chain.jl.
#   chain_runner_replay.sh PRINT CHAIN ROOT_MOVES
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
exec julia --startup-file=no "$here/verify_chain.jl" "$1" "$3" "$2"
