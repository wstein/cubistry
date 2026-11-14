#!/usr/bin/env bash
# Mutation check: each FG_MUTATE value breaks one piece of FrontGoal.jl; the named test set must fail.
# usage: run-mutations.sh [outDir]   (JULIA=path to julia; default outDir: .scratch/mutations next to this script, gitignored).
# Exit 1 if a mutation is not caught by its expected test set.
set -u
here=$(cd "$(dirname "$0")" && pwd)
J=${JULIA:-julia}
out=${1:-$here/.scratch/mutations}
mkdir -p "$out"
status=0
check() { # mutation, expected failing test set
  local m=$1 want=$2
  FG_MUTATE=$m nice -n 10 "$J" "$here/test/runtests.jl" > "$out/$m.log" 2>&1
  local code=$?
  local failed
  failed=$(grep -o '^[^:]*: Test Failed' "$out/$m.log" | sed 's/: Test Failed//' | sort -u | tr '\n' ';')
  if [ $code -ne 0 ] && printf '%s' "$failed" | grep -qF "$want"; then
    echo "CAUGHT  $m -> failed test sets: $failed"
  else
    echo "MISSED  $m (exit $code, expected '$want', got '$failed')"; status=1
  fi
}
check h_plus_one "optimum equals brute force"
check forbid_opposite "optimum equals independent brute force"
check short_depth "depth bound is inclusive"
check last_found "fewest rotation tokens"
check first_table_only "weaker heuristic gives the same optimum"
check h_plus_one "known optima"
check strict_sources "optimum equals brute force"
check ignore_up "accepts() equals engine reality"
check ignore_up "predicate agrees with the app's matches()"
check ignore_center_up "predicate agrees with the app's matches()"
check drop_slot9 "predicate agrees with the app's matches()"
exit $status
