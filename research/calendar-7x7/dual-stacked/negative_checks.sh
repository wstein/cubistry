#!/usr/bin/env bash
# Driver only: corrupts ONE item of the accepted variant-B context candidate at a time;
# each native checker must reject on its own (exit 1). Reasons are recorded, not trusted.
# Usage: negative_checks.sh FLIX_JAR OUT_DIR   (JULIA_BIN overrides julia)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
ev="$here/evidence"
mkdir -p "$out"
dag="$out/pr99-dag.tsv"
gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$dag"
P="$ev/print-B.tsv"
# Print corruptions.
awk -F'\t' -v OFS='\t' '$1==15{$7="dark"}1' "$P" > "$out/wrong-ink.print.tsv"
awk -F'\t' -v OFS='\t' '$1==15{$6="23/31"}1' "$P" > "$out/undeclared-pair.print.tsv"
awk -F'\t' -v OFS='\t' '$1==61{$6="31/24"}1' "$P" > "$out/reversed-pair.print.tsv"
awk -F'\t' -v OFS='\t' '$1==224{$6="30↶";$7="red"}1' "$P" > "$out/restored-overflow.print.tsv"
awk -F'\t' -v OFS='\t' '$1==2{$6="";$7="blank"}1' "$P" > "$out/blank-month-letter.print.tsv"
awk -F'\t' -v OFS='\t' '$1==16{n=split($5,v,",");$5="";for(i=1;i<=n;i++){$5=$5(i>1?",":"")(v[i]==0?0:-v[i])}}1' "$P" > "$out/flipped-up.print.tsv"
# DAG corruptions: swap two roots; invert the root of a folded target (target 5).
a=$(awk -F'\t' '$1=="result"&&$2==1{print $3}' "$dag"); b=$(awk -F'\t' '$1=="result"&&$2==2{print $3}' "$dag")
awk -F'\t' -v OFS='\t' -v a="$a" -v b="$b" '$1=="result"&&$2==1{$3=b}$1=="result"&&$2==2{$3=a}1' "$dag" > "$out/swapped-roots.dag.tsv"
awk -F'\t' -v OFS='\t' '$1=="result"&&$2==5{$3=-$3}1' "$dag" > "$out/inverted-folded-root.dag.tsv"
printf 'case\tjulia-exit\tflix-exit\treason (julia | flix)\n' > "$out/results.tsv"
run_case() {
    name=$1; print=$2; case_dag=$3; variant=$4; mode=$5
    js=0; "$julia_bin" --startup-file=no "$here/check_stacked.jl" "$print" "$case_dag" "$variant" "$mode" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Xmx8g -jar "$jar" "$print" "$case_dag" "$variant" "$mode" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    jr=$(grep -m1 'INVALID' "$out/$name.julia.stderr" | sed 's/^INVALID\t//' | cut -c1-160 || true)
    fr=$(grep -hm1 '^invalid' "$out/$name.flix.stdout" | sed 's/^invalid\t//' | cut -c1-160 || true)
    printf '%s\t%s\t%s\t%s | %s\n' "$name" "$js" "$fs" "$jr" "$fr" >> "$out/results.tsv"
    if [ "$js" -ne 1 ] || [ "$fs" -ne 1 ]; then
        printf 'UNKNOWN: unexpected native result for %s: Julia=%s Flix=%s\n' "$name" "$js" "$fs" >&2
        status=1
    fi
}
status=0
run_case wrong-ink            "$out/wrong-ink.print.tsv"          "$dag" B context
run_case undeclared-pair      "$out/undeclared-pair.print.tsv"    "$dag" B context
run_case reversed-pair        "$out/reversed-pair.print.tsv"      "$dag" B context
run_case restored-overflow    "$out/restored-overflow.print.tsv"  "$dag" B context
run_case blank-month-letter   "$out/blank-month-letter.print.tsv" "$dag" B context
run_case flipped-up           "$out/flipped-up.print.tsv"         "$dag" B context
run_case swapped-roots        "$P" "$out/swapped-roots.dag.tsv"        B context
run_case inverted-folded-root "$P" "$out/inverted-folded-root.dag.tsv" B context
run_case wrong-variant        "$P" "$dag" A context
run_case unknown-mode         "$P" "$dag" B loose
cat "$out/results.tsv"
exit $status
