#!/usr/bin/env bash
# Flix cross-check and mutation tests. Needs: java 21, node, a Flix 0.79.0 jar in FLIX_JAR.
# Compares the Flix reports byte for byte with the Julia reports in ../results/ and checks four mutations.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); DT=$HERE/../..
: "${FLIX_JAR:?set FLIX_JAR to flix-0.79.0.jar}"
JAVA=${JAVA:-java}; NODE=${NODE:-node}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
cd "$HERE" && "$JAVA" -jar "$FLIX_JAR" build-fatjar >/dev/null 2>&1 || { echo "build failed"; exit 2; }
fx() { "$JAVA" -Dstdout.encoding=UTF-8 -jar "$HERE/artifact/flix.jar" "$@"; }
mkdir "$TMP/p" "$TMP/u" "$TMP/m"
"$NODE" "$HERE/../to-text.mjs" "$DT/witnesses/de-2.json" "$TMP/p"
"$NODE" "$HERE/../to-text.mjs" "$HERE/../witnesses/de-2-unpadded.json" "$TMP/u"
W="B2 R L' D2 U2 R L' B2 x2"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (got '$2', expected '$3')"; fail=1; fi; }
fx report "$TMP/p/printing.txt" "$TMP/p/targets.txt" padded > "$TMP/padded.rep"; check "padded report byte-equal" "$(cmp "$TMP/padded.rep" "$HERE/../results/de-2-padded.report" && echo same)" same
fx report "$TMP/u/printing.txt" "$TMP/u/targets.txt" unpadded > "$TMP/unpadded.rep"; check "unpadded report byte-equal" "$(cmp "$TMP/unpadded.rep" "$HERE/../results/de-2-unpadded.report" && echo same)" same
fx wcheck "$TMP/p/printing.txt" "$TMP/p/targets.txt" "$W" > "$TMP/w.rep"; check "W report byte-equal" "$(cmp "$TMP/w.rep" "$HERE/../results/w-check.report" && echo same)" same
# mutations: each must fail for the intended reason
fx wcheck "$TMP/p/printing.txt" "$TMP/p/targets.txt" "B R2 L2 B F' U2 D2 F' z2" > "$TMP/m/a" 2>&1; rc=$?
check "mutation z2 word: exit code 1" "$rc" 1; check "mutation z2 word: ok=0 of 756" "$(grep -c 'targets=756 ok=0$' "$TMP/m/a")" 1
fx wcheck "$TMP/p/printing.txt" "$TMP/p/targets.txt" "B U' D L' R F' B U' z' y'" > "$TMP/m/b" 2>&1; rc=$?
check "mutation wrong cycle direction: exit code 1" "$rc" 1; check "mutation wrong cycle direction: ok=0 of 756" "$(grep -c 'targets=756 ok=0$' "$TMP/m/b")" 1
fx report "$TMP/p/printing.txt" "$TMP/p/targets.txt" unpadded > "$TMP/m/c" 2>&1; rc=$?
check "mutation padded witness as unpadded: exit code 1" "$rc" 1; check "mutation padded as unpadded: failed=756" "$(grep -c 'failed=756 ' "$TMP/m/c")" 1
awk 'BEGIN{FS=OFS="\t"} NR==1{n=split(substr($3,2),a," "); s=""; for(i=1;i<n;i++) s=s (i>1?" ":"") a[i]; $3="#" s} {print}' "$TMP/p/targets.txt" > "$TMP/m/targets.txt"
fx report "$TMP/p/printing.txt" "$TMP/m/targets.txt" padded > "$TMP/m/d" 2>&1; rc=$?
check "mutation dropped last turn of target 1: exit code 1" "$rc" 1; check "mutation dropped turn: failed=1" "$(grep -c 'failed=1 ' "$TMP/m/d")" 1
exit $fail
