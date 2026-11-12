#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of state_report.jl: each mutated copy must make the named test set of test_state_report.jl fail.
# Usage: [ONLY=name] run_state_report_mutants.sh [julia]    (about 25 s each, 5 mutants)
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; bad=0; n=0
run() { # name, test set that must fail, sed expression on state_report.jl
  local name=$1 set=$2 expr=$3 t out rc
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); t=$(mktemp -d); mkdir "$t/row1-window-chain"; cp "$here"/state_report.jl "$here"/state_report.sh "$here"/test_state_report.jl "$t/row1-window-chain/"; ln -s "$here/evidence" "$t/row1-window-chain/evidence"
  cp "$t/row1-window-chain/state_report.jl" "$t/orig"; sed -i "$expr" "$t/row1-window-chain/state_report.jl"
  if cmp -s "$t/orig" "$t/row1-window-chain/state_report.jl"; then echo "NOT APPLIED $name"; bad=1; rm -rf "$t"; return; fi
  out=$(cd /tmp && "$julia" --startup-file=no "$t/row1-window-chain/test_state_report.jl" 2>&1); rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "^[[:space:]]*$set[[:space:]]*\|[[:space:]]+[0-9 ]*[0-9]+[[:space:]]+[0-9]+"; then echo "KILLED   $name ($set)"
  else echo "SURVIVED $name (expected failure in: $set, rc=$rc)"; bad=1; fi
  rm -rf "$t"
}
run pair-by-start-only    "counts on a chain with repeats" 's/pairs=\[(e.src,e.fin) for e in E\]/pairs=[(e.src,"") for e in E]/'
run transition-by-target  "counts on a chain with repeats" 's/trans=\[(cfgs\[i\],cfgs\[i+1\]) for i in 1:n\]/trans=[(cfgs[i+1],cfgs[i+1]) for i in 1:n]/'
run config-without-weekday "counts on a chain with repeats" 's/^config(y,m)=(m,dayofweek(Date(y,m,1)),/config(y,m)=(m,1,/'
run states-digest-ignored "states directory"               's/@assert state_file_digest(p)==d "state file/@assert true "state file/'
run continuity-ignored    "continuity"                     's/^    for i in 2:n;@assert E\[i\].src==E\[i-1\].fin/    for i in 2:n;@assert true/'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
