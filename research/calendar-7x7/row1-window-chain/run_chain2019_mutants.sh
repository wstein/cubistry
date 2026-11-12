#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Data mutants of test_month_chain_2019.jl and test_hall_table_c.jl: each mutated copy of evidence/month-list must make the named test set fail.
# Usage: [ONLY=mutant-name] run_chain2019_mutants.sh [julia]
# Time: one mutant of test_month_chain_2019.jl about 25 s, one of test_hall_table_c.jl about 20 s at load 25 to 50 (the full run of 14 mutants takes about 6 min,
# more than the 5-minute limit of one command: run it in the background, or select one mutant with ONLY=name).
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; src=$here/evidence/month-list; bad=0; n=0
L=months-chain-2019-01-2036-01.tsv; B=best-effort-chain-2019-01-2036-01.tsv; S=stages-chain-2019-01-2036-01.tsv; C=coverage-chain-2019-01-2036-01; H=february-hall-C.tsv
run() { # name, test set that must fail, mutation (shell function body run inside the copy), test file (default test_month_chain_2019.jl)
  local name=$1 set=$2 d test=${4:-test_month_chain_2019.jl}
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); d=$(mktemp -d); cp "$src"/* "$d"/; ( cd "$d" && eval "$3" )
  local out; out=$(CAL7_CHAIN2019_DIR=$d CAL7_HALL_C_DIR=$d "$julia" --startup-file=no "$here/$test" 2>&1); local rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "^[[:space:]]*$set[[:space:]]*\|[[:space:]]+[0-9 ]*[0-9]+[[:space:]]+[0-9]+"; then echo "KILLED   $name ($set)"
  else echo "SURVIVED $name (expected failure in: $set, rc=$rc)"; bad=1; fi
  rm -rf "$d"
}
run duplicate-month        "range, order, count" "sed -i 's/^2030-05\$/2030-04/' $L"
run swapped-lines          "range, order, count" "awk 'NR==10{a=\$0;next} NR==11{print;print a;next} {print}' $L > t && mv t $L"
run root-before-first      "range, order, count" "sed -i '1s/.*/2018-12/' $L"
run last-month-2036-02     "range, order, count" "sed -i '\$s/.*/2036-02/' $L"
run gap-month-removed      "range, order, count" "sed -i '/^2030-05\$/d' $L"
run crlf                   "pin and format"      "sed -i 's/\$/\r/' $L"
run wrong-cell-7-2         "configurations on print C" "sed -i 's/\t7,1\t/\t7,2\t/' $B"
run extra-best-effort      "configurations on print C" "printf '2037-02\tbest_effort_unverified\t7,1\tx\n' >> $B"
run stage-boundary-moved   "stages"              "sed -i 's/^3\t83\t123\t41\t2025-11\t2029-04/3\t83\t123\t41\t2025-12\t2029-04/' $S"
run stage-sizes-42-40      "stages"              "sed -i 's/^1\t1\t41\t41\t/1\t1\t42\t42\t/; s/^2\t42\t82\t41\t/2\t43\t82\t40\t/' $S"
run coverage-headline      "coverage"            "sed -i 's/\t2026-01\t85\$/\t2026-01\t86/' $C.tsv"
run hall-table-wrong-cell  "table file"          "sed -i 's/\t1\t7,1\t7,1;7,7\t/\t1\t7,2\t7,1;7,7\t/' $H" test_hall_table_c.jl
run hall-table-no-fallback "table file"          "sed -i 's/\t7,1;7,7\t/\t7,1\t/' $H" test_hall_table_c.jl
run hall-evidence-free-text "best-effort entry names the table" "sed -i 's/\t$H\$/\t..\\/config-coverage\\/best-effort-feb-sunday-28.tsv (print C rows; fallback 7,7)/' $B" test_hall_table_c.jl
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
