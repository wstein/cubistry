#!/usr/bin/env bash
# Driver only: corrupts ONE item at a time; each native checker must exit 1 on its own.
# Usage: negative_checks.sh FLIX_JAR OUT_DIR   (JULIA_BIN overrides julia)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
mkdir -p "$out"
P="$here/evidence/print-pure-A.tsv"
dag="$out/dag-2027.tsv"; gzip -dc "$here/evidence/dag-2027.tsv.gz" > "$dag"
orig="$out/pr99-dag.tsv"; gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$orig"
T=$(cut -f3 "$here/evidence/synth-2027.tsv" | tail -n +2 | sort -un | paste -sd,)
jan=$(awk -F'\t' '$1==2027&&$2==1{print $3;exit}' "$here/evidence/synth-2027.tsv")
# Print corruptions.
awk -F'\t' -v OFS='\t' '$1==4{$6="";$7="blank"}1' "$P" > "$out/blank-stacked-dark.print.tsv"
awk -F'\t' -v OFS='\t' '$1==219{n=split($4,nv,",");split($5,uv,",");$5=(nv[2]*uv[3]-nv[3]*uv[2])","(nv[3]*uv[1]-nv[1]*uv[3])","(nv[1]*uv[2]-nv[2]*uv[1])}1' "$P" > "$out/rotated-stacked-red.print.tsv"
awk -F'\t' -v OFS='\t' '$1==5{$2=$2+1}1' "$P" > "$out/identity-changed.print.tsv"
# DAG corruptions: January back on its PR #99 root; first appended product inverted.
oroot=$(awk -F'\t' -v I="$jan" '$1=="result"&&$2==I{print $3}' "$orig")
awk -F'\t' -v OFS='\t' -v I="$jan" -v R="$oroot" '$1=="result"&&$2==I{$3=R}1' "$dag" > "$out/unrepaired-root.dag.tsv"
maxorig=$(awk -F'\t' '$1=="product"{if($2+0>m)m=$2+0}END{print m}' "$orig")
awk -F'\t' -v OFS='\t' -v M="$maxorig" '$1=="product"&&$2+0>M&&!d{$4=-$4;d=1}1' "$dag" > "$out/flipped-product.dag.tsv"
printf 'case\tjulia-exit\tflix-exit\treason (julia | flix)\tfirst failing target (julia | flix)\n' > "$out/results.tsv"
status=0
run_case() {
    name=$1; print=$2; case_dag=$3; targets=$4
    js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" "$print" "$case_dag" "$targets" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" "$print" "$case_dag" "$targets" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    jr=$(grep -m1 'INVALID' "$out/$name.julia.stderr" | sed 's/^INVALID\t//' | cut -c1-160 || true)
    fr=$(grep -hm1 '^invalid' "$out/$name.flix.stdout" | sed 's/^invalid\t//' | cut -c1-160 || true)
    jf=$(grep -m1 '^pure-target.*	FAIL	' "$out/$name.julia.stdout" | cut -f2,6-9 | tr '\t' ' ' || true)
    ff=$(grep -m1 '^pure-target.*	FAIL	' "$out/$name.flix.stdout" | cut -f2,6-9 | tr '\t' ' ' || true)
    printf '%s\t%s\t%s\t%s | %s\t%s | %s\n' "$name" "$js" "$fs" "$jr" "$fr" "$jf" "$ff" >> "$out/results.tsv"
    if [ "$js" -ne 1 ] || [ "$fs" -ne 1 ]; then printf 'UNKNOWN: unexpected native result for %s\n' "$name" >&2; status=1; fi
}
run_case blank-stacked-dark  "$out/blank-stacked-dark.print.tsv"  "$dag" "$T"
run_case rotated-stacked-red "$out/rotated-stacked-red.print.tsv" "$dag" "$T"
run_case identity-changed    "$out/identity-changed.print.tsv"    "$dag" "$T"
run_case unrepaired-root     "$P" "$out/unrepaired-root.dag.tsv"  "$T"
run_case flipped-product     "$P" "$out/flipped-product.dag.tsv"  "$T"
run_case bad-target-id       "$P" "$dag" "0,$jan"
run_case duplicate-targets   "$P" "$dag" "$jan,$jan"
cat "$out/results.tsv"
exit $status
