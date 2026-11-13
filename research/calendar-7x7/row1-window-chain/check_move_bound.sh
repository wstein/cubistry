#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Move-count bound of the three window-chain checkers (check.jl, Flix chain checker, verify_chain.jl). The bound MAX_CHAIN_MOVES is 1000000
# (was 100000 for the start block and the total of edge moves). Cases come from move_bound_cases.jl (stored 20-edge chain, chain.moves padded with net-identity moves):
#   start-accept  start block of 100001 moves (old limit + 1)    all three accept; Julia and Flix receipts identical
#   total-accept  100001 edge moves in total (old limit + 1)     Julia and Flix accept and the receipts are identical (verify_chain.jl has no total bound and is not run on it)
#   start-reject  start block declares 1000001 moves             all three reject at the start bound
#   total-reject  1000001 edge moves in total                    Julia and Flix reject at "bounded total moves"
# Usage: check_move_bound.sh JULIA JAVA CHAIN_JAR OUT   (OUT: new scratch directory; about 10 minutes of CPU, run it niced)
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
J=${1:?Julia executable}; JAVA=${2:?Java executable}; JAR=${3:?Flix chain checker jar}; OUT=${4:?new scratch directory}
[[ ! -e "$OUT" ]] || { echo "OUT exists: $OUT" >&2; exit 2; }
mkdir -p "$OUT"
layout=$here/../row1-revision/layout.tsv; printing=$here/../row1-window-print/evidence/printing.tsv
states=$here/evidence/states; evidence=$here/../english/evidence
export WINDOW_END=2028-01
"$J" --startup-file=no "$here/move_bound_cases.jl" "$here/evidence/moves.tsv" "$OUT/cases" || { echo "FAIL case generation"; exit 1; }
bad=0; n=0
ok()   { n=$((n+1)); echo "ok   $1"; }
fail() { n=$((n+1)); bad=1; echo "FAIL $1"; }
run_julia() { "$J" --startup-file=no "$here/check.jl" "$layout" "$printing" "$OUT/cases/$1.tsv" "$states" > "$OUT/$1.julia.tsv" 2> "$OUT/$1.julia.log"; }
run_flix() { "$JAVA" -Xmx2g -jar "$JAR" "$layout" "$printing" "$OUT/cases/$1.tsv" "$states" "$evidence" > "$OUT/$1.flix.tsv" 2> "$OUT/$1.flix.log"; }
run_indep() { "$J" --startup-file=no "$here/verify_chain.jl" "$layout" "$printing" "$OUT/cases/$1.tsv" "$states" > "$OUT/$1.indep.tsv" 2> "$OUT/$1.indep.log"; }
accept() { # case, checkers
  local c=$1; shift; local k
  for k in "$@"; do
    if "run_$k" "$c"; then ok "$c: $k accepts"; else fail "$c: $k rejects (see $OUT/$c.$k.log)"; fi
  done
  if [[ " $* " == *" julia "* && " $* " == *" flix "* ]]; then
    if cmp -s "$OUT/$c.julia.tsv" "$OUT/$c.flix.tsv"; then ok "$c: Julia and Flix receipts identical"; else fail "$c: receipts differ"; fi
  fi
}
reject() { # case, checker, reason (extended regex on stdout+stderr)
  local c=$1 k=$2 r=$3
  if "run_$k" "$c"; then fail "$c: $k accepts"; elif cat "$OUT/$c.$k.log" "$OUT/$c.$k.tsv" | grep -Eq "$r"; then ok "$c: $k rejects at '$r'"; else fail "$c: $k rejects for another reason (see $OUT/$c.$k.log)"; fi
}
accept start-accept julia flix indep
accept total-accept julia flix
reject start-reject julia "bounded start moves"
reject start-reject flix "bounded start moves"
reject start-reject indep "start move count"
reject total-reject julia "bounded total moves"
reject total-reject flix "bounded total moves"
echo "$n checks, $bad failed"; exit $bad
