#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Driver only: the decision is made by the checker. Runs one checker on the valid
# strict print and moves, on six negative controls (the same controls as
# ../upright-moves/negative_controls.sh) and on two alias controls (the strict print with
# the letter O printed as the digit 0, and with the letter I printed as the digit 1).
# The valid input must be ACCEPTED (exit 0 and ACCEPT_ALL_91); every control must be
# REJECTED (exit non-zero and the stated reason), except that the two alias controls are
# ACCEPTED when CONTROLS_RULE=legacy (the legacy rule folds O to 0 and I to 1) and
# REJECTED otherwise (default CONTROLS_RULE=strict). The alias controls are what tells
# the two rules apart; the old-print control only tests sticker positions.
# Usage: [CONTROLS_RULE=strict|legacy] controls.sh OUT_TSV CHECKER...
# CHECKER... is a command prefix; PRINT and MOVES_TSV are appended.
# Exit code 1 if any line is not as expected.
set -u
out=${1:?OUT_TSV required}; shift
here=$(cd -- "$(dirname -- "$0")" && pwd)
print=$here/../upright-feasibility/evidence/print-strict-upright.tsv
old=$here/../pure-split-states/evidence/print-pure-A.tsv
moves=$here/../upright-moves/evidence/moves-strict.tsv
tmp=$(mktemp -d); bad=0
printf 'control\texpect\texit\tresult\tverdict\n' > "$out"
check() {
    name=$1; expect=$2; p=$3; m=$4; shift 4
    "$@" "$p" "$m" > "$tmp/o.txt" 2> "$tmp/e.txt"; code=$?
    verdict=$(cat "$tmp/o.txt" "$tmp/e.txt" | grep -E 'move-verdict|invalid|ERROR|Exception' | head -1 | tr '\t' ' ' | cut -c1-140)
    if [ "$expect" = ACCEPT ]; then
        if [ "$code" = 0 ] && grep -q ACCEPT_ALL_91 "$tmp/o.txt"; then r=PASS; else r=FAIL; fi
    else
        if [ "$code" != 0 ] && cat "$tmp/o.txt" "$tmp/e.txt" | grep -Eq "$expect"; then r=PASS; else r=FAIL; fi
    fi
    [ "$r" = PASS ] || bad=$((bad+1))
    printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$expect" "$code" "$r" "$verdict" >> "$out"
}
check valid ACCEPT "$print" "$moves" "$@"
# 1. the pure-split A print: a POSITIONS control only (different sticker layout, so every rule
#    rejects it); it does not discriminate between the strict and the legacy rule.
check old-print REJECT "$old" "$moves" "$@"
# 2. one move dropped from the word of display 1.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{n=split($6,w,","); s=w[2]; for(i=3;i<=n;i++) s=s","w[i]; $6=s} {print}' "$moves" > "$tmp/drop.tsv"
check drop-first-move REJECT "$print" "$tmp/drop.tsv" "$@"
# 3. the words of displays 1 and 2 swapped.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{a=$6} NR==3{b=$6} {l[NR]=$0; w[NR]=$6} END{for(i=1;i<=NR;i++){ if(i==2||i==3){split(l[i],f,"\t"); f[6]=(i==2?b:a); print f[1],f[2],f[3],f[4],f[5],f[6],f[7]} else print l[i]}}' "$moves" > "$tmp/swap.tsv"
check swap-two-words REJECT "$print" "$tmp/swap.tsv" "$@"
# 4. a layer-0 style generator (22) is not a legal move.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$6=$6",22"} {print}' "$moves" > "$tmp/g22.tsv"
check generator-22 'generator outside' "$print" "$tmp/g22.tsv" "$@"
# 5. the declared HTM is wrong.
awk -F'\t' 'BEGIN{OFS="\t"} NR==2{$5=$5+1} {print}' "$moves" > "$tmp/htm.tsv"
check wrong-htm REJECT "$print" "$tmp/htm.tsv" "$@"
# 6. display 3 listed twice (91 rows, 90 distinct boards).
awk -F'\t' 'BEGIN{OFS="\t"} NR==3{$1=3;$2=2026;$3=3} {print}' "$moves" > "$tmp/dup.tsv"
check duplicate-display 'duplicates' "$print" "$tmp/dup.tsv" "$@"
# 7. alias controls: O printed as 0, I printed as 1 (text column only). The legacy rule
#    treats these as the same glyph, the strict rule does not.
alias_expect=REJECT; [ "${CONTROLS_RULE:-strict}" = legacy ] && alias_expect=ACCEPT
awk -F'\t' 'BEGIN{OFS="\t"} NR>1{gsub(/O/,"0",$6)} {print}' "$print" > "$tmp/alias-o.tsv"
check alias-O-to-0 "$alias_expect" "$tmp/alias-o.tsv" "$moves" "$@"
awk -F'\t' 'BEGIN{OFS="\t"} NR>1{gsub(/I/,"1",$6)} {print}' "$print" > "$tmp/alias-i.tsv"
check alias-I-to-1 "$alias_expect" "$tmp/alias-i.tsv" "$moves" "$@"
rm -rf "$tmp"; cat "$out"
if [ "$bad" = 0 ]; then printf "controls-verdict\tALL_AS_EXPECTED\n"; else printf "controls-verdict\t%s_UNEXPECTED\n" "$bad"; exit 1; fi
