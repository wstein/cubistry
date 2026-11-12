#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Data mutants of test_month_chain_2100.jl: each mutated copy of evidence/month-list (or of print C) must make the named test set fail.
# Usage: [ONLY=mutant-name] run_chain2100_mutants.sh [julia]
# Time: every mutant is one run of the test (about 25 s); ONLY=name selects one.
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; src=$here/evidence/month-list; bad=0; n=0
L=months-chain-2019-01-2100-01.tsv; B=best-effort-chain-2019-01-2100-01.tsv; S=stages-chain-2036-01-2100-01.tsv; C=coverage-chain-2019-01-2100-01; H=february-hall-C-2100.tsv
run() { # name, test set that must fail, mutation (shell function body run inside the copy)
  local name=$1 set=$2 d
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); d=$(mktemp -d); cp "$src"/* "$d"/; cp "$here"/evidence/print-c/{printing,layout}.tsv "$d"/; ( cd "$d" && eval "$3" )
  local out; out=$(CAL7_CHAIN2100_DIR=$d CAL7_CHAIN2100_PRINTC=$d "$julia" --startup-file=no "$here/test_month_chain_2100.jl" 2>&1); local rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "^[[:space:]]*${set}[[:space:]]*\|[[:space:]]+[0-9 ]*[0-9]+[[:space:]]+[0-9]+"; then echo "KILLED   $name ($set)"
  else echo "SURVIVED $name (expected failure in: $set, rc=$rc)"; bad=1; fi
  rm -rf "$d"
}
run duplicate-month        "range, order, count" "sed -i 's/^2060-05\$/2060-04/' $L"
run gap-month-removed      "range, order, count" "sed -i '/^2060-05\$/d' $L"
run root-before-first      "range, order, count" "sed -i '1s/.*/2018-12/' $L"
run last-month-2099-12     "range, order, count" "sed -i '\$s/.*/2099-12/' $L"
run extra-month-2100-02    "range, order, count" "echo 2100-02 >> $L"
run first-chain-prefix-month-changed "range, order, count" "sed -i 's/^2030-05\$/2030-04/' $L"
run crlf                   "pin and format"      "sed -i 's/\$/\r/' $L"
run best-effort-missing    "best-effort file"    "sed -i '/^2054-02\t/d' $B"
run best-effort-extra      "best-effort file"    "printf '2036-02\tbest_effort_unverified\t7,1\t$H\n' >> $B"
run best-effort-cell-7-7   "best-effort file"    "sed -i 's/^2065-02\tbest_effort_unverified\t7,1\t/2065-02\tbest_effort_unverified\t7,7\t/' $B"
run best-effort-unsorted   "best-effort file"    "awk 'NR==3{a=\$0;next} NR==4{print;print a;next} {print}' $B > t && mv t $B"
run hall-table-row-removed "best-effort file"    "sed -i '/^2082-02\t/d' $H"
run hall-table-wrong-cell  "best-effort file"    "sed -i 's/^2093-02\t-3,-3,-3\t1\t7,1\t/2093-02\t-3,-3,-3\t1\t7,2\t/' $H"
run stage-too-long         "stage plan"          "sed -i 's/^7\t208\t271\t64\t207\t2036-04\t2041-08\t64/7\t208\t272\t65\t207\t2036-04\t2041-09\t65/' $S"
run stage-expect-prior     "stage plan"          "sed -i 's/^6\t205\t207\t3\t204\t/6\t205\t207\t3\t205\t/' $S"
run stage-end-month        "stage plan"          "sed -i 's/^10\t400\t463\t64\t399\t2052-04\t2057-08\t64/10\t400\t463\t64\t399\t2052-04\t2057-09\t64/' $S"
run coverage-headline      "coverage"            "sed -i 's/\t2026-01\t85\$/\t2026-01\t86/' $C.tsv"
run print-sticker-text     "months print C shows exactly" "awk -F'\t' -v OFS='\t' 'NR>1 && \$6==\"5\" && !d {\$6=\"x\"; d=1} {print}' printing.tsv > t && mv t printing.tsv"
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
