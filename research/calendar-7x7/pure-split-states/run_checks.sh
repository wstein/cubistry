#!/usr/bin/env bash
# Driver only: Julia and Flix each decide on their own. Usage: run_checks.sh FLIX_JAR OUT_DIR
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
mkdir -p "$out"
gzip -dc "$here/evidence/dag-all.tsv.gz" > "$out/dag-all.tsv"
gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$out/pr99-dag.tsv"
printf 'case\ttargets\tjulia-exit\tflix-exit\treceipts\tsummary\n' > "$out/cases.tsv"
record() {
    name=$1; targets=$2; js=$3; fs=$4
    grep '^pure-' "$out/$name.julia.stdout" > "$out/$name.julia.tsv" || true
    grep '^pure-' "$out/$name.flix.stdout" > "$out/$name.flix.tsv" || true
    same=DIFFERENT; cmp -s "$out/$name.julia.tsv" "$out/$name.flix.tsv" && same=IDENTICAL
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$targets" "$js" "$fs" "$same" "$(grep -E '^pure-(summary|matchability)' "$out/$name.julia.tsv" | tr '\t' ' ')" >> "$out/cases.tsv"
}
run_case() {
    name=$1; dag=$2; targets=$3
    js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" "$here/evidence/print-pure-A.tsv" "$dag" "$targets" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" "$here/evidence/print-pure-A.tsv" "$dag" "$targets" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    record "$name" "$targets" "$js" "$fs"
}
js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" matchability "$here/evidence/print-pure-A.tsv" > "$out/matchability.julia.stdout" 2> "$out/matchability.julia.stderr" || js=$?
fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" matchability "$here/evidence/print-pure-A.tsv" "$cal/english/evidence" > "$out/matchability.flix.stdout" 2> "$out/matchability.flix.stderr" || fs=$?
record matchability - "$js" "$fs"
run_case new-dag-all "$out/dag-all.tsv" all
run_case pr99-dag-all "$out/pr99-dag.tsv" all
cat "$out/cases.tsv"
# The 2027 chain (January to December, one retained state) under both chain verifiers.
js=0; "$julia_bin" --startup-file=no "$here/pure_chain.jl" "$here/evidence/print-pure-A.tsv" "$out/dag-all.tsv" "$here/evidence/chain-2027.moves.tsv" > "$out/chain-2027.julia.stdout" 2> "$out/chain-2027.julia.stderr" || js=$?
fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" chain "$here/evidence/print-pure-A.tsv" "$out/dag-all.tsv" "$here/evidence/chain-2027.moves.tsv" "$cal/english/evidence" "$cal/en-physical-review" > "$out/chain-2027.flix.stdout" 2> "$out/chain-2027.flix.stderr" || fs=$?
grep -E '^(source|edge|metrics|endpoint|status)' "$out/chain-2027.julia.stdout" > "$out/chain-2027.julia.tsv" || true
grep -E '^(source|edge|metrics|endpoint|status)' "$out/chain-2027.flix.stdout" > "$out/chain-2027.flix.tsv" || true
same=DIFFERENT; cmp -s "$out/chain-2027.julia.tsv" "$out/chain-2027.flix.tsv" && same=IDENTICAL
printf '%s\t%s\t%s\t%s\t%s\t%s\n' chain-2027 2027 "$js" "$fs" "$same" "$(grep '^status' "$out/chain-2027.julia.tsv" | tr '\t' ' ')" >> "$out/cases.tsv"
tail -n 1 "$out/cases.tsv"
