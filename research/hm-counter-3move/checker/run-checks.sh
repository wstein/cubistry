#!/usr/bin/env bash
# Runs the native Julia checker and the independent Flix checker on a witness,
# compares their receipts byte for byte, then runs negative controls on both.
# usage: checker/run-checks.sh WITNESS.tsv OUTDIR
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
witness=$1
out=$2
mkdir -p "$out"
julia=${JULIA:-/tmp/claude-0/julia/bin/julia}
jar=${HM_FLIX_BUILD_DIR:-/tmp/cubistry-hm-counter-flix}/artifact/flix.jar

jl() { "$julia" --startup-file=no "$here/check.jl" "$1"; }
fx() { java -Xss512m -Xmx3g -jar "$jar" "$1"; }

jl "$witness" > "$out/receipt.julia.tsv"
fx "$witness" > "$out/receipt.flix.tsv"
if cmp -s "$out/receipt.julia.tsv" "$out/receipt.flix.tsv"; then
    echo "receipts	IDENTICAL	$(sha256sum < "$out/receipt.julia.tsv" | cut -c1-64)"
else
    echo "receipts	DIFFER"; diff "$out/receipt.julia.tsv" "$out/receipt.flix.tsv" || true; exit 1
fi

# --- negative controls: each must be rejected by both checkers for the
# intended reason (substring of the REJECT line).
neg="$out/negative"; mkdir -p "$neg"
tab=$'\t'
# sticker row visible at a front cell in the reference state (= M00, setup "-")
front_row() { awk -F'\t' -v p="$1" '$1=="sticker" && $4==p && $5=="0,0,1" {print NR; exit}' "$witness"; }
ur=$(front_row "1,1,1"); lr=$(front_row "1,-1,1"); ul=$(front_row "-1,1,1")
profile=$(awk -F'\t' '$1=="profile"{print $2}' "$witness")

awk -F'\t' -v OFS='\t' -v r="$ur" 'NR==r{$7="H"}1' "$witness" > "$neg/glyph.tsv"
awk -F'\t' -v OFS='\t' -v r="$lr" 'NR==r{$6=($6=="0,1,0")?"1,0,0":"0,1,0"}1' "$witness" > "$neg/up.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="5" && !done {n=split($5,a," "); t=a[n]; if (t ~ /2$/) a[n]=substr(t,1,1); else if (t ~ /'"'"'$/) a[n]=substr(t,1,1)"2"; else a[n]=t"2"; s=a[1]; for(i=2;i<=n;i++) s=s" "a[i]; $5=s; done=1}1' "$witness" > "$neg/move.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="H" && $3=="7" {$6=$6+1}1' "$witness" > "$neg/lowerbound.tsv"
awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3-1}1' "$witness" > "$neg/claim.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="59" {$5="-"}1' "$witness" > "$neg/truncated.tsv"

controls=(
  "glyph|wrong glyph at cell 2 for M00 after setup"
  "up|glyph not upright at cell 4 for M00 after setup"
  "move|for M 5->6"
  "lowerbound|claimed lower bound differs for H 7->8"
  "claim|claimed maximum edge HTM differs from replay"
  "truncated|word shorter than graph distance for M 59->0"
)
if [ "$profile" = blank ]; then
  awk -F'\t' -v OFS='\t' -v r="$ul" 'NR==r{$7="7"}1' "$witness" > "$neg/nonblank-ul.tsv"
  controls+=("nonblank-ul|upper-left cell must show a blank sticker at M00 after setup")
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
