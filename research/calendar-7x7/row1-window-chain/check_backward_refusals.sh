#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# window_chain.jl refuses, before any search, a backward run with a root month, an unknown direction and a best-effort first member
# (the first member is the free start of the exported chain and must show its month exactly).
#   check_backward_refusals.sh JULIA [PRODUCER]     (about 1 min; PRODUCER is a mutated copy in the tests of this test; it must lie in this directory)
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd); J=${1:?Julia executable}; prod=${2:-$here/window_chain.jl}
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT; bad=0
PR=$here/evidence/print-c/printing.tsv; LAY=$here/evidence/print-c/layout.tsv
printf '2037-01\n2037-02\n2041-01\n' > "$d/list.tsv"; printf '2037-02\n2041-01\n' > "$d/list-c.tsv"
printf 'month\tstatus\twrong_cells\tevidence\n2037-02\tbest_effort_unverified\t7,1\tnone\n' > "$d/best.tsv"
run() { # name, expected message, list, producer arguments...; extra environment from ENV_EXTRA
  local name=$1 want=$2 list=$3; shift 3
  ( export CAL7_WINDOW_MONTHS="$list" CAL7_WINDOW_MONTHS_SHA256 CAL7_WINDOW_PRINT_SHA CAL7_WINDOW_LAYOUT=$LAY CAL7_WINDOW_LAYOUT_SHA256
    CAL7_WINDOW_MONTHS_SHA256=$(sha256sum "$list" | cut -d' ' -f1); CAL7_WINDOW_PRINT_SHA=$(sha256sum "$PR" | cut -d' ' -f1); CAL7_WINDOW_LAYOUT_SHA256=$(sha256sum "$LAY" | cut -d' ' -f1)
    [[ -z "${ENV_EXTRA:-}" ]] || declare -x "$ENV_EXTRA"
    timeout 280 "$J" --startup-file=no --threads=2 "$prod" "$d/out-$name" "$PR" "$@" ) > "$d/$name.log" 2>&1; local rc=$?
  if [[ $rc -ne 0 ]] && grep -q -- "$want" "$d/$name.log" && [[ ! -e "$d/out-$name/chain.moves.tsv" ]]; then echo "ok   $name"; else echo "FAIL $name: rc=$rc $(grep -m1 -E 'Error|error' "$d/$name.log" | cut -c1-200)"; bad=1; fi
}
ENV_EXTRA=CAL7_ROOT_MONTH=2041-01 run root-month "root_month must be empty" "$d/list.tsv" direction=backward
run direction "direction must be forward or backward" "$d/list.tsv" direction=sideways
run best-first "earliest month 2037-02 is declared best-effort" "$d/list-c.tsv" direction=backward best_effort="$d/best.tsv"
[[ $bad == 0 ]] && echo "backward refusals: 3 cases" || exit 1
