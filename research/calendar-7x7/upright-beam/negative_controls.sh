#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Driver only: the decision is made by verify_edges.jl. Each control must be REJECTED.
# Usage: negative_controls.sh JULIA EDGES_TSV OUT_TSV     (run from this directory)
set -u
julia=${1:-julia}; edges=${2:-evidence/edges-98.tsv}; out=${3:-evidence/negative-controls.tsv}
print=../upright-feasibility/evidence/print-strict-upright.tsv
old=../pure-split-states/evidence/print-pure-A.tsv
moves=../upright-moves/evidence/moves-strict.tsv
tmp=$(mktemp -d)
printf 'control\texit\tverdict\n' > "$out"
run() { name=$1; shift; "$julia" --startup-file=no verify_edges.jl "$@" > "$tmp/o.txt" 2>"$tmp/e.txt"; code=$?
  printf '%s\t%s\t%s\n' "$name" "$code" "$(grep -h 'edge-verdict\|Error' "$tmp/o.txt" "$tmp/e.txt" | head -1 | cut -c1-120)" >> "$out"; }
run valid "$print" "$moves" "$edges"
# 1. the old print (digit 0 / digit 1 aliases, old rule): the strict words must fail.
run old-print "$old" "$moves" "$edges"
# 2. first move of the first edge dropped.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{n=split($10,w,","); s=w[2]; for(i=3;i<=n;i++) s=s","w[i]; $10=s} {print}' "$edges" > "$tmp/drop.tsv"
run drop-first-move "$print" "$moves" "$tmp/drop.tsv"
# 3. the edge words of the first two edges swapped.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{a=$10} NR==3{b=$10} {l[NR]=$0} END{for(i=1;i<=NR;i++){ if(i==2||i==3){split(l[i],f,"\t"); f[10]=(i==2?b:a); print f[1],f[2],f[3],f[4],f[5],f[6],f[7],f[8],f[9],f[10]} else print l[i]}}' "$edges" > "$tmp/swap.tsv"
run swap-two-edge-words "$print" "$moves" "$tmp/swap.tsv"
# 4. generator 22 is not a legal move.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$10=$10",22"} {print}' "$edges" > "$tmp/g22.tsv"
run generator-22 "$print" "$moves" "$tmp/g22.tsv"
# 5. the declared HTM is wrong.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$7=$7+1} {print}' "$edges" > "$tmp/htm.tsv"
run wrong-htm "$print" "$moves" "$tmp/htm.tsv"
# 6. the edge claims another target month (edge 1 relabeled to the next month).
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$6=($6%12)+1} {print}' "$edges" > "$tmp/month.tsv"
run wrong-target-month "$print" "$moves" "$tmp/month.tsv"
# 7. the edge is applied to the wrong source display (source id of edge 1 replaced by 91).
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$1=91} {print}' "$edges" > "$tmp/src.tsv"
run wrong-source-display "$print" "$moves" "$tmp/src.tsv"
rm -rf "$tmp"; cat "$out"
