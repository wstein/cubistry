#!/usr/bin/env bash
# Runs the native Julia checker and the independent Flix checker on an M/S
# witness, compares their receipts byte for byte, then runs negative controls
# through both checkers; each must be rejected for the intended reason (the
# REJECT message is compared, not only the exit code).
# Provenance: adapted from research/hm-counter-3move/checker/run-checks.sh at
# commit 9ca9f9e9fe6043cdec584c5394ef92a8634a487d.
# usage: checker/run-checks.sh WITNESS.tsv OUTDIR
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
witness=$1
out=$2
mkdir -p "$out"
julia=${JULIA:-${JULIA_BIN:-julia}}   # julia from PATH unless JULIA or JULIA_BIN is set
jar=${MS_FLIX_BUILD_DIR:-/tmp/cubistry-ms-counter-flix}/artifact/flix.jar

jl() { "$julia" --startup-file=no "$here/check.jl" "$1"; }
fx() { java -Xss512m -Xmx3g -jar "$jar" "$1" 2>/dev/null; }

jl "$witness" > "$out/receipt.julia.tsv"
fx "$witness" > "$out/receipt.flix.tsv"
if cmp -s "$out/receipt.julia.tsv" "$out/receipt.flix.tsv"; then
    echo "receipts	IDENTICAL	$(sha256sum < "$out/receipt.julia.tsv" | cut -c1-64)"
else
    echo "receipts	DIFFER"; diff "$out/receipt.julia.tsv" "$out/receipt.flix.tsv" || true; exit 1
fi

neg="$out/negative"; mkdir -p "$neg"
tab=$'\t'
# sticker rows are given in the M00 start state (M setup must be "-")
front_row() { awk -F'\t' -v p="$1" '$1=="sticker" && $4==p && $5=="0,0,1" {print NR; exit}' "$witness"; }
ur=$(front_row "1,1,1"); lr=$(front_row "1,-1,1"); ul=$(front_row "-1,1,1")
# two hidden (not front-facing) units stickers, 8 and 9 (units-only glyphs)
r8=$(awk -F'\t' '$1=="sticker" && $5!="0,0,1" && $7=="8" {print NR; exit}' "$witness")
r9=$(awk -F'\t' '$1=="sticker" && $5!="0,0,1" && $7=="9" {print NR; exit}' "$witness")

awk -F'\t' -v OFS='\t' -v r="$ur" 'NR==r{$7="S"}1' "$witness" > "$neg/glyph.tsv"
awk -F'\t' -v OFS='\t' -v r="$lr" 'NR==r{$6=($6=="0,1,0")?"1,0,0":"0,1,0"}1' "$witness" > "$neg/up.tsv"
awk -F'\t' -v OFS='\t' -v r="$ul" 'NR==r{$7="7"}1' "$witness" > "$neg/nonblank-ul.tsv"
awk -F'\t' -v OFS='\t' -v a="$r8" -v b="$r9" 'NR==a{$7="9"} NR==b{$7="8"}1' "$witness" > "$neg/hidden-glyph.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="5" {n=split($6,a," "); t=a[n]; if (t ~ /2$/) a[n]=substr(t,1,1); else if (t ~ /'"'"'$/) a[n]=substr(t,1,1)"2"; else a[n]=t"2"; s=a[1]; for(i=2;i<=n;i++) s=s" "a[i]; $6=s}1' "$witness" > "$neg/move.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="S" && $3=="7" {$7=$7+1}1' "$witness" > "$neg/lowerbound-high.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="S" && $3=="7" {$7=$7-1}1' "$witness" > "$neg/lowerbound-low.tsv"
awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3-1}1' "$witness" > "$neg/claim.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="59" {$6="-"}1' "$witness" > "$neg/truncated.tsv"
# wrong period boundary: claim twice the true M period (edges repeated)
awk -F'\t' -v OFS='\t' '
  $1=="run" && $2=="M" {p=$6; $6=2*p; print; inM=1; next}
  inM && $1=="edge" && $2=="M" {print; buf[n++]=$0; next}
  inM {for(i=0;i<n;i++){split(buf[i],f,"\t"); f[3]=f[3]+n; s=f[1]; for(j=2;j<=7;j++) s=s"\t"f[j]; print s}; inM=0}
  {print}' "$witness" > "$neg/period-double.tsv"
# wrong period boundary: claim a shorter period (the last cycle cut off)
awk -F'\t' -v OFS='\t' '$1=="run" && $2=="S" {p=$6; if (p>1) {$6=p-1}} {print}' "$witness" > "$neg/period-short.tsv"
# malformed numeric fields and an unknown glyph (parser robustness)
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="3" {$7="x1"}1' "$witness" > "$neg/integer-nonnumeric.tsv"
awk -F'\t' -v OFS='\t' '$1=="claim" {$3="99999999999999999999"}1' "$witness" > "$neg/integer-overflow.tsv"
awk -F'\t' -v OFS='\t' -v r="$lr" 'NR==r{$7="Q"}1' "$witness" > "$neg/glyph-alphabet.tsv"
speriod=$(awk -F'\t' '$1=="run" && $2=="S" {print $6}' "$witness")

controls=(
  "glyph|wrong glyph at cell 2 for M00 after setup"
  "up|glyph not upright at cell 4 for M00 after setup"
  "nonblank-ul|upper-left cell must show a blank sticker at M00 after setup"
  "hidden-glyph|M edge 7 (7->8)"
  "move|M edge 5 (5->6)"
  "lowerbound-high|claimed lower bound differs for S edge 7 (7->8)"
  "lowerbound-low|claimed lower bound differs for S edge 7 (7->8)"
  "claim|claimed maximum edge HTM differs from replay"
  "truncated|word shorter than graph distance for M edge 59 (59->0)"
  "period-double|period boundary: M returns to the start state before the claimed period"
  "integer-nonnumeric|integer field"
  "integer-overflow|integer field"
  "glyph-alphabet|glyph alphabet"
)
if [ "$speriod" -gt 1 ]; then
  controls+=("period-short|period boundary: S run does not return to the exact start state after the claimed period")
fi
status=0
for c in "${controls[@]}"; do
  name=${c%%|*}; want=${c#*|}
  for who in julia flix; do
    if [ $who = julia ]; then got=$(jl "$neg/$name.tsv" || true); else got=$(fx "$neg/$name.tsv" || true); fi
    line=$(printf '%s\n' "$got" | tail -n 1)
    if [[ "$line" == REJECT* && "$line" == *"$want"* ]]; then
      echo "negative	$name	$who	REJECTED	${line#REJECT$tab}"
    else
      echo "negative	$name	$who	UNEXPECTED	$line"; status=1
    fi
  done
done
exit $status
