#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Compares this directory with the print of OLD_REF (April tiles APR+IL) through the label bijection
# APR -> AP, IL -> RIL. Usage: check-april-labels.sh [OLD_REF]; run from the repository root.
set -euo pipefail
old_ref=${1:-origin/research/cube-display-feasibility}
d=research/calendar-7x7/row1-window-chain/evidence/window-2037-01
layout_old=research/calendar-7x7/row1-revision/layout.tsv
fail=0; bad(){ echo "FAIL $*" >&2; fail=1; }
old(){ git show "$old_ref:$1"; }
# 1. collision: neither new label exists as a tile text in the old print or layout
old $d/printing.tsv | awk -F'\t' 'NR>1&&($6=="AP"||$6=="RIL"){c++} END{exit c>0}' || bad "AP/RIL already used in old print"
git show "$old_ref:$layout_old" | awk -F'\t' 'NR>1{for(i=2;i<=8;i++)if($i=="AP"||$i=="RIL")c++} END{exit c>0}' || bad "AP/RIL already used in old layout"
# 2. print: every line equals the old line after the bijection on column 6
map_print(){ awk -F'\t' -v OFS='\t' 'NR>1&&$6=="APR"{$6="AP"} NR>1&&$6=="IL"{$6="RIL"} {print}'; }
old $d/printing.tsv | map_print | cmp -s - $d/printing.tsv || bad "printing.tsv is not the bijection image of the old print"
# 3. front-matches carry no label text: byte-identical
old $d/front-matches.tsv | cmp -s - $d/front-matches.tsv || bad "front-matches.tsv changed"
# 4. window-local layout: only the April row differs
{ old $layout_old | awk -F'\t' -v OFS='\t' '$1==4{$2="AP";$3="RIL"} {print}'; } | cmp -s - $d/layout.tsv || bad "layout.tsv is not the old layout with April = AP, RIL"
# 5. receipts: equal after mapping, except the input line and the target hash column of April targets (hash covers text)
for r in print-julia print-flix corner-2037-01-julia corner-2037-01-flix corner-2037-02-julia corner-2037-02-flix; do
  old $d/$r.tsv | sed -E 's/\bAPR\b/AP/' > "${TMPDIR:-/tmp}/old-$r.$$"
  diff <(awk -F'\t' -v OFS='\t' '$1=="input"{next} $1=="target"&&$4==4&&NF==6{$6="H"} {print}' "${TMPDIR:-/tmp}/old-$r.$$") \
       <(awk -F'\t' -v OFS='\t' '$1=="input"{next} $1=="target"&&$4==4&&NF==6{$6="H"} {print}' $d/$r.tsv) >/dev/null || bad "$r.tsv differs beyond input line and April target hashes"
  rm -f "${TMPDIR:-/tmp}/old-$r.$$"
done
[[ $fail == 0 ]] && echo "OK april labels: print bijection, layout, receipts" || exit 1
