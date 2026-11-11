#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of the month-list logic, applied to a scratch copy of research/calendar-7x7 (never the worktree).
#   run_month_list_mutants.sh JULIA JAVA OUT [julia|flix|all]
# Each mutant must make the named test fail. Flix mutants rebuild the chain jar (about 2 minutes each).
set -u
here=$(cd -- "$(dirname -- "$0")" && pwd); cal=$(cd "$here/.." && pwd)
J=${1:?julia}; JAVA=${2:?java}; out=${3:?scratch dir}; which=${4:-all}
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-$out/flixcache} COURSIER_CACHE=${COURSIER_CACHE:-$out/coursier}
mkdir -p "$out"; rm -rf "$out/tree"; mkdir "$out/tree"; cp -R "$cal" "$out/tree/calendar-7x7"; tree="$out/tree/calendar-7x7"
chain="$tree/row1-window-chain"; corner="$tree/row1-corner-coupling"
ok=0; bad=0
t3() { "$J" --startup-file=no "$chain/test_month_coverage.jl" > "$out/t.log" 2>&1; }
t1() { "$J" --startup-file=no "$chain/test_month_list.jl" > "$out/t.log" 2>&1; }
t2() { ONLY="$1" "$chain/run_month_list_checks.sh" "$J" "$JAVA" "$out/jar/artifact/jar.jar" "$out/run" > "$out/t.log" 2>&1; }
mutate() { # id file sed-expr test-kind [ONLY list]
    local id=$1 f=$2 expr=$3 kind=$4 only=${5:-none}
    cp "$f" "$f.orig"; sed -i "$expr" "$f"
    if cmp -s "$f" "$f.orig"; then echo "NOT-APPLIED $id"; mv "$f.orig" "$f"; bad=$((bad+1)); return; fi
    if [[ $kind == flix ]]; then
        rm -rf "$out/jar-build" "$out/jar/artifact/jar.jar"; CALENDAR7_CHAIN_FLIX_BUILD_DIR="$out/jar-build" bash "$chain/flix/build.sh" > "$out/build.log" 2>&1 || true
        if ! cp "$out/jar-build/artifact/"*.jar "$out/jar/artifact/jar.jar" 2>/dev/null; then echo "NOT-BUILT $id"; mv "$f.orig" "$f"; bad=$((bad+1)); return; fi
    fi
    rm -rf "$out/run"
    if [[ $kind == t1 ]]; then t1; elif [[ $kind == t3 ]]; then t3; else t2 "$only"; fi; local rc=$?
    mv "$f.orig" "$f"
    if [[ $rc != 0 ]]; then echo "KILLED   $id [$kind] $(grep -m1 -E "Fail|Error|accepted|rejected|differ|cmp:|EOF" "$out/t.log" | cut -c1-100)"; ok=$((ok+1)); else echo "SURVIVED $id"; bad=$((bad+1)); fi
}
# the unmutated Flix jar for the Julia-only mutants and the baseline
mkdir -p "$out/jar/artifact"; rm -rf "$out/jar-build"; CALENDAR7_CHAIN_FLIX_BUILD_DIR="$out/jar-build" bash "$chain/flix/build.sh" > "$out/build.log" 2>&1
cp "$out/jar-build/artifact/"*.jar "$out/jar/artifact/jar.jar"
if [[ $which == julia || $which == all ]]; then
mutate J1-increasing-check "$corner/check.jl" 's/ms\[end\]<(y,mo)/true/' t1
mutate J2-list-hash-check "$corner/check.jl" 's/bytes2hex(sha256(bytes))==expected_sha/true/' t1
mutate J3-list-ignored "$corner/check.jl" 's/if isempty(path)/if true/' t1
mutate J4-bridge-detection "$corner/check.jl" 's/>1 for (a,b)/>9 for (a,b)/' t1
mutate J5-exclusive-window-end "$corner/check.jl" 's/@assert !haskey(ENV,"WINDOW_END") "month list and WINDOW_END are exclusive"/@assert true/' t1
mutate J6-root-record "$chain/check.jl" 's/@assert canonical_integer.(f\[2:4\])==\[sm,sy,sm\]/@assert true/' t2 "root-mismatch start-record-mismatch"
mutate J7-chain-adjacency "$chain/check.jl" 's/@assert (edge.year,edge.month)==(goal.year,goal.month)/@assert true/' t2 "skipped-month-with-edge bridge-edge-declares-skipped-month"
mutate J8-bridge-flag-output "$chain/check.jl" 's/WINDOW_BRIDGES\[i\] ? "\\tBRIDGE" : ""/""/' t2 none
mutate J9-independent-next-member "$chain/verify_chain.jl" 's/y,m=LISTED ? NEXT\[(y,m)\] : /y,m=/' t2 none
mutate J10-independent-increasing "$chain/verify_chain.jl" 's/@assert isempty(out) || t>out\[end\]/@assert true/' t2 "list-not-increasing"
mutate J11-start-ignored-check "$chain/check.jl" 's/sy,sm=WINDOW_LIST\[1\]/sy,sm=(2026,5)/' t2 start-2037-05
mutate J12-start-ignored-independent "$chain/verify_chain.jl" 's/SY,SM=LISTED ? MONTHS\[1\] : (2026,5)/SY,SM=(2026,5)/' t2 start-2037-05
mutate C1-coverage-run-break "$chain/month_coverage.jl" 's/idx(m)==idx(p)+1 || (push!/idx(m)==idx(p)+2 || (push!/' t3
mutate C2-coverage-before-root "$chain/month_coverage.jl" 's/i in inlist) for i in idx(FIRST)/true) for i in idx(FIRST)/' t3
mutate C3-verify-receipts-identical "$chain/verify_coverage.jl" 's/@assert read(a)==read(b) "Julia and Flix receipts byte-identical"/@assert true/' t3
mutate C4-coverage-start-ignored "$chain/month_coverage.jl" 's/function coverage(ms,status,last,ROOT)/function coverage(ms,status,last,ROOT0)\n    ROOT=(2026,5)/' t3
fi
if [[ $which == flix || $which == all ]]; then
mutate F1-flix-increasing "$corner/flix/src/Main.flix" 's/monthIndex(a)<monthIndex(b)/monthIndex(a)<monthIndex(b) or true/' flix "list-not-increasing list-duplicate-month"
mutate F2-flix-list-pin "$corner/flix/src/Main.flix" 's/require(stackSha(raw)==pin,"month list pin");//' flix "wrong-list-hash"
mutate F3-flix-root-record "$chain/flix/src/Main.flix" 's/require((integer(r),integer(y),integer(m))==(sm,sy,sm),/require(true or (integer(r),integer(y),integer(m))==(sm,sy,sm),/' flix "root-mismatch start-record-mismatch"
mutate F4-flix-bridge-flag "$chain/flix/src/Main.flix" 's/monthIndex(b)-monthIndex(a)>1},List.zip(List.take(count-1,ms)/monthIndex(b)-monthIndex(a)>99},List.zip(List.take(count-1,ms)/' flix none
mutate F5-flix-adjacency "$chain/flix/src/Main.flix" 's/require((y,m)==(yy,mm),"chronological month adjacency");/require(true or (y,m)==(yy,mm),"chronological month adjacency");/' flix "skipped-month-with-edge bridge-edge-declares-skipped-month"
mutate F6-flix-start-ignored "$chain/flix/src/Main.flix" 's/let(sy,sm)=start;require/let(sy,sm)=if(true) (2026,5) else start;require/' flix start-2037-05
fi
echo "mutants: killed $ok, not killed or not applied $bad"
[[ $bad == 0 ]]
