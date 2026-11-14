#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Re-root measurement of the chain edges ID[,ID...] on the frozen inputs of evidence/reroot-measure (print C, layout e9a409, month list,
# stored chain 2019-01..2036-01 of run 43307881914). Verifies SHA256SUMS first. Heavy: about 1 minute of setup plus about 7 minutes per edge
# of 100-170 HTM (4 threads); run it as the GitHub Action beam-reroot-measure.yml, locally only on a tiny edge, below 5 minutes.
#   run_reroot_measure.sh OUTDIR ID[,ID...] [key=value ...]      (keys: see measure_edges.jl; JULIA=path of the julia binary)
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: run_reroot_measure.sh OUTDIR ID[,ID...] [key=value ...]" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd); ev="$here/evidence/reroot-measure"; out=$1; ids=$2; shift 2
(cd "$ev" && sha256sum --check --strict SHA256SUMS >/dev/null) || { echo "frozen inputs differ from SHA256SUMS" >&2; exit 1; }
pin() { awk -v f="$1" '$2==f{print $1}' "$ev/SHA256SUMS"; }
export CAL7_WINDOW_LAYOUT="$here/evidence/print-c/layout.tsv" CAL7_WINDOW_LAYOUT_SHA256=$(pin ../print-c/layout.tsv)
export CAL7_WINDOW_MONTHS="$here/evidence/month-list/months-chain-2019-01-2036-01.tsv" CAL7_WINDOW_MONTHS_SHA256=$(pin ../month-list/months-chain-2019-01-2036-01.tsv)
[ -n "$CAL7_WINDOW_LAYOUT_SHA256" ] && [ -n "$CAL7_WINDOW_MONTHS_SHA256" ] || { echo "pin missing in SHA256SUMS" >&2; exit 1; }
exec "${JULIA:-julia}" --threads=4 --startup-file=no "$here/measure_edges.jl" "$out" "$here/evidence/print-c/printing.tsv" "$ev/chain-2019-01-2036-01.moves.tsv" "$ids" "$@"
