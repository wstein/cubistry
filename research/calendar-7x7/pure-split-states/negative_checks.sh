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
dag="$out/dag-all.tsv"; gzip -dc "$here/evidence/dag-all.tsv.gz" > "$dag"
orig="$out/pr99-dag.tsv"; gzip -dc "$cal/en-physical-review/all-targets-dag.tsv.gz" > "$orig"
jan=13
# Print corruptions.
awk -F'\t' -v OFS='\t' '$1==4{$6="";$7="blank"}1' "$P" > "$out/blank-stacked-dark.print.tsv"
awk -F'\t' -v OFS='\t' '$1==219{n=split($4,nv,",");split($5,uv,",");$5=(nv[2]*uv[3]-nv[3]*uv[2])","(nv[3]*uv[1]-nv[1]*uv[3])","(nv[1]*uv[2]-nv[2]*uv[1])}1' "$P" > "$out/rotated-stacked-red.print.tsv"
awk -F'\t' -v OFS='\t' '$1==5{$2=$2+1}1' "$P" > "$out/identity-changed.print.tsv"
# Midge redesign undone: surfaces 35 and 70 get back their artwork and frames from the
# stage-1 print (evidence/print-stage1.tsv), under which display 72 has no cubie matching.
awk -F'\t' 'NR==FNR{if($1==35||$1==70)row[$1]=$0;next}($1 in row){print row[$1];next}1' "$here/evidence/print-stage1.tsv" "$P" > "$out/midge-undone.print.tsv"
# DAG corruptions: January 2027 back on its PR #99 root; first appended product inverted.
oroot=$(awk -F'\t' -v I="$jan" '$1=="result"&&$2==I{print $3}' "$orig")
awk -F'\t' -v OFS='\t' -v I="$jan" -v R="$oroot" '$1=="result"&&$2==I{$3=R}1' "$dag" > "$out/unrepaired-root.dag.tsv"
maxorig=$(awk -F'\t' '$1=="product"{if($2+0>m)m=$2+0}END{print m}' "$orig")
awk -F'\t' -v OFS='\t' -v M="$maxorig" '$1=="product"&&$2+0>M&&!d{$4=-$4;d=1}1' "$dag" > "$out/flipped-product.dag.tsv"
printf 'case\tjulia-exit\tflix-exit\treason (julia | flix)\tfirst failing target (julia | flix)\n' > "$out/results.tsv"
status=0
note() {
    name=$1; js=$2; fs=$3
    jr=$(grep -m1 'INVALID' "$out/$name.julia.stderr" | sed 's/^INVALID\t//' | cut -c1-160 || true)
    fr=$(grep -hm1 '^invalid' "$out/$name.flix.stdout" | sed 's/^invalid\t//' | cut -c1-160 || true)
    jf=$(grep -m1 -E '^pure-(target.*	FAIL	|unmatched)' "$out/$name.julia.stdout" | cut -f2- | tr '\t' ' ' || true)
    ff=$(grep -m1 -E '^pure-(target.*	FAIL	|unmatched)' "$out/$name.flix.stdout" | cut -f2- | tr '\t' ' ' || true)
    printf '%s\t%s\t%s\t%s | %s\t%s | %s\n' "$name" "$js" "$fs" "$jr" "$fr" "$jf" "$ff" >> "$out/results.tsv"
    if [ "$js" -ne 1 ] || [ "$fs" -ne 1 ]; then printf 'UNKNOWN: unexpected native result for %s\n' "$name" >&2; status=1; fi
}
run_case() {
    name=$1; print=$2; case_dag=$3; targets=$4
    js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" "$print" "$case_dag" "$targets" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" "$print" "$case_dag" "$targets" "$cal/english/evidence" "$cal/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    note "$name" "$js" "$fs"
}
run_match() {
    name=$1; print=$2
    js=0; "$julia_bin" --startup-file=no "$here/check_pure.jl" matchability "$print" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" matchability "$print" "$cal/english/evidence" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    note "$name" "$js" "$fs"
}
run_case  blank-stacked-dark  "$out/blank-stacked-dark.print.tsv"  "$dag" all
run_case  rotated-stacked-red "$out/rotated-stacked-red.print.tsv" "$dag" all
run_case  identity-changed    "$out/identity-changed.print.tsv"    "$dag" all
run_case  midge-undone        "$out/midge-undone.print.tsv"        "$dag" all
run_match midge-undone-matchability "$out/midge-undone.print.tsv"
run_case  unrepaired-root     "$P" "$out/unrepaired-root.dag.tsv"  all
run_case  flipped-product     "$P" "$out/flipped-product.dag.tsv"  all
run_case  bad-target-id       "$P" "$dag" "0,$jan"
run_case  duplicate-targets   "$P" "$dag" "$jan,$jan"
cat "$out/results.tsv"
exit $status
