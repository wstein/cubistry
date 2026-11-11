#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of the month-list logic, applied to a scratch copy of research/calendar-7x7 (never the worktree).
#   run_month_list_mutants.sh JULIA JAVA OUT [julia|flix|all]
# Each mutant must make the named test fail (MUT_ONLY="J8 F4" runs only those ids). Flix mutants rebuild the chain jar (about 2 minutes each).
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
t4() { ONLY="$1" "$chain/run_root_best_effort_checks.sh" "$J" "$JAVA" "$out/jar/artifact/jar.jar" "$out/run" > "$out/t.log" 2>&1; }
t5() { "$J" --startup-file=no "$chain/test_stage_coverage.jl" > "$out/t.log" 2>&1; }
t6() { "$J" --startup-file=no "$chain/test_best_effort.jl" > "$out/t.log" 2>&1; }
mutate() { # id file sed-expr test-kind [ONLY list]
    local id=$1 f=$2 expr=$3 kind=$4 only=${5:-none}
    if [[ -n "${MUT_ONLY:-}" && " $MUT_ONLY " != *" ${id%%-*} "* ]]; then return; fi      # MUT_ONLY="J8 F4": run only these mutant ids
    cp "$f" "$f.orig"; sed -i "$expr" "$f"
    if cmp -s "$f" "$f.orig"; then echo "NOT-APPLIED $id"; mv "$f.orig" "$f"; bad=$((bad+1)); return; fi
    if [[ $kind == flix || $kind == flix4 ]]; then
        rm -rf "$out/jar-build" "$out/jar/artifact/jar.jar"; CALENDAR7_CHAIN_FLIX_BUILD_DIR="$out/jar-build" bash "$chain/flix/build.sh" > "$out/build.log" 2>&1 || true
        if ! cp "$out/jar-build/artifact/"*.jar "$out/jar/artifact/jar.jar" 2>/dev/null; then echo "NOT-BUILT $id"; mv "$f.orig" "$f"; bad=$((bad+1)); return; fi
    fi
    rm -rf "$out/run"
    if [[ $kind == t1 ]]; then t1; elif [[ $kind == t3 ]]; then t3; elif [[ $kind == t5 ]]; then t5; elif [[ $kind == t6 ]]; then t6; elif [[ $kind == t4 || $kind == flix4 ]]; then t4 "$only"; else t2 "$only"; fi; local rc=$?
    mv "$f.orig" "$f"
    if [[ $rc != 0 ]]; then echo "KILLED   $id [$kind] $(grep -m1 -E "Fail|Error|accepted|rejected|differ|cmp:|EOF" "$out/t.log" | cut -c1-100)"; ok=$((ok+1)); else echo "SURVIVED $id"; bad=$((bad+1)); fi
}
# the unmutated Flix jar for the Julia-only mutants and the baseline
mkdir -p "$out/jar/artifact"
if [[ -n "${MUT_JAR:-}" ]]; then cp "$MUT_JAR" "$out/jar/artifact/jar.jar"      # MUT_JAR: prebuilt baseline chain jar (skips the baseline build)
else rm -rf "$out/jar-build"; CALENDAR7_CHAIN_FLIX_BUILD_DIR="$out/jar-build" bash "$chain/flix/build.sh" > "$out/build.log" 2>&1
cp "$out/jar-build/artifact/"*.jar "$out/jar/artifact/jar.jar"; fi
if [[ $which == julia || $which == all ]]; then
mutate J1-increasing-check "$corner/check.jl" 's/ms\[end\]<(y,mo)/true/' t1
mutate J2-list-hash-check "$corner/check.jl" 's/bytes2hex(sha256(bytes))==expected_sha/true/' t1
mutate J3-list-ignored "$corner/check.jl" 's/if isempty(path)/if true/' t1
mutate J4-bridge-detection "$corner/check.jl" 's/>1 for (a,b)/>9 for (a,b)/' t1
mutate J5-exclusive-window-end "$corner/check.jl" 's/@assert !haskey(ENV,"WINDOW_END") "month list and WINDOW_END are exclusive"/@assert true/' t1
mutate J6-root-record "$chain/check.jl" 's/@assert canonical_integer.(f\[2:4\])==\[sm,sy,sm\]/@assert true/' t2 "root-mismatch start-record-mismatch"
mutate J7-chain-adjacency "$chain/check.jl" 's/@assert (edge.year,edge.month)==(goal.year,goal.month)/@assert true/' t2 "skipped-month-with-edge bridge-edge-declares-skipped-month"
mutate J8-bridge-flag-output "$chain/check.jl" 's/>1 ? "\\tBRIDGE" : ""/>1 ? "" : ""/' t2 none
mutate J9-independent-next-member "$chain/verify_chain.jl" 's/y,m=LISTED ? NEXT\[(y,m)\] : /y,m=/' t2 none
mutate J10-independent-increasing "$chain/verify_chain.jl" 's/@assert isempty(out) || t>out\[end\]/@assert true/' t2 "list-not-increasing"
mutate J11-start-ignored-check "$chain/check.jl" 's/sy,sm=CHAIN_ROOT/sy,sm=(2026,5)/' t2 start-2037-05
mutate J12-start-ignored-independent "$chain/verify_chain.jl" 's/SY,SM=ROOTM /SY,SM=(2026,5) /' t2 start-2037-05
# root month separate from the first member of S, Hall witnesses, free start and junction digests
mutate R1-root-edge-ignored-check "$chain/check.jl" 's/^const ROOTED=CHAIN_ROOT!=WINDOW_LIST\[1\]/const ROOTED=false/' t4 "root-edge-2037-05 root-edge-zero-moves"
mutate R2-root-edge-ignored-independent "$chain/verify_chain.jl" 's/^const ROOTED=ROOTM!=FIRSTM/const ROOTED=false/' t4 "root-edge-2037-05 root-edge-zero-moves"
mutate H1-hall-deficiency-check "$chain/check.jl" 's/@assert d>=1 "Hall set has a deficiency"/@assert true "x"/' t4 best-effort-not-minimal
mutate H2-hall-count-check "$chain/check.jl" 's/@assert count(w->w in X,wrong)==d "wrong cells in a Hall set equal its deficiency"/@assert true "x"/' t6
mutate H3-hall-deficiency-independent "$chain/verify_chain.jl" 's/@assert d>=1 "Hall set has a deficiency"/@assert true "x"/' t4 best-effort-not-minimal
mutate N1-hall-duplicate-check "$chain/check.jl" 's/@assert !isempty(X) \&\& isempty(intersect(used,X)) "disjoint nonempty Hall sets"/@assert true "x"/' t4 best-effort-hall-duplicate
mutate N2-hall-duplicate-independent "$chain/verify_chain.jl" 's/@assert !isempty(X) \&\& isempty(intersect(used,X)) "disjoint nonempty Hall sets"/@assert true "x"/' t4 best-effort-hall-duplicate
mutate N3-hall-count-check "$chain/check.jl" 's/@assert count(w->w in X,wrong)==d "wrong cells in a Hall set equal its deficiency"/@assert true "x"/' t4 best-effort-count-gt-deficiency
mutate N4-hall-count-independent "$chain/verify_chain.jl" 's/@assert count(w->w in X,wrong)==d "wrong cells in a Hall set equal its deficiency"/@assert true "x"/' t4 best-effort-count-gt-deficiency
mutate N5-start-exponent-check "$chain/check.jl" 's/@assert 1<=g<=21 \&\& e in (-1,1,2) "legal start move"/@assert true "x"/' t4 stage-start-exponent-3
mutate N6-start-exponent-independent "$chain/verify_chain.jl" 's/@assert 1<=gen<=21 \&\& q in (-1,1,2) "start move"/@assert true "x"/' t4 stage-start-exponent-3
mutate H5-wrong-cells-independent "$chain/verify_chain.jl" 's/@assert bad==e.wrong "strict row-one-name front"/@assert true "x"/' t4 best-effort-unlisted-wrong
mutate S1-join-start-check "$chain/check.jl" 's/@assert(root==(JOIN_START=="identity" ? identity_digest : JOIN_START),"start junction digest")/@assert(true,"x")/' t4 "stage-wrong-start-digest stage-start-not-identity"
mutate S2-join-end-check "$chain/check.jl" 's/@assert(chain_digest(state)==(JOIN_END=="identity" ? identity_digest : JOIN_END),"end junction digest")/@assert(true,"x")/' t4 "stage-wrong-end-digest stage-end-not-identity"
mutate S3-join-start-independent "$chain/verify_chain.jl" 's/@assert(state_sha(state)==(JSTART=="identity" ? identity_hash : JSTART),"start junction digest")/@assert(true,"x")/' t4 "stage-wrong-start-digest stage-start-not-identity"
mutate S4-join-end-independent "$chain/verify_chain.jl" 's/@assert(state_sha(state)==(JEND=="identity" ? identity_hash : JEND),"end junction digest")/@assert(true,"x")/' t4 "stage-wrong-end-digest stage-end-not-identity"
mutate S5-start-moves-ignored-check "$chain/check.jl" 's/for (g,e) in something(startmoves,Tuple{Int,Int}\[\])/for (g,e) in Tuple{Int,Int}[]/' t4 "stage-free-start stage-join-both"
mutate S6-start-moves-ignored-independent "$chain/verify_chain.jl" 's/free && (state=apply_word(state,ch.startword))/free \&\& (state=state)/' t4 "stage-free-start stage-join-both"
mutate S7-free-front-check "$chain/check.jl" 's/state==decode_physical(source,p,action) && chain_front_ok(state,goals\[1\].board) (free/state==decode_physical(source,p,action) \&\& true (free/' t4 stage-front-not-first-member
mutate SC1-stage-digest-equality "$chain/stage_coverage.jl" 's/same=a.last==b.first \&\& a.finish==b.start/same=a.last==b.first/' t5
mutate SC2-stage-junction-lines "$chain/stage_coverage.jl" 's/(a.jend==a.finish \&\& b.jstart==b.start)/true/' t5
mutate SC3-stage-verifier-digest "$chain/verify_stage_coverage.jl" 's/ok=a.last==b.first \&\& a.fin==b.start/ok=a.last==b.first/' t5
mutate SC4-stage-distinct-files "$chain/stage_coverage.jl" 's/@assert realpath(a)!=realpath(b) /@assert true /' t5
mutate SC5-stage-verifier-distinct-files "$chain/verify_stage_coverage.jl" 's/@assert realpath(joinpath(evdir,j))!=realpath(joinpath(evdir,f)) /@assert true /' t5
mutate SC6-free-start-anchor "$chain/stage_coverage.jl" 's/(st\[i\].free ? "free_" : "")/""/' t5
mutate C5-coverage-distinct-files "$chain/verify_coverage.jl" 's/@assert realpath(a)!=realpath(b) "Julia and Flix receipts are distinct files"/@assert true "x"/' t3
mutate C1-coverage-run-break "$chain/month_coverage.jl" 's/idx(m)==idx(p)+1 || (push!/idx(m)==idx(p)+2 || (push!/' t3
mutate C2-coverage-before-root "$chain/month_coverage.jl" 's/i in inlist) for i in idx(FIRST)/true) for i in idx(FIRST)/' t3
mutate C3-verify-receipts-identical "$chain/verify_coverage.jl" 's/@assert read(a)==read(b) "Julia and Flix receipts byte-identical"/@assert true/' t3
mutate C4-coverage-start-ignored "$chain/month_coverage.jl" 's/function coverage(ms,status,last,START,ROOT,best)/function coverage(ms,status,last,START0,ROOT,best)\n    START=(2026,5)/' t3
fi
if [[ $which == flix || $which == all ]]; then
mutate F1-flix-increasing "$corner/flix/src/Main.flix" 's/monthIndex(a)<monthIndex(b)/monthIndex(a)<monthIndex(b) or true/' flix "list-not-increasing list-duplicate-month"
mutate F2-flix-list-pin "$corner/flix/src/Main.flix" 's/require(stackSha(raw)==pin,"month list pin");//' flix "wrong-list-hash"
mutate F3-flix-root-record "$chain/flix/src/Main.flix" 's/require((integer(r),integer(y),integer(m))==(sm,sy,sm),/require(true or (integer(r),integer(y),integer(m))==(sm,sy,sm),/' flix "root-mismatch start-record-mismatch"
mutate F4-flix-bridge-flag "$chain/flix/src/Main.flix" 's/monthIndex(b)-monthIndex(a)>1) "\\tBRIDGE"/monthIndex(b)-monthIndex(a)>99) "\\tBRIDGE"/' flix none
mutate F5-flix-adjacency "$chain/flix/src/Main.flix" 's/require((y,m)==(yy,mm),"chronological month adjacency");/require(true or (y,m)==(yy,mm),"chronological month adjacency");/' flix "skipped-month-with-edge bridge-edge-declares-skipped-month"
mutate F6-flix-start-ignored "$chain/flix/src/Main.flix" 's/let(sy,sm)=start;require/let(sy,sm)=if(true) (2026,5) else start;require/' flix start-2037-05
mutate FR1-flix-root-edge-ignored "$chain/flix/src/Main.flix" 's/let rooted=monthsFile != "" and rootMonth != at(listed,0);/let rooted=false;/' flix4 "root-edge-2037-05 root-edge-zero-moves"
mutate FH1-flix-hall-deficiency "$chain/flix/src/Main.flix" 's/require(d>=1,"Hall set has a deficiency");/require(true or d>=1,"Hall set has a deficiency");/' flix4 best-effort-not-minimal
mutate FH2-flix-wrong-cells "$chain/flix/src/Main.flix" 's/let mism=wMismatch(next,goal);require(mism==wrong,/let mism=wMismatch(next,goal);require(true or mism==wrong,/' flix4 best-effort-unlisted-wrong
mutate NF1-flix-wrong-after-hall "$chain/flix/src/Main.flix" 's/require(halls==Nil,"wrong record after hall record");//' flix4 best-effort-wrong-after-hall
mutate NF2-flix-hall-duplicate "$chain/flix/src/Main.flix" 's/require(x != Nil and List.forAll(cell -> not List.memberOf(cell,acc),x),/require(true or x != Nil and List.forAll(cell -> not List.memberOf(cell,acc),x),/' flix4 best-effort-hall-duplicate
mutate NF3-flix-hall-count "$chain/flix/src/Main.flix" 's/require(List.count(w -> List.memberOf(w,x),wrong)==d,/require(true or List.count(w -> List.memberOf(w,x),wrong)==d,/' flix4 best-effort-count-gt-deficiency
mutate NF4-flix-start-exponent "$chain/flix/src/Main.flix" 's/require(g>=1 and g<=21 and List.memberOf(q,List#{-1,1,2}),"legal start move");/require(true,"legal start move");/' flix4 stage-start-exponent-3
mutate FS1-flix-join-start "$chain/flix/src/Main.flix" 's/require(root==(if(joinStart=="identity") identityDigest else joinStart),"start junction digest")/require(true,"start junction digest")/' flix4 "stage-wrong-start-digest stage-start-not-identity"
mutate FS2-flix-join-end "$chain/flix/src/Main.flix" 's/require(fd==(if(joinEnd=="identity") identityDigest else joinEnd),"end junction digest")/require(true,"end junction digest")/' flix4 "stage-wrong-end-digest stage-end-not-identity"
mutate FS3-flix-start-moves-ignored "$chain/flix/src/Main.flix" 's/let sm0=match startMoves {case Some(l) => l case None => Nil};/let sm0=match startMoves {case Some(_) => Nil case None => Nil};/' flix4 "stage-free-start stage-join-both"
fi
echo "mutants: killed $ok, not killed or not applied $bad"
[[ $bad == 0 ]]
