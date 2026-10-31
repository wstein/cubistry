#!/usr/bin/env bash
# Driver only: each native checker (Julia, Flix) makes its own decision.
# Usage: run_checks.sh FLIX_JAR OUT_DIR   (JULIA_BIN overrides julia)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
mkdir -p "$out"
gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$out/pr99-dag.tsv"
gzip -dc "$cal/dual-dates/evidence/candidate-dag.tsv.gz" > "$out/pr128-dag.tsv"
ev="$here/evidence"
printf 'case\tvariant\tmode\tjulia-exit\tflix-exit\treceipts\tsummary\n' > "$out/cases.tsv"
run_case() {
    name=$1; print=$2; dag=$3; variant=$4; mode=$5
    js=0; "$julia_bin" --startup-file=no "$here/check_stacked.jl" "$print" "$dag" "$variant" "$mode" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Xmx8g -jar "$jar" "$print" "$dag" "$variant" "$mode" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    grep '^stacked-' "$out/$name.julia.stdout" > "$out/$name.julia.tsv" || true
    grep '^stacked-' "$out/$name.flix.stdout" > "$out/$name.flix.tsv" || true
    same=DIFFERENT; cmp -s "$out/$name.julia.tsv" "$out/$name.flix.tsv" && same=IDENTICAL
    summary=$(grep '^stacked-summary' "$out/$name.julia.tsv" | tr '\t' ' ' || true)
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$variant" "$mode" "$js" "$fs" "$same" "$summary" >> "$out/cases.tsv"
}
p99="$cal/english/evidence/physical-print.tsv"
run_case B-context-candidate   "$ev/print-B.tsv" "$out/pr99-dag.tsv" B context
run_case B-strict-candidate    "$ev/print-B.tsv" "$out/pr99-dag.tsv" B strict
run_case A-context-candidate   "$ev/print-A.tsv" "$out/pr99-dag.tsv" A context
run_case A-strict-candidate    "$ev/print-A.tsv" "$out/pr99-dag.tsv" A strict
run_case B-context-pr99-print  "$p99" "$out/pr99-dag.tsv" B context
run_case A-context-pr99-print  "$p99" "$out/pr99-dag.tsv" A context
run_case W-context-pr99-print  "$p99" "$out/pr99-dag.tsv" W context
run_case W-context-pr128-pairs-pr99-dag  "$ev/print-W-pr128-pairs.tsv" "$out/pr99-dag.tsv" W context
run_case W-context-pr128-pairs-pr128-dag "$ev/print-W-pr128-pairs.tsv" "$out/pr128-dag.tsv" W context
cat "$out/cases.tsv"
