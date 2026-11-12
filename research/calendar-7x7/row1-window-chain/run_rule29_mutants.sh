#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of the 29 rule (check.jl, verify_chain.jl, flix/src/Main.flix): each mutated copy must be caught, by test_best_effort_29.jl (unit, Julia)
# or by run_root2019_checks.sh on the named case (end to end; a Flix mutant builds its own jar). Usage: [ONLY=name] run_rule29_mutants.sh JULIA JAVA OUT
# Time: 9 mutants, about 15 s (unit) to 60 s (end to end) each at load 25; Flix mutants add the jar build (about 15 s). The whole run takes about 6 min:
# run it in the background or select one mutant with ONLY=name.
set -u
here=$(cd "$(dirname "$0")" && pwd); cal=$(dirname "$here"); julia=${1:?Julia executable}; java=${2:?Java executable}; out=${3:?scratch directory}; bad=0; n=0
mkdir -p "$out"
run() { # name, kind (unit|case:NAME), file to mutate, sed expression
  local name=$1 kind=$2 file=$3 expr=$4 t rc res
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); t=$(mktemp -d); mkdir "$t/row1-window-chain"
  for d in "$cal"/*; do [ "$d" = "$here" ] || ln -s "$d" "$t/$(basename "$d")"; done
  cp -r "$here"/*.jl "$here"/*.sh "$here/flix" "$t/row1-window-chain/"; ln -s "$here/evidence" "$t/row1-window-chain/evidence"
  cp "$t/row1-window-chain/$file" "$t/orig"; sed -i "$expr" "$t/row1-window-chain/$file"
  if cmp -s "$t/orig" "$t/row1-window-chain/$file"; then echo "NOT APPLIED $name"; bad=1; rm -rf "$t"; return; fi
  if [ "$kind" = unit ]; then
    (cd /tmp && "$julia" --startup-file=no "$t/row1-window-chain/test_best_effort_29.jl" > "$out/$name.log" 2>&1); rc=$?
    if [ $rc -ne 0 ] && grep -q "29 rule of check.jl" "$out/$name.log"; then res=KILLED; else res=SURVIVED; fi
  else
    local jar="$out/good.jar"
    if [ "$file" = flix/src/Main.flix ]; then
      CALENDAR7_CHAIN_FLIX_BUILD_DIR="$out/build-$name" bash "$t/row1-window-chain/flix/build.sh" > "$out/$name.build.log" 2>&1 || { echo "BUILD FAILED $name"; bad=1; rm -rf "$t"; return; }
      jar="$out/build-$name/artifact/flixbuild.jar"
    fi
    (cd /tmp && ONLY="${kind#case:}" bash "$t/row1-window-chain/run_root2019_checks.sh" "$julia" "$java" "$jar" "$out/run-$name" > "$out/$name.log" 2>&1); rc=$?
    # the case is a reject case: a surviving mutant is an accepting checker, which the runner reports as "accepted"
    if [ $rc -ne 0 ] && grep -q "accepted (julia rejected=" "$out/$name.log"; then res=KILLED; else res=SURVIVED; fi
  fi
  echo "$res   $name ($kind)"; [ $res = KILLED ] || bad=1
  rm -rf "$t"
}
C=check.jl; V=verify_chain.jl; F=flix/src/Main.flix
run check-wiring-off      case:corner-2026-02-71-rule29 $C 's/^        BEST_EFFORT_29 \&\& !isempty(mism)/        false \&\& !isempty(mism)/'
run check-cell-any        unit                          $C 's/only(wrong) in ((7,1),(7,7))/true/'
run check-text-ignored    unit                          $C 's/ \&\& s.text=="29" \&\& s.ink=="red"/ \&\& s.ink=="red"/'
run check-ink-ignored     unit                          $C 's/s.text=="29" \&\& s.ink=="red" \&\& findfirst/s.text=="29" \&\& findfirst/'
run check-upright-ignored unit                          $C 's/ \&\& findfirst(==(s.up),IMAGE_UPS)==1 "best-effort wrong cell shows/ "best-effort wrong cell shows/'
run verify-wiring-off     case:corner-2026-02-71-rule29 $V 's/^        RULE29 \&\& !isempty(bad)/        false \&\& !isempty(bad)/'
run verify-art-ignored    case:rule29-text-28           $V 's/reading(s,a-1,("29","red"))==:upright/reading(s,a-1,(s.text,s.ink))==:upright/'
run flix-wiring-off       case:corner-2026-02-71-rule29 $F 's/if(rule=="29" and mism != Nil) w29/if(rule=="x" and mism != Nil) w29/'
run flix-text-ignored     case:rule29-text-28           $F 's/require(text=="29" and ink=="red" and upAngle(u)==0/require(ink=="red" and upAngle(u)==0/'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
