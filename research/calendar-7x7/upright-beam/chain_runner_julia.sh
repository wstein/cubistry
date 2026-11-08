#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runner for chain_controls.sh and the chain workflow: the Julia chain verifier, strict rule.
#   chain_runner_julia.sh PRINT CHAIN ROOT_MOVES        (env DAG = decompressed dag-all.tsv)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
: "${DAG:?DAG must point at the decompressed dag-all.tsv}"
CUBISTRY_RULE=strict exec julia --startup-file=no "$here/../pure-split-states/pure_chain.jl" "$1" "$DAG" "$2" "$3"
