#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Driver only: the decision is made by the chain verifier behind RUNNER. The valid chain must
# be ACCEPTED and every mutated input REJECTED; exit 1 on any deviation.
#   chain_controls.sh OUT_TSV RUNNER CHAIN [PRINT [ROOT_MOVES]]       (run from this directory)
# RUNNER is chain_runner_julia.sh or chain_runner_flix.sh (PRINT CHAIN ROOT_MOVES; exit 0 only
# when the status line VALID_CONTINUOUS_CHAIN is printed). CHAIN is a strict chain with >= 2 edges.
set -u
out=$1; runner=$2; chain=$3
print=${4:-../upright-feasibility/evidence/print-strict-upright.tsv}
moves=${5:-../upright-moves/evidence/moves-strict.tsv}
old=../pure-split-states/evidence/print-pure-A.tsv
tmp=$(mktemp -d); bad=0
printf 'control\texpected\tverdict\texit\tdetail\n' > "$out"
run() { # name expected print chain moves
  local name=$1 want=$2 p=$3 c=$4 m=$5 code v
  "$runner" "$p" "$c" "$m" > "$tmp/o.txt" 2> "$tmp/e.txt"; code=$?
  if [ "$code" = 0 ] && grep -q $'^status\tVALID_CONTINUOUS_CHAIN' "$tmp/o.txt"; then v=ACCEPT; else v=REJECT; fi
  [ "$v" = "$want" ] || bad=1
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$want" "$v" "$code" "$(cat "$tmp/e.txt" "$tmp/o.txt" | grep -E 'INVALID|invalid|Error|status' | head -1 | cut -c1-140)" >> "$out"
}
run valid ACCEPT "$print" "$chain" "$moves"
# 1. the old print (pinned print digest and old glyphs).
run old-print REJECT "$old" "$chain" "$moves"
# 2. first move of the chain dropped (declared HTM no longer matches).
awk '/^move\t/ && !d {d=1; next} {print}' "$chain" > "$tmp/drop.tsv"
run drop-first-move REJECT "$print" "$tmp/drop.tsv" "$moves"
# 3. first move replaced by generator 22 (not a legal move).
awk -F'\t' 'BEGIN{OFS="\t"} /^move\t/ && !d {d=1; $2=22} {print}' "$chain" > "$tmp/g22.tsv"
run generator-22 REJECT "$print" "$tmp/g22.tsv" "$moves"
# 4. an extra quarter turn at the end of the first edge (declared metrics and hashes differ).
awk '/^end$/ && !d {d=1; print "move\t1\t1"} {print}' "$chain" > "$tmp/extra.tsv"
run extra-move REJECT "$print" "$tmp/extra.tsv" "$moves"
# 5. the first edge claims the month after next (not chronologically adjacent).
awk -F'\t' 'BEGIN{OFS="\t"} /^edge\t/ && !d {d=1; $3=($3%12)+1} {print}' "$chain" > "$tmp/month.tsv"
run non-adjacent-month REJECT "$print" "$tmp/month.tsv" "$moves"
# 6. the declared source month is not the month of the source display.
awk -F'\t' 'BEGIN{OFS="\t"} /^source\t/ {$4=($4%12)+1} {print}' "$chain" > "$tmp/srcm.tsv"
run wrong-source-month REJECT "$print" "$tmp/srcm.tsv" "$moves"
# 7. the source hash of the second edge replaced by the one of the first (reset/substitution).
awk -F'\t' 'BEGIN{OFS="\t"} /^edge\t/ {n++; if(n==1) h=$8; if(n==2) $8=h} {print}' "$chain" > "$tmp/hash.tsv"
run substituted-source-hash REJECT "$print" "$tmp/hash.tsv" "$moves"
# 8. the root word of the source display loses its first generator (wrong source state).
awk -F'\t' 'BEGIN{OFS="\t"} NR>1 && $1==25 {n=split($6,w,","); s=w[2]; for(i=3;i<=n;i++) s=s","w[i]; $6=s} {print}' "$moves" > "$tmp/root.tsv"
run wrong-root-word REJECT "$print" "$chain" "$tmp/root.tsv"
# 9. the first move turns another layer (same declared metrics, physical hashes differ).
awk -F'\t' 'BEGIN{OFS="\t"} /^move\t/ && !d {d=1; if($2%7!=0) $2=($2==1?2:1)} {print}' "$chain" > "$tmp/layer.tsv"
run other-layer-same-metrics REJECT "$print" "$tmp/layer.tsv" "$moves"
rm -rf "$tmp"; cat "$out"; exit $bad
