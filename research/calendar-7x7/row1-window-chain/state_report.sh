#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# State report of a window chain: identical start/end full states, repeated (start,end) pairs, repeated configuration transitions.
#   state_report.sh CHAIN [STATES_DIRECTORY] [JULIA]     (JULIA defaults to julia; output on stdout; see state_report.jl)
# Meant to run after stage 1 (41 edges) of the first chain and again on the whole chain (204 edges), for example on the chain.moves.tsv of a stage output.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
chain=${1:?chain file (chain.moves.tsv)}; states=${2:-}; julia_bin=${3:-julia}
if [[ -n "$states" ]]; then exec "$julia_bin" --startup-file=no "$here/state_report.jl" "$chain" "$states"; fi
exec "$julia_bin" --startup-file=no "$here/state_report.jl" "$chain"
