#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Driver only: the decision is made by verify_moves.jl. Each control must be REJECTED.
# Usage: negative_controls.sh JULIA OUT_TSV     (run from this directory)
set -u
julia=${1:-julia}; out=${2:-evidence/negative-controls.tsv}
print=../upright-feasibility/evidence/print-strict-upright.tsv
old=../pure-split-states/evidence/print-pure-A.tsv
moves=evidence/moves-strict.tsv
tmp=$(mktemp -d)
printf 'control\texit\tverdict\n' > "$out"
run() { name=$1; shift; "$julia" --startup-file=no verify_moves.jl "$@" > "$tmp/o.txt" 2>"$tmp/e.txt"; code=$?
  printf '%s\t%s\t%s\n' "$name" "$code" "$(grep -h 'move-verdict\|Error' "$tmp/o.txt" "$tmp/e.txt" | head -1 | cut -c1-120)" >> "$out"; }
run valid "$print" "$moves"
# 1. the pure-split A print (old rule, digit 0 / digit 1 aliases): the same words must fail.
run old-print "$old" "$moves"
# 2. one move dropped from the word of display 1.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{n=split($6,w,","); s=w[2]; for(i=3;i<=n;i++) s=s","w[i]; $6=s} {print}' "$moves" > "$tmp/drop.tsv"
run drop-first-move "$print" "$tmp/drop.tsv"
# 3. the words of displays 1 and 2 swapped.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{a=$6} NR==3{b=$6} {l[NR]=$0; w[NR]=$6} END{for(i=1;i<=NR;i++){ if(i==2||i==3){split(l[i],f,"\t"); f[6]=(i==2?b:a); print f[1],f[2],f[3],f[4],f[5],f[6],f[7]} else print l[i]}}' "$moves" > "$tmp/swap.tsv"
run swap-two-words "$print" "$tmp/swap.tsv"
# 4. a layer-0 style generator (22) is not a legal move.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$6=$6",22"} {print}' "$moves" > "$tmp/g22.tsv"
run generator-22 "$print" "$tmp/g22.tsv"
# 5. the declared HTM is wrong.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$5=$5+1} {print}' "$moves" > "$tmp/htm.tsv"
run wrong-htm "$print" "$tmp/htm.tsv"
# 6. a word of the right display count but display 3 listed twice (91 rows, 90 distinct).
awk -F'\t' 'BEGIN{OFS="\t"} NR==3{$2=$2; } {print}' "$moves" | awk -F'\t' 'BEGIN{OFS="\t"} NR==3{$1=3;$2=2026;$3=3} {print}' > "$tmp/dup.tsv"
run duplicate-display "$print" "$tmp/dup.tsv"
rm -rf "$tmp"; cat "$out"
