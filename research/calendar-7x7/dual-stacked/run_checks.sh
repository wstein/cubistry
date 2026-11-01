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
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" "$print" "$dag" "$variant" "$mode" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
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
run_inventory() {
    variant=$1; mode=$2; name=inventory-$(printf %s "$variant" | tr ",;=" "__-")-$mode
    js=0; "$julia_bin" --startup-file=no "$here/check_stacked.jl" inventory "$variant" "$mode" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" inventory "$variant" "$mode" "$cal/english/evidence" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    grep "^stacked-" "$out/$name.julia.stdout" > "$out/$name.julia.tsv" || true
    grep "^stacked-" "$out/$name.flix.stdout" > "$out/$name.flix.tsv" || true
    same=DIFFERENT; cmp -s "$out/$name.julia.tsv" "$out/$name.flix.tsv" && same=IDENTICAL
    summary=$(grep "^stacked-inventory" "$out/$name.julia.tsv" | tr "\t" " " || true)
    printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$name" "$variant" "$mode" "$js" "$fs" "$same" "$summary" >> "$out/cases.tsv"
}
for v in W A B; do for m in strict context; do run_inventory "$v" "$m"; done; done
run_case mix-F31bfold-strict           "$ev/print-mix-F31bfold.tsv"            "$out/pr99-dag.tsv" "F31=bfold,S30=keep,S31=keep"   strict
run_case mix-S30bfold-S31bfold-strict   "$ev/print-mix-S30bfold-S31bfold.tsv"   "$out/pr99-dag.tsv" "F31=keep,S30=bfold,S31=bfold"   strict
run_case mix-S30bfold-S31bfold30-strict "$ev/print-mix-S30bfold-S31bfold30.tsv" "$out/pr99-dag.tsv" "F31=keep,S30=bfold,S31=bfold30" strict
# Pure split (row 18) with month-letter placements, and the C* reference rows.
for v in "F31=bfold,S30=bfold,S31=bfold;H=555555555111" "F31=bfold,S30=bfold,S31=bfold;H=555555555222" "F31=bfold,S30=bfold,S31=bfold;H=555555555544" "F31=bfold,S30=bfold,S31=bfold;H=545555554544" "F31=bfold,S30=bfold,S31=bfold;H=434444443433" "F31=keep,S30=keep,S31=keep" "F31=keep,S30=keep,S31=bfold" "F31=keep,S30=keep,S31=bfold30" "F31=bfold,S30=keep,S31=keep" "F31=bfold,S30=keep,S31=bfold31"; do run_inventory "$v" strict; done
run_case pure-H555555555222-strict "$ev/print-pure-H555555555222.tsv" "$out/pr99-dag.tsv" "F31=bfold,S30=bfold,S31=bfold;H=555555555222" strict
run_case pure-H555555555544-strict "$ev/print-pure-H555555555544.tsv" "$out/pr99-dag.tsv" "F31=bfold,S30=bfold,S31=bfold;H=555555555544" strict
# All 30 split-month combinations, both readings, in one run per checker.
js=0; "$julia_bin" --startup-file=no "$here/check_stacked.jl" inventory-all > "$out/inventory-all.julia.stdout" 2> "$out/inventory-all.julia.stderr" || js=$?
fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" inventory-all "$cal/english/evidence" > "$out/inventory-all.flix.stdout" 2> "$out/inventory-all.flix.stderr" || fs=$?
grep "^stacked-" "$out/inventory-all.julia.stdout" > "$out/inventory-all.julia.tsv" || true
grep "^stacked-" "$out/inventory-all.flix.stdout" > "$out/inventory-all.flix.tsv" || true
same=DIFFERENT; cmp -s "$out/inventory-all.julia.tsv" "$out/inventory-all.flix.tsv" && same=IDENTICAL
printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" inventory-all 30-mixes both "$js" "$fs" "$same" "$(grep -c "^stacked-inventory" "$out/inventory-all.julia.tsv") inventory lines" >> "$out/cases.tsv"
cat "$out/cases.tsv"
