#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Data mutants of test_month_chain_2019.jl: each mutated copy of evidence/month-list must make the named test set fail.
# Usage: run_chain2019_mutants.sh [julia]    (each run about 20 s; 11 mutants)
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; src=$here/evidence/month-list; bad=0
L=months-chain-2019-01-2036-01.tsv; B=best-effort-chain-2019-01-2036-01.tsv; S=stages-chain-2019-01-2036-01.tsv; C=coverage-chain-2019-01-2036-01
run() { # name, test set that must fail, mutation (shell function body run inside the copy)
  local name=$1 set=$2 d; d=$(mktemp -d); cp "$src"/* "$d"/; ( cd "$d" && eval "$3" )
  local out; out=$(CAL7_CHAIN2019_DIR=$d "$julia" --startup-file=no "$here/test_month_chain_2019.jl" 2>&1); local rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "^[[:space:]]*$set[[:space:]]*\|[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+[0-9]+"; then echo "KILLED   $name ($set)"
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
exit $bad
