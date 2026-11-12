#!/usr/bin/env bash
# Probe for the prior-chain checks of .github/workflows/window-chain.yml.
# It extracts the real run blocks of the steps "Validate inputs" (job prepare) and "Prepare work directory" (job produce)
# with yq and runs them on a sample prior artifact. Usage: scripts/ci/window-chain-prior.test.sh [workflow.yml]
set -uo pipefail
wf=${1:-$(dirname "$0")/../../.github/workflows/window-chain.yml}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
yq '.jobs.prepare.steps[] | select(.id=="validate") | .run' "$wf" > "$tmp/validate.sh"
yq '.jobs.produce.steps[] | select(.name=="Prepare work directory") | .run' "$wf" > "$tmp/prepare.sh"
[ -s "$tmp/validate.sh" ] && [ -s "$tmp/prepare.sh" ] || { echo "cannot extract the steps from $wf"; exit 2; }

h() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
OLD_M=$(h old-months); NEW_M=$(h new-months); OLD_B=$(h old-best); PRINT=$(h print); OTHER=$(h other)
pass=0; failn=0

# mk <months_sha> <best_sha> <complete>: a workspace with src files and one prior artifact (VERIFIED.txt fields as the verify job writes them)
mk() {
  w=$tmp/w; rm -rf "$w"; mkdir -p "$w/src" "$w/prev/a/states" "$w/out"
  echo print > "$w/src/print.tsv"; echo months-new > "$w/src/months.tsv"; echo best-new > "$w/src/best.tsv"
  PRINT_SHA=$(sha256sum "$w/src/print.tsv" | cut -d' ' -f1); MONTHS_SHA=$(sha256sum "$w/src/months.tsv" | cut -d' ' -f1)
  for f in chain.moves.tsv edges.tsv segments.tsv; do echo x > "$w/prev/a/$f"; done; echo s > "$w/prev/a/states/s.tsv"
  { echo "print_sha256=${PRINT_OVERRIDE:-$PRINT_SHA}"; echo "months_sha256=$1"; echo "root_month=-"; echo "layout_sha256=-"
    echo "best_effort_29=true"; echo "best_effort_sha256=$2"; echo "edges_total=41"; echo "chain_end=2022-01"; echo "complete=$3"; } > "$w/prev/a/VERIFIED.txt"
  (cd "$w/prev/a" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > ../SUMS.tmp; mv ../SUMS.tmp SHA256SUMS)
}

# run_prepare [VAR=value ...]: runs the step; prints the exit code
run_prepare() {
  ( cd "$tmp/w" && env GITHUB_WORKSPACE="$tmp/w" GITHUB_ENV="$tmp/w/env" PRINT_SHA="$PRINT_SHA" PRINT_PATH=print.tsv \
      MONTHS_SHA="$MONTHS_SHA" MONTHS_PATH=months.tsv CLAIMS_PATH= BEST_PATH=best.tsv ROOT_MONTH= LAYOUT_SHA= EXPECT_PRIOR=41 BEST29=true \
      PRIOR_MONTHS_SHA= PRIOR_BEST_SHA= "$@" bash "$tmp/prepare.sh" ) > "$tmp/out.txt" 2>&1
  echo $?
}

# expect <name> <want: 0|1> <got> [message fragment for want=1]
expect() {
  local ok=1
  [ "$2" = "$3" ] || ok=0
  [ "$2" = 0 ] || [ -z "${4:-}" ] || grep -q -- "$4" "$tmp/out.txt" || ok=0
  if [ $ok = 1 ]; then pass=$((pass+1)); echo "ok   $1"; else failn=$((failn+1)); echo "FAIL $1 (exit $3, want $2)"; sed 's/^/     /' "$tmp/out.txt" | tail -4; fi
}

