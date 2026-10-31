#!/usr/bin/env bash
# Native acceptance of a continuous calendar chain: the unchanged Julia verifier, the unchanged
# independent Flix verifier, byte-identical receipts, then five corruption controls that both
# verifiers must reject. Orchestration only; each verifier decides on its own. No Python.
# usage: verify.sh CHAIN.moves.tsv OUTDIR      (env: JULIA_BIN, CALENDAR7_CHAIN_FLIX_BUILD_DIR)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
R="$repo/research/calendar-7x7"
chain=${1:?chain file required}
out=${2:?output directory required}
julia=${JULIA_BIN:-julia}
build=${CALENDAR7_CHAIN_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-chain-flix}
mkdir -p "$out"
dag="$out/legal-dag.tsv"
[ -f "$dag" ] || gzip -dc "$R/en-physical-review/all-targets-dag.tsv.gz" > "$dag"
CALENDAR7_CHAIN_FLIX_BUILD_DIR="$build" bash "$R/continuous/flix/build.sh" > "$out/flix-build.log" 2>&1
jar="$build/artifact/flix.jar"

jv() { "$julia" --startup-file=no "$R/continuous/verify.jl" "$dag" "$1"; }
fv() { java -Xmx8g -jar "$jar" chain "$R/english/evidence" "$R/en-physical-review" "$dag" "$1"; }

jv "$chain" > "$out/receipt.julia.tsv"
fv "$chain" > "$out/flix-full.tsv"
n=$(wc -l < "$out/receipt.julia.tsv")
tail -n "$n" "$out/flix-full.tsv" > "$out/receipt.flix.tsv"
if cmp -s "$out/receipt.julia.tsv" "$out/receipt.flix.tsv"; then
    printf 'receipts\tIDENTICAL\t%s lines\t%s\n' "$n" "$(tail -1 "$out/receipt.julia.tsv" | tr '\t' ' ')"
else
    printf 'receipts\tDIFFER\n'; diff "$out/receipt.julia.tsv" "$out/receipt.flix.tsv" || true; exit 1
fi

# Corruption controls, built with awk/sed only. Each changes exactly one item of the last edge
# (or the source line) and must be rejected by both verifiers for the intended reason; the reasons are
# checked below and recorded. dropped-move and wrong-htm are caught by the declared-metrics check.
neg="$out/negative"; mkdir -p "$neg"
last=$(grep -n '^edge' "$chain" | tail -1 | cut -d: -f1)
flip() { awk -F'\t' -v OFS='\t' -v L="$1" -v F="$2" 'NR==L{$F=(substr($F,1,1)=="0"?"1":"0") substr($F,2)}1' "$chain"; }
flip "$last" 9 > "$neg/wrong-end-hash.tsv"
flip 2 5 > "$neg/wrong-source-hash.tsv"
awk -F'\t' -v OFS='\t' -v L="$last" 'NR==L{$4=$4+1}1' "$chain" > "$neg/wrong-htm.tsv"
mv10=$(awk -v L="$last" 'NR>L && /^move\t/{c++; if(c==10){print NR; exit}}' "$chain")
awk -v M="$mv10" 'NR!=M' "$chain" > "$neg/dropped-move.tsv"
# Sign flip of a +-1 layer quarter turn: declared HTM, QTM and rotation counts stay consistent, so only
# the state replay can catch it (sign-flipped-move is therefore NOT caught by the metrics check).
mvq=$(awk -F'\t' -v L="$last" 'NR>L && $1=="move" && $2%7!=0 && ($3==1||$3==-1){print NR; exit}' "$chain")
awk -F'\t' -v OFS='\t' -v M="$mvq" 'NR==M{$3=($3=="-1"?"1":"-1")}1' "$chain" > "$neg/sign-flipped-move.tsv"

printf 'control\tjulia-exit\tflix-exit\treason (julia | flix)\n' > "$out/negative-results.tsv"
status=0
# Expected rejection reasons (extended regular expressions matched against each verifier's message).
declare -A want_j want_f
want_j[wrong-end-hash]='physical hash mismatch';          want_f[wrong-end-hash]='destination full physical SHA mismatch'
want_j[wrong-source-hash]='Initial actual physical state'; want_f[wrong-source-hash]='initial full physical source SHA mismatch'
want_j[wrong-htm]='Declared transition metrics mismatch';  want_f[wrong-htm]='declared HTM/QTM/rotation metrics differ'
want_j[dropped-move]='Declared transition metrics mismatch'; want_f[dropped-move]='declared HTM/QTM/rotation metrics differ'
want_j[sign-flipped-move]='Front image mismatch|physical hash mismatch'; want_f[sign-flipped-move]='actual front art/orientation mismatch|destination full physical SHA mismatch'
for f in wrong-end-hash wrong-source-hash wrong-htm dropped-move sign-flipped-move; do
    jc=0; fc=0
    jv "$neg/$f.tsv" > "$neg/$f.julia.out" 2> "$neg/$f.julia.err" || jc=$?
    fv "$neg/$f.tsv" > "$neg/$f.flix.out" 2> "$neg/$f.flix.err" || fc=$?
    jr=$(grep -m1 'AssertionError' "$neg/$f.julia.err" | sed 's/.*AssertionError: //' || true)
    fr=$(grep -hm1 '^invalid' "$neg/$f.flix.out" | sed 's/^invalid\t//' || true)
    printf '%s\t%s\t%s\t%s | %s\n' "$f" "$jc" "$fc" "$jr" "$fr" | tee -a "$out/negative-results.tsv"
    { [ "$jc" -eq 1 ] && [ "$fc" -eq 1 ]; } || { echo "UNEXPECTED native decision for $f" >&2; status=1; }
    printf '%s' "$jr" | grep -Eq "${want_j[$f]}" || { echo "UNEXPECTED Julia reason for $f: $jr" >&2; status=1; }
    printf '%s' "$fr" | grep -Eq "${want_f[$f]}" || { echo "UNEXPECTED Flix reason for $f: $fr" >&2; status=1; }
done
exit $status
