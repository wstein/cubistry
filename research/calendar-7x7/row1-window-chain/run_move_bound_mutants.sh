#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Mutants of the move-count bound: every one must make check_move_bound.sh fail at the intended case.
#   check.jl     bound back to 100000 (limit)  / start bound without upper limit (start-nolimit) / total bound without upper limit (total-nolimit)
#   Main.flix    the same three (a Flix jar is built per mutant, about 2 minutes each)
#   verify_chain bound back to 100000 (limit)  / start bound without upper limit (start-nolimit)
# Usage: run_move_bound_mutants.sh JULIA JAVA SCRATCH_DIR   (SCRATCH_DIR: new directory; ONLY=name runs one mutant; run niced)
set -u
here=$(cd "$(dirname "$0")" && pwd); J=${1:?Julia executable}; JAVA=${2:?Java executable}; S=${3:?new scratch directory}
[[ ! -e "$S" ]] || { echo "SCRATCH_DIR exists: $S" >&2; exit 2; }
mkdir -p "$S"; bad=0
verdict() { # name, rc, log, expected FAIL line regex
  if [ "$2" -ne 0 ] && grep -Eq "$4" "$3"; then echo "KILLED   $1"; else echo "SURVIVED $1 (rc=$2, expected /$4/)"; bad=1; fi
}
jl() { # name, file (check.jl|verify_chain.jl), sed expression, expected regex
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return
  local m="$here/${2%.jl}_mut.jl"; cp "$here/$2" "$m"; sed -i "$3" "$m"; cmp -s "$m" "$here/$2" && { echo "NOEFFECT $1"; bad=1; rm -f "$m"; return; }
  local env=CHECK_JL; [ "$2" = check.jl ] || env=VERIFY_CHAIN_JL
  local jar=${JAR:?}; env "$env=$m" bash "$here/check_move_bound.sh" "$J" "$JAVA" "$jar" "$S/$1" > "$S/$1.log" 2>&1; local rc=$?; rm -f "$m"
  verdict "$1" $rc "$S/$1.log" "$4"
}
flix() { # name, sed expression on Main.flix, expected regex
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return
  mkdir -p "$S/$1.src"; cp "$here/flix/src/Main.flix" "$S/$1.src/Main.flix"; sed -i "$2" "$S/$1.src/Main.flix"; cmp -s "$S/$1.src/Main.flix" "$here/flix/src/Main.flix" && { echo "NOEFFECT $1"; bad=1; return; }
  CALENDAR7_CHAIN_FLIX_MAIN="$S/$1.src/Main.flix" CALENDAR7_CHAIN_FLIX_BUILD_DIR="$S/$1.build" bash "$here/flix/build.sh" > "$S/$1.build.log" 2>&1 || { echo "BUILDFAIL $1"; bad=1; return; }
  local jar; jar=$(find "$S/$1.build/artifact" -name '*.jar' | head -n 1)
  bash "$here/check_move_bound.sh" "$J" "$JAVA" "$jar" "$S/$1" > "$S/$1.log" 2>&1; local rc=$?
  verdict "$1" $rc "$S/$1.log" "$3"
}
# The Julia and independent mutants need a good jar (Flix is not mutated there): build one from the unchanged Main.flix.
JAR=$S/good.jar
if [ -z "${ONLY:-}" ] || [[ "$ONLY" == julia-* || "$ONLY" == indep-* ]]; then
  CALENDAR7_CHAIN_FLIX_BUILD_DIR="$S/good.build" bash "$here/flix/build.sh" > "$S/good.build.log" 2>&1 || { echo "BUILDFAIL good"; exit 1; }
  cp "$(find "$S/good.build/artifact" -name '*.jar' | head -n 1)" "$JAR"
fi
export JAR
jl julia-limit         check.jl        's/^const MAX_CHAIN_MOVES=1_000_000/const MAX_CHAIN_MOVES=100000/'             '^FAIL (start|total)-accept: julia rejects'
jl julia-start-nolimit check.jl        's/0<=n<=MAX_CHAIN_MOVES "bounded start moves"/0<=n "bounded start moves"/'     '^FAIL start-reject: julia'
jl julia-total-nolimit check.jl        's/totalmoves<=MAX_CHAIN_MOVES "bounded total moves"/true "bounded total moves"/' '^FAIL total-reject: julia'
jl indep-limit         verify_chain.jl 's/^const MAX_START_MOVES=1_000_000/const MAX_START_MOVES=100000/'             '^FAIL start-accept: indep rejects'
jl indep-start-nolimit verify_chain.jl 's/0<=n<=MAX_START_MOVES "start move count"/0<=n "start move count"/'          '^FAIL start-reject: indep'
flix flix-limit         's/^def maxChainMoves(): Int32 = 1000000/def maxChainMoves(): Int32 = 100000/'                '^FAIL (start|total)-accept: flix rejects'
flix flix-start-nolimit 's/n>=0 and n<=maxChainMoves(),"bounded start moves"/n>=0,"bounded start moves"/'            '^FAIL start-reject: flix'
flix flix-total-nolimit 's/require(total<=maxChainMoves(),"bounded total moves")/require(total>=0,"bounded total moves")/' '^FAIL total-reject: flix'
exit $bad