# --- Prepare work directory: behavior without the new inputs (as before) ---
mk dummy dummy false   # creates the sample files whose hashes the cases below need
MS=$(sha256sum "$tmp/w/src/months.tsv" | cut -d' ' -f1); BN=$(sha256sum "$tmp/w/src/best.tsv" | cut -d' ' -f1)
mk "$MS" "$BN" false;  expect "same inputs, incomplete prior: continues" 0 "$(run_prepare)"
mk "$OLD_M" "$BN" false; expect "same inputs, other month list: fails" 1 "$(run_prepare)" "another month list"
mk "$MS" "$BN" true;   expect "same inputs, complete prior: fails" 1 "$(run_prepare)" "is complete"
mk "$MS" "$OLD_B" false; expect "same inputs, other best-effort file: fails" 1 "$(run_prepare)" "another best-effort file"
PRINT_OVERRIDE=$OTHER mk "$MS" "$BN" false; expect "same inputs, other print: fails" 1 "$(run_prepare)" "another print"

# --- Prepare work directory: continuation with the prior pins ---
mk "$OLD_M" "$OLD_B" true;  expect "prior pins match, complete prior: continues" 0 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M" PRIOR_BEST_SHA="$OLD_B")"
mk "$OLD_M" "$BN" true;     expect "prior months pin only, best-effort file unchanged: continues" 0 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M")"
mk "$MS" "$OLD_B" false;    expect "prior best pin only, month list unchanged: continues" 0 "$(run_prepare PRIOR_BEST_SHA="$OLD_B")"
mk "$OLD_M" "$OLD_B" true;  expect "wrong prior months pin: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$OTHER" PRIOR_BEST_SHA="$OLD_B")" "another month list"
mk "$OLD_M" "$OLD_B" true;  expect "wrong prior best pin: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M" PRIOR_BEST_SHA="$OTHER")" "another best-effort file"
mk "$MS" "$OLD_B" true;     expect "prior months pin set, prior holds the new list: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M" PRIOR_BEST_SHA="$OLD_B")" "another month list"
mk "$OLD_M" "$OLD_B" true;  expect "prior best pin set, prior holds the old file but pin missing: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M")" "another best-effort file"
mk "$MS" "$BN" true;        expect "prior months pin equal to months_sha256, complete prior: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$MS")" "is complete"
mk "$OLD_M" "$OLD_B" true;  expect "prior pins match, wrong expect_prior_edges: fails" 1 "$(run_prepare PRIOR_MONTHS_SHA="$OLD_M" PRIOR_BEST_SHA="$OLD_B" EXPECT_PRIOR=40)" "expect_prior_edges"

# --- Validate inputs ---
vrun() {
  ( cd "$tmp" && env GITHUB_OUTPUT="$tmp/vout" IN_REF="$(printf 'a%.0s' $(seq 40))" IN_START= IN_END= IN_MONTHS_PATH=m.tsv IN_MONTHS_SHA="$NEW_M" IN_ROOT= \
      IN_PRINT_PATH=p.tsv IN_PRINT_SHA="$PRINT" IN_LAYOUT_PATH= IN_LAYOUT_SHA= IN_BEST= IN_CLAIMS= IN_LIBRARY=L4 IN_WIDTH=10 IN_LAMBDA=3 \
      IN_PRIOR=123 IN_SMOKE=false IN_MAX= IN_EXPECT=41 IN_PRIOR_MONTHS_SHA= IN_PRIOR_BEST_SHA= "$@" bash "$tmp/validate.sh" ) > "$tmp/out.txt" 2>&1
  echo $?
}
expect "validate: no prior pins" 0 "$(vrun)"
expect "validate: both prior pins" 0 "$(vrun IN_PRIOR_MONTHS_SHA="$OLD_M" IN_PRIOR_BEST_SHA="$OLD_B")"
expect "validate: prior months pin not hex" 1 "$(vrun IN_PRIOR_MONTHS_SHA=zz)" "prior_months_sha256"
expect "validate: prior best pin upper case" 1 "$(vrun IN_PRIOR_BEST_SHA="$(echo "$OLD_B" | tr a-f A-F)A")" "prior_best_effort_sha256"
expect "validate: prior pin without prior_run_id" 1 "$(vrun IN_PRIOR= IN_EXPECT= IN_PRIOR_MONTHS_SHA="$OLD_M")" "need prior_run_id"

echo "passed $pass, failed $failn"
[ "$failn" = 0 ]
