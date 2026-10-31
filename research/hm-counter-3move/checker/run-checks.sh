#!/usr/bin/env bash
# Runs the native Julia checker and the Flix checker (a structural port of it) on a witness,
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

if [ "$(head -n 1 "$witness")" = "cubistry.hm-counter.v2" ]; then
  # v2 (blank profile, preperiod + period) controls
  awk -F'\t' -v OFS='\t' -v r="$ur" 'NR==r{$7="H"}1' "$witness" > "$neg/glyph.tsv"
  awk -F'\t' -v OFS='\t' -v r="$lr" 'NR==r{$6=($6=="0,1,0")?"1,0,0":"0,1,0"}1' "$witness" > "$neg/up.tsv"
  awk -F'\t' -v OFS='\t' -v r="$ul" 'NR==r{$7="7"}1' "$witness" > "$neg/nonblank-ul.tsv"
  # route move: last token of the M step from 5 to 6 (first lap) changed
  awk -F'\t' -v OFS='\t' '$1=="step" && $2=="M" && $4=="5" && !done {n=split($6,a," "); t=a[n]; if (t ~ /2$/) a[n]=substr(t,1,1); else if (t ~ /'"'"'$/) a[n]=substr(t,1,1)"2"; else a[n]=t"2"; s=a[1]; for(i=2;i<=n;i++) s=s" "a[i]; $6=s; done=1}1' "$witness" > "$neg/move.tsv"
  # claimed bound too small: first H23 step with lb >= 1, lb - 1
  awk -F'\t' -v OFS='\t' '$1=="step" && $2=="H" && $3=="23" && $7>=1 && !done {$7=$7-1; done=1}1' "$witness" > "$neg/lowerbound.tsv"
  lbstep=$(awk -F'\t' '$1=="step" && $2=="H" && $3=="23" {if ($7>=1) {print k; exit}; k++}' "$witness")
  awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3-1}1' "$witness" > "$neg/claim.tsv"
  # wrong period boundary in the M mode: move one lap between preperiod and period
  # move one lap between preperiod and period when the M period has two or more
  # laps or a preperiod; for a one-lap period every whole-lap boundary is
  # correct, so the boundary is moved by one edge instead (whole-lap rule)
  mp=$(awk -F'\t' '$1=="mode" && $2=="M"{print $5" "$6}' "$witness")
  set -- $mp
  if [ "$1" -ge 60 ] || [ "$2" -ge 120 ]; then bwant="period boundary: state after preperiod+period must equal state after preperiod"; else bwant="preperiod and period must be whole laps"; fi
  awk -F'\t' -v OFS='\t' '$1=="mode" && $2=="M" {if ($5>=60) {$5-=60; $6+=60} else if ($6>=120) {$5+=60; $6-=60} else {$5+=1; $6-=1}}1' "$witness" > "$neg/boundary.tsv"
  controls=(
    "glyph|wrong glyph at cell 2 for M59 00 after setup"
    "up|glyph not upright at cell 4 for M59 00 after setup"
    "nonblank-ul|upper-left cell must show a blank sticker at M59 00 after setup"
    "move|M59 step "
    "lowerbound|claimed lower bound differs for H23 step $lbstep"
    "claim|claimed maximum edge HTM differs from replay"
    "boundary|$bwant"
  )
  # period too long: the M period rows repeated once more, Q doubled
  awk -F'\t' -v OFS='\t' '
    $1=="mode" {inM=($2=="M"); if (inM) {P=$5; Q=$6; $6=2*$6; j=0}; print; next}
    $1=="step" && inM {print; if (j>=P) buf=buf $0 "\n"; j++; if (j==P+Q) {printf "%s", buf; inM=0}; next}
    {print}' "$witness" > "$neg/toolong.tsv"
  # period too short: first mode whose period has two or more laps loses its last lap
  short=$(awk -F'\t' '$1=="mode" && $6>=2*($3+1) {print $2"\t"$3; exit}' "$witness")
  if [ -n "$short" ]; then
    sl=${short%%$'\t'*}; sr=${short#*$'\t'}
    awk -F'\t' -v OFS='\t' -v L="$sl" -v R="$sr" '
      $1=="mode" {inS=($2==L && $3==R); if (inS) {P=$5; Q=$6; n=R+1; $6=Q-n; j=0}; print; next}
      $1=="step" && inS {if (j < P+Q-n) print; j++; next}
      {print}' "$witness" > "$neg/tooshort.tsv"
    controls+=("tooshort|period boundary: state after preperiod+period must equal state after preperiod for $sl$sr")
  fi
  controls+=("toolong|period is not minimal for M59")
  # claimed bound too large (same step as "lowerbound"), claimed maximum too large
  awk -F'\t' -v OFS='\t' '$1=="step" && $2=="H" && $3=="23" && $7>=1 && !done {$7=$7+1; done=1}1' "$witness" > "$neg/lowerbound-up.tsv"
  awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3+1}1' "$witness" > "$neg/claim-up.tsv"
  controls+=("lowerbound-up|claimed lower bound differs for H23 step $lbstep"
             "claim-up|claimed maximum edge HTM differs from replay")
  # exact closure: the last M period word gets a trailing B. B turns only the
  # back layer, so every display stays correct, but the full state after the
  # period is B applied to the period start state, not the start state itself.
  # This exercises the exact-closure check also for one-lap periods, where the
  # "boundary" control only hits the whole-lap rule.
  awk -F'\t' -v OFS='\t' '
    $1=="mode" {inM=($2=="M"); if (inM) {last=$5+$6; j=0}; print; next}
    $1=="step" && inM {j++; if (j==last) $6=$6" B"; print; next}
    {print}' "$witness" > "$neg/closure.tsv"
  controls+=("closure|period boundary: state after preperiod+period must equal state after preperiod for M59")
  # distinct-state rule inside a multi-lap period: the M period is run twice,
  # the first copy ends with an extra B (lap boundary state B*S differs from S,
  # so the period stays minimal) and the second copy starts with B', which
  # brings the cube back to S. The states after the first step of each copy
  # are then equal. The claimed bound of the first step of the second copy is
  # the bound from B*S, computed with the Julia checker's own functions.
  lbB=$("$julia" --startup-file=no -e '
    include(ARGS[1]); rows = readlines(ARGS[2]); st = readprint(rows[4:27])
    i = findfirst(r -> startswith(r, "mode\tM\t"), rows); f = split(rows[i], "\t")
    s = let s = doword(st, parseword(f[4]))
        for j in 1:parse(Int, f[5]); s = doword(s, parseword(split(rows[i+j], "\t")[6])); end
        s
    end
    print(lowerbound(buildgraph(4), doword(s, parseword("B")), wanted(Char(77), 1, true)))' "$here/check.jl" "$witness")
  awk -F'\t' -v OFS='\t' -v lb="$lbB" '
    $1=="mode" {inM=($2=="M"); if (inM) {P=$5; Q=$6; $6=2*Q; j=0; n=0}; print; next}
    $1=="step" && inM {j++; if (j<=P) {print; next}
      n++; row[n]=$0; if (n==Q) {
        for (k=1;k<=Q;k++) {split(row[k],a,"\t"); if (k==Q) a[6]=a[6]" B"; print a[1],a[2],a[3],a[4],a[5],a[6],a[7]}
        for (k=1;k<=Q;k++) {split(row[k],a,"\t"); if (k==1) {a[6]="B'"'"' "a[6]; a[7]=lb}; print a[1],a[2],a[3],a[4],a[5],a[6],a[7]}
        inM=0}
      next}
    {print}' "$witness" > "$neg/midrepeat.tsv"
  controls+=("midrepeat|full state repeats within the period for M59")
else
awk -F'\t' -v OFS='\t' -v r="$ur" 'NR==r{$7="H"}1' "$witness" > "$neg/glyph.tsv"
awk -F'\t' -v OFS='\t' -v r="$lr" 'NR==r{$6=($6=="0,1,0")?"1,0,0":"0,1,0"}1' "$witness" > "$neg/up.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="5" && !done {n=split($5,a," "); t=a[n]; if (t ~ /2$/) a[n]=substr(t,1,1); else if (t ~ /'"'"'$/) a[n]=substr(t,1,1)"2"; else a[n]=t"2"; s=a[1]; for(i=2;i<=n;i++) s=s" "a[i]; $5=s; done=1}1' "$witness" > "$neg/move.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="H" && $3=="7" {$6=$6+1}1' "$witness" > "$neg/lowerbound.tsv"
awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3-1}1' "$witness" > "$neg/claim.tsv"
awk -F'\t' -v OFS='\t' '$1=="edge" && $2=="M" && $3=="59" {$5="-"}1' "$witness" > "$neg/truncated.tsv"
awk -F'\t' -v OFS='\t' '$1=="claim" {$3=$3+1}1' "$witness" > "$neg/claim-up.tsv"

controls=(
  "glyph|wrong glyph at cell 2 for M00 after setup"
  "up|glyph not upright at cell 4 for M00 after setup"
  "move|for M 5->6"
  "lowerbound|claimed lower bound differs for H 7->8"
  "claim|claimed maximum edge HTM differs from replay"
  "claim-up|claimed maximum edge HTM differs from replay"
  "truncated|word shorter than graph distance for M 59->0"
)
if [ "$profile" = blank ]; then
  awk -F'\t' -v OFS='\t' -v r="$ul" 'NR==r{$7="7"}1' "$witness" > "$neg/nonblank-ul.tsv"
  controls+=("nonblank-ul|upper-left cell must show a blank sticker at M00 after setup")
fi
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
