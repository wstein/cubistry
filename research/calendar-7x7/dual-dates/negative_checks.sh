#!/usr/bin/env bash
# Driver only: each native checker makes its own acceptance decision.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
dag=${1:?Expanded candidate DAG path required}
jar=${2:?Native Flix jar required}
out=${3:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
evidence="$here/evidence"
english="$repo/research/calendar-7x7/english/evidence"
mkdir -p "$out"
# Corrupt only the named item; every other input stays the accepted candidate.
sed $'2s/\t8\t0\t1\t1$/\t8\t0\t1\t2/' "$evidence/dual-art.tsv" > "$out/wrong-turn.art.tsv"
awk -F'\t' -v OFS='\t' '$1==255{$6="DUAL_24_31"}1' "$evidence/physical-print.tsv" > "$out/wrong-label.print.tsv"
awk -F'\t' -v OFS='\t' 'NR==FNR{if($1==16)old=$0;next}$1==16{print old;next}1' "$english/physical-print.tsv" "$evidence/physical-print.tsv" > "$out/restored-surface.print.tsv"
awk -F'\t' -v OFS='\t' '$1==40{n=split($5,v,",");$5="";for(i=1;i<=n;i++){$5=$5(i>1?",":"")(v[i]==0?0:-v[i])}}1' "$evidence/physical-print.tsv" > "$out/flipped-up.print.tsv"
a=$(awk -F'\t' '$1=="result"&&$2==1{print $3}' "$dag"); b=$(awk -F'\t' '$1=="result"&&$2==2{print $3}' "$dag")
awk -F'\t' -v OFS='\t' -v a="$a" -v b="$b" '$1=="result"&&$2==1{$3=b}$1=="result"&&$2==2{$3=a}1' "$dag" > "$out/swapped-roots.dag.tsv"
# Two controls that reach the front check (the other five are caught earlier by exact-match checks of
# the table, labels and frames): a repaired target pointed back at its original, unrepaired root, and the
# sign of the first appended repair product flipped.
orig="$out/original-dag.tsv"
gzip -dc "$repo/research/calendar-7x7/en-physical-review/all-targets-dag.tsv.gz" > "$orig"
id=$(awk -F'\t' 'NR==FNR{if($1=="result")o[$2]=$3;next}$1=="result"&&o[$2]!=$3{print $2;exit}' "$orig" "$dag")
oroot=$(awk -F'\t' -v I="$id" '$1=="result"&&$2==I{print $3}' "$orig")
awk -F'\t' -v OFS='\t' -v I="$id" -v R="$oroot" '$1=="result"&&$2==I{$3=R}1' "$dag" > "$out/unrepaired-root.dag.tsv"
maxorig=$(awk -F'\t' '$1=="product"{if($2+0>m)m=$2+0}END{print m}' "$orig")
awk -F'\t' -v OFS='\t' -v M="$maxorig" '$1=="product"&&$2+0>M&&!d{$4=-$4;d=1}1' "$dag" > "$out/flipped-repair.dag.tsv"
printf 'case\tjulia-exit\tflix-exit\treason (julia | flix)\n' > "$out/results.tsv"
run_case() {
    name=$1; print=$2; art=$3; case_dag=$4
    julia_status=0
    "$julia_bin" --startup-file=no "$here/check_oriented.jl" "$print" "$art" "$case_dag" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || julia_status=$?
    flix_status=0
    java -Xmx8g -jar "$jar" "$print" "$art" "$case_dag" "$english" "$repo/research/calendar-7x7/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || flix_status=$?
    if [ "$julia_status" -ne 1 ] || [ "$flix_status" -ne 1 ]; then
        printf 'UNKNOWN: unexpected native result for %s: Julia=%s Flix=%s\n' "$name" "$julia_status" "$flix_status" >&2
        exit 1
    fi
    jr=$(grep -m1 'INVALID' "$out/$name.julia.stderr" | sed 's/^INVALID\t//' || true)
    fr=$(grep -hm1 '^invalid' "$out/$name.flix.stdout" | sed 's/^invalid\t//' || true)
    printf '%s\t%s\t%s\t%s | %s\n' "$name" "$julia_status" "$flix_status" "$jr" "$fr" >> "$out/results.tsv"
}
run_case wrong-turn "$evidence/physical-print.tsv" "$out/wrong-turn.art.tsv" "$dag"
run_case wrong-label "$out/wrong-label.print.tsv" "$evidence/dual-art.tsv" "$dag"
run_case restored-surface "$out/restored-surface.print.tsv" "$evidence/dual-art.tsv" "$dag"
run_case flipped-up "$out/flipped-up.print.tsv" "$evidence/dual-art.tsv" "$dag"
run_case swapped-roots "$evidence/physical-print.tsv" "$evidence/dual-art.tsv" "$out/swapped-roots.dag.tsv"
run_case unrepaired-root "$evidence/physical-print.tsv" "$evidence/dual-art.tsv" "$out/unrepaired-root.dag.tsv"
run_case flipped-repair "$evidence/physical-print.tsv" "$evidence/dual-art.tsv" "$out/flipped-repair.dag.tsv"
