#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Regression and S2 receipts of the month-list checkers.
#   run_month_list_receipts.sh JULIA JAVA CHAIN_JAR CORNER_JAR WINDOW_JAR OUT
# A. WINDOW_END paths reproduce the committed receipts byte for byte (2028-01 chain with the independent verifier, 129-month
#    2037-01 print, corner receipts 2037-01 and 2037-02). The Flix print and corner jars take the window as a month list, so
#    their 129-month receipts are compared to the committed Flix receipts without the `months` line.
# B. S2 receipts (print list of 286 months, chain list of 283 months, Februaries 2026-02 and 2043-02): Julia and Flix
#    byte-identical, and identical to the committed receipts in evidence/month-list.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd); cal="$here/.."
julia_bin=${1:?Julia}; java_bin=${2:?Java}; chain_jar=${3:?chain jar}; corner_jar=${4:?corner jar}; window_jar=${5:?window jar}; out=${6:?scratch dir}
mkdir -p "$out"
layout="$cal/row1-revision/layout.tsv"; ev="$cal/english/evidence"; ce="$here/evidence"; w37="$ce/window-2037-01"; ml="$ce/month-list"
J() { "$julia_bin" --startup-file=no "$@"; }
F() { local jar=$1; shift; "$java_bin" -Xmx2g -jar "$jar" "$@"; }
# A1. 2028-01 chain
stored="$cal/row1-window-print/evidence/printing.tsv"
J "$here/check.jl" "$layout" "$stored" "$ce/moves.tsv" "$ce/states" | cmp - "$ce/julia.tsv"
F "$chain_jar" "$layout" "$stored" "$ce/moves.tsv" "$ce/states" "$ev" | cmp - "$ce/flix.tsv"
J "$here/verify_chain.jl" "$layout" "$stored" "$ce/moves.tsv" "$ce/states" | cmp - "$ce/independent.tsv"
echo "A1 2028-01 chain: Julia, Flix, independent byte-identical to the committed receipts"
# A2. 129-month print and corner receipts
WINDOW_END=2037-01 J "$cal/row1-window-print/check.jl" "$layout" "$w37/printing.tsv" "$w37/front-matches.tsv" | cmp - "$w37/print-julia.tsv"
for e in 2037-01 2037-02; do
    WINDOW_END=$e J "$cal/row1-corner-coupling/check.jl" "$layout" names-band window | cmp - "$w37/corner-$e-julia.tsv"
    : > "$out/cont-$e.tsv"; y=2026; m=5
    while :; do printf '%04d-%02d\n' $y $m >> "$out/cont-$e.tsv"; [[ $y-$(printf %02d $m) == $e ]] && break; m=$((m+1)); [[ $m -le 12 ]] || { m=1; y=$((y+1)); }; done
    pin=$(sha256sum "$out/cont-$e.tsv" | cut -d' ' -f1)
    F "$corner_jar" "$layout" names-band window "$ev" "$out/cont-$e.tsv" "$pin" | grep -v $'^months\t' | cmp - "$w37/corner-$e-flix.tsv"
    [[ $e != 2037-01 ]] || F "$window_jar" "$layout" "$w37/printing.tsv" "$w37/front-matches.tsv" "$ev" "$out/cont-$e.tsv" "$pin" | grep -v $'^months\t' | cmp - "$w37/print-flix.tsv"
done
echo "A2 129-month print and corner receipts 2037-01/2037-02: Julia byte-identical, Flix identical without the months line"
# A3. 21-month default print (no list): Julia and Flix
J "$cal/row1-window-print/check.jl" "$layout" "$stored" "$cal/row1-window-print/evidence/front-matches.tsv" > "$out/print21.julia.tsv"
F "$window_jar" "$layout" "$stored" "$cal/row1-window-print/evidence/front-matches.tsv" "$ev" > "$out/print21.flix.tsv"
cmp "$out/print21.julia.tsv" "$out/print21.flix.tsv"; cmp "$out/print21.julia.tsv" "$cal/row1-window-print/evidence/julia.tsv"
echo "A3 21-month print: Julia and Flix identical to the committed receipt"
# B. S2 receipts
pinof() { awk -v f="$1" '$2==f {print $1}' "$ml/sha256.txt"; }
sp="$ce/window-skip/printing-S2.tsv"; pl=$(pinof months-S2.tsv)
CAL7_WINDOW_MONTHS="$ml/months-S2.tsv" CAL7_WINDOW_MONTHS_SHA256=$pl J "$cal/row1-window-print/check.jl" "$layout" "$sp" "$ml/front-matches-S2.tsv" > "$out/print-S2-julia.tsv"
F "$window_jar" "$layout" "$sp" "$ml/front-matches-S2.tsv" "$ev" "$ml/months-S2.tsv" "$pl" > "$out/print-S2-flix.tsv"
cmp "$out/print-S2-julia.tsv" "$out/print-S2-flix.tsv"; cmp "$out/print-S2-julia.tsv" "$ml/print-S2-julia.tsv"; cmp "$out/print-S2-flix.tsv" "$ml/print-S2-flix.tsv"
for n in S2 S2-chain 2026-02 2043-02; do
    lf=months-$n.tsv; [[ $n == S2* ]] || lf=months-corner-$n.tsv
    p=$(pinof $lf)
    CAL7_WINDOW_MONTHS="$ml/$lf" CAL7_WINDOW_MONTHS_SHA256=$p J "$cal/row1-corner-coupling/check.jl" "$layout" names-band window > "$out/corner-$n-julia.tsv"
    F "$corner_jar" "$layout" names-band window "$ev" "$ml/$lf" "$p" > "$out/corner-$n-flix.tsv"
    cmp "$out/corner-$n-julia.tsv" "$out/corner-$n-flix.tsv"; cmp "$out/corner-$n-julia.tsv" "$ml/corner-$n-julia.tsv"; cmp "$out/corner-$n-flix.tsv" "$ml/corner-$n-flix.tsv"
done
grep -q $'^verdict\tUNKNOWN\t' "$out/corner-S2-julia.tsv"; grep -q $'^verdict\tUNKNOWN\t' "$out/corner-S2-chain-julia.tsv"
for n in 2026-02 2043-02; do grep -q $'^verdict\tUNSAT\tfixed-print-corner-body-matching\tunique-always-visible-face$' "$out/corner-$n-julia.tsv"; done
echo "B S2: print (286 months) and corner receipts for S2, S2-chain, 2026-02, 2043-02: Julia and Flix byte-identical and equal to the committed receipts"
