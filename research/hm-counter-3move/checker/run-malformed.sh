#!/usr/bin/env bash
# Negative controls for the shared integer grammar and for malformed or
# truncated witness files. Every control must be rejected by BOTH checkers
# with a REJECT line containing the intended reason (no uncaught exception).
# The parse paths do not depend on the witness contents, so one v2 witness
# and the v1 witness cover them.
# usage: checker/run-malformed.sh WITNESS_V2.tsv WITNESS_V1.tsv OUTDIR
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
w2=$1
w1=$2
out=$3
neg="$out/malformed"; mkdir -p "$neg"
julia=${JULIA:-/tmp/claude-0/julia/bin/julia}
jar=${HM_FLIX_BUILD_DIR:-/tmp/cubistry-hm-counter-flix}/artifact/flix.jar
jl() { "$julia" --startup-file=no "$here/check.jl" "$1"; }
fx() { java -Xss512m -Xmx3g -jar "$jar" "$1"; }
tab=$'\t'
controls=()

# field FILE NAME AWKCOND FIELDNO VALUE WANT: set field FIELDNO of the first
# row matching AWKCOND to VALUE
field() {
    local w=$1 name=$2 cond=$3 col=$4 val=$5 want=$6
    awk -F'\t' -v OFS='\t' -v c="$col" -v v="$val" "($cond) && !done {\$c=v; done=1}1" "$w" > "$neg/$name.tsv"
    controls+=("$name|$want")
}
claimval=$(awk -F'\t' '$1=="claim"{print $3}' "$w2")
lb2=$(awk -F'\t' '$1=="step"{print $7; exit}' "$w2")

# v2: claim value against the grammar
field "$w2" claim-plus     '$1=="claim"' 3 "+$claimval"   "malformed number in claim"
field "$w2" claim-space    '$1=="claim"' 3 " $claimval"   "malformed number in claim"
field "$w2" claim-trail    '$1=="claim"' 3 "$claimval "   "malformed number in claim"
field "$w2" claim-hex      '$1=="claim"' 3 "0x$claimval"  "malformed number in claim"
field "$w2" claim-exp      '$1=="claim"' 3 "${claimval}e0" "malformed number in claim"
field "$w2" claim-empty    '$1=="claim"' 3 ""             "malformed number in claim"
field "$w2" claim-suffix   '$1=="claim"' 3 "${claimval}x" "malformed number in claim"
field "$w2" claim-lead0    '$1=="claim"' 3 "0$claimval"   "malformed number in claim"
field "$w2" claim-pad7     '$1=="claim"' 3 "000000$claimval" "malformed number in claim"
field "$w2" claim-pad20    '$1=="claim"' 3 "0000000000000000000$claimval" "malformed number in claim"
field "$w2" claim-overflow '$1=="claim"' 3 "99999999999999999999" "malformed number in claim"
field "$w2" claim-negative '$1=="claim"' 3 "-$claimval"   "malformed number in claim"
# v2: the other numeric fields
field "$w2" lb-pad7        '$1=="step"'  7 "000000$lb2"   "malformed number in lower bound"
field "$w2" lb-plus        '$1=="step"'  7 "+$lb2"        "malformed number in lower bound"
field "$w2" preperiod-pad7 '$1=="mode"'  5 "0000000"      "malformed number in preperiod"
field "$w2" period-lead0   '$1=="mode"'  6 "0$(awk -F'\t' '$1=="mode"{print $6; exit}' "$w2")" "malformed number in period"
field "$w2" id-pad7        '$1=="sticker" && $2=="5"' 2 "0000005" "malformed number in sticker id"
field "$w2" cubie-plus     '$1=="sticker" && $2=="5"' 3 "+$(awk -F'\t' '$1=="sticker" && $2=="5"{print $3}' "$w2")" "malformed number in cubie id"
awk -F'\t' -v OFS='\t' '$1=="sticker" && $5 ~ /^0,/ && !done {sub(/^0,/, "-0,", $5); done=1}1' "$w2" > "$neg/vec-negzero.tsv"
controls+=("vec-negzero|malformed number in vector component")
awk -F'\t' -v OFS='\t' '$1=="sticker" && $5 ~ /,1$/ && !done {sub(/,1$/, ",+1", $5); done=1}1' "$w2" > "$neg/vec-plus.tsv"
controls+=("vec-plus|malformed number in vector component")
# v2: file structure (these used to crash the Julia checker)
head -n 60 "$w2" > "$neg/truncated-file.tsv"
controls+=("truncated-file|step row M59 32")
head -n 20 "$w2" > "$neg/truncated-print.tsv"
controls+=("truncated-print|exactly 24 sticker rows")
head -n -1 "$w2" > "$neg/no-end.tsv"
controls+=("no-end|end row")
{ cat "$w2"; echo end; } > "$neg/extra-end.tsv"
controls+=("extra-end|end row")
awk -F'\t' -v OFS='\t' '$1=="claim" {$3="\377"}1' "$w2" > "$neg/invalid-utf8.tsv"
controls+=("invalid-utf8|invalid UTF-8")
# v1: the numeric fields that only v1 has, plus its claim and truncation
field "$w1" v1-lb-lead0    '$1=="edge"'  6 "0$(awk -F'\t' '$1=="edge"{print $6; exit}' "$w1")" "malformed number in lower bound"
field "$w1" v1-reset-space '$1=="reset"' 6 " $(awk -F'\t' '$1=="reset"{print $6}' "$w1")" "malformed number in lower bound"
field "$w1" v1-claim-plus  '$1=="claim"' 3 "+$(awk -F'\t' '$1=="claim"{print $3}' "$w1")" "malformed number in claim"
head -n 60 "$w1" > "$neg/v1-truncated-file.tsv"
controls+=("v1-truncated-file|edge row M 32")

status=0
for c in "${controls[@]}"; do
  name=${c%%|*}; want=${c#*|}
  for who in julia flix; do
    if [ $who = julia ]; then got=$(jl "$neg/$name.tsv" 2>&1 || true); else got=$(fx "$neg/$name.tsv" 2>/dev/null || true); fi
    line=$(printf '%s\n' "$got" | tail -n 1)
    if [[ "$line" == REJECT* && "$line" == *"$want"* ]]; then
      echo "malformed	$name	$who	REJECTED	${line#REJECT$tab}"
    else
      echo "malformed	$name	$who	UNEXPECTED	$line"; status=1
    fi
  done
done
exit $status
