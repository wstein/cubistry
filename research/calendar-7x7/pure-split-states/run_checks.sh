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
gzip -dc "$here/evidence/dag-2027.tsv.gz" > "$out/dag-2027.tsv"
gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$out/pr99-dag.tsv"
targets_2027=$(cut -f3 "$here/evidence/synth-2027.tsv" | tail -n +2 | sort -un | paste -sd,)
printf 'case\ttargets\tjulia-exit\tflix-exit\treceipts\tsummary\n' > "$out/cases.tsv"
run_case() {
    name=$1; dag=$2; targets=$3
    js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" "$here/evidence/print-pure-A.tsv" "$dag" "$targets" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" "$here/evidence/print-pure-A.tsv" "$dag" "$targets" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    grep '^pure-' "$out/$name.julia.stdout" > "$out/$name.julia.tsv" || true
    grep '^pure-' "$out/$name.flix.stdout" > "$out/$name.flix.tsv" || true
    same=DIFFERENT; cmp -s "$out/$name.julia.tsv" "$out/$name.flix.tsv" && same=IDENTICAL
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$targets" "$js" "$fs" "$same" "$(grep '^pure-summary' "$out/$name.julia.tsv" | tr '\t' ' ')" >> "$out/cases.tsv"
}
run_case new-dag-2027 "$out/dag-2027.tsv" "$targets_2027"
run_case new-dag-all "$out/dag-2027.tsv" all
run_case pr99-dag-2027 "$out/pr99-dag.tsv" "$targets_2027"
cat "$out/cases.tsv"
