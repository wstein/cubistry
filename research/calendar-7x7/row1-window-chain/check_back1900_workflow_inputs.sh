#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Probe: the inputs of stage 9 of the backward chain 1900-01 .. 2019-01 pass the real run blocks of .github/workflows/window-chain.yml
# (steps "Validate inputs" of job prepare and "Prepare work directory" of job produce, extracted with yq), with the real pins of the repository files and a prior artifact
# of run 43414242499 (backward, join_end identity, 468 edges, months d99f6681.., best-effort dde09fef.., complete=true). Nothing runs on GitHub; nothing is computed.
#   check_back1900_workflow_inputs.sh [WORKFLOW_YML] [PRIOR_ARTIFACT_DIR]
# WORKFLOW_YML defaults to the file on origin/main (git show). PRIOR_ARTIFACT_DIR (optional) is a copy of artifact wc-chain-43414242499; without it a synthetic artifact
# with the same VERIFIED.txt fields is used. Needs yq and git. What only a real dispatch shows (download of the artifact, the producer replay, the verify job) is not covered.
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd); root=$(git -C "$here" rev-parse --show-toplevel)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
wf=${1:-}; art=${2:-}
if [[ -z "$wf" ]]; then git -C "$root" show origin/main:.github/workflows/window-chain.yml > "$tmp/wf.yml" || { echo "cannot read the workflow from origin/main"; exit 2; }; wf=$tmp/wf.yml; fi
yq '.jobs.prepare.steps[] | select(.id=="validate") | .run' "$wf" > "$tmp/validate.sh"
yq '.jobs.produce.steps[] | select(.name=="Prepare work directory") | .run' "$wf" > "$tmp/prepare.sh"
[[ -s "$tmp/validate.sh" && -s "$tmp/prepare.sh" ]] || { echo "cannot extract the steps from $wf"; exit 2; }
rel=research/calendar-7x7/row1-window-chain; ml=$rel/evidence/month-list
MONTHS=$ml/months-back-1900-01-2019-01.tsv; BEST=$ml/best-effort-back-1900-01-2019-01.tsv
PRINT=$rel/evidence/print-c/printing.tsv; LAYOUT=$rel/evidence/print-c/layout.tsv
sha() { sha256sum "$root/$1" | cut -d' ' -f1; }
NEW_M=$(sha "$MONTHS"); NEW_B=$(sha "$BEST"); PRINT_SHA=$(sha "$PRINT"); LAYOUT_SHA=$(sha "$LAYOUT")
OLD_M=d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041; OLD_B=dde09fef9c08575d4a6dbcbb10b2e016d066818b491f2899123816ad744ebdeb
pass=0; failn=0
mk() { # complete direction join_end edges: a workspace with src (the repository checkout) and one prior artifact
  w=$tmp/w; rm -rf "$w"; mkdir -p "$w/out"; ln -s "$root" "$w/src"
  if [[ -n "$art" ]]; then mkdir -p "$w/prev"; cp -R "$art" "$w/prev/a"
  else
    mkdir -p "$w/prev/a/states"; for f in chain.moves.tsv edges.tsv segments.tsv; do echo x > "$w/prev/a/$f"; done; echo s > "$w/prev/a/states/s.tsv"
    { echo "print_sha256=$PRINT_SHA"; echo "months_sha256=$OLD_M"; echo "root_month=-"; echo "layout_sha256=$LAYOUT_SHA"; echo "direction=${2:-backward}"; echo "join_end=${3:-identity}"
      echo "best_effort_29=true"; echo "best_effort_sha256=$OLD_B"; echo "edges_total=${4:-468}"; echo "chain_end=2019-01"; echo "complete=${1:-true}"; } > "$w/prev/a/VERIFIED.txt"
    (cd "$w/prev/a" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > ../SUMS.tmp; mv ../SUMS.tmp SHA256SUMS)
  fi
}
prepare() { # extra env assignments; prints the exit code
  ( cd "$tmp/w" && env GITHUB_WORKSPACE="$tmp/w" GITHUB_ENV="$tmp/w/env" PRINT_SHA="$PRINT_SHA" PRINT_PATH=$PRINT MONTHS_SHA="$NEW_M" MONTHS_PATH=$MONTHS CLAIMS_PATH= BEST_PATH=$BEST \
      ROOT_MONTH= LAYOUT_SHA="$LAYOUT_SHA" EXPECT_PRIOR=468 BEST29=true PRIOR_MONTHS_SHA=$OLD_M PRIOR_BEST_SHA=$OLD_B DIRECTION=backward JOIN_END=identity "$@" bash "$tmp/prepare.sh" ) > "$tmp/out.txt" 2>&1
  echo $?
}
validate() { # extra env assignments; prints the exit code
  : > "$tmp/vout"
  ( cd "$tmp" && env GITHUB_OUTPUT="$tmp/vout" IN_REF="$(printf 'a%.0s' $(seq 40))" IN_START= IN_END= IN_MONTHS_PATH=$MONTHS IN_MONTHS_SHA="$NEW_M" IN_ROOT= IN_PRINT_PATH=$PRINT IN_PRINT_SHA="$PRINT_SHA" \
      IN_LAYOUT_PATH=$LAYOUT IN_LAYOUT_SHA="$LAYOUT_SHA" IN_BEST=$BEST IN_CLAIMS= IN_LIBRARY=L5 IN_WIDTH=40 IN_LAMBDA=3 IN_PRIOR=43414242499 IN_SMOKE=false IN_MAX=64 IN_EXPECT=468 \
      IN_PRIOR_MONTHS_SHA=$OLD_M IN_PRIOR_BEST_SHA=$OLD_B IN_DIRECTION=backward IN_JOIN_END=identity "$@" bash "$tmp/validate.sh" ) > "$tmp/out.txt" 2>&1
  echo $?
}
expect() { # name want got [message]
  local ok=1; [[ "$2" == "$3" ]] || ok=0; [[ "$2" == 0 || -z "${4:-}" ]] || grep -q -- "$4" "$tmp/out.txt" || ok=0
  if [[ $ok == 1 ]]; then pass=$((pass+1)); echo "ok   $1"; else failn=$((failn+1)); echo "FAIL $1 (exit $3, want $2)"; sed 's/^/     /' "$tmp/out.txt" | tail -4; fi
}
mk; expect "prepare: stage 9 inputs, prior of run 43414242499: continues" 0 "$(prepare)"
grep -q "continuing from .* (468 edges)" "$tmp/out.txt" && { pass=$((pass+1)); echo "ok   prepare: reports 468 prior edges"; } || { failn=$((failn+1)); echo "FAIL prepare: 468 edges not reported"; }
expect "prepare: without the prior months pin: fails" 1 "$(prepare PRIOR_MONTHS_SHA=)" "another month list"
expect "prepare: without the prior best-effort pin: fails" 1 "$(prepare PRIOR_BEST_SHA=)" "another best-effort file"
expect "prepare: prior months pin = new list (nothing to continue): fails" 1 "$(prepare PRIOR_MONTHS_SHA="$NEW_M")" "another month list"
expect "prepare: expect_prior_edges 467: fails" 1 "$(prepare EXPECT_PRIOR=467)" "expect_prior_edges"
expect "prepare: forward run on the backward prior: fails" 1 "$(prepare DIRECTION=forward JOIN_END=)" "another direction"
expect "prepare: backward run without join_end on the prior: fails" 1 "$(prepare JOIN_END=)" "another join_end"
expect "prepare: root month set: fails" 1 "$(prepare ROOT_MONTH=2019-01)" "another root month"
expect "prepare: another layout: fails" 1 "$(prepare LAYOUT_SHA="$NEW_M")" "another layout"
expect "prepare: stage 10 (expect 532) on the stage 8 prior: fails" 1 "$(prepare EXPECT_PRIOR=532)" "expect_prior_edges"
if [[ -z "$art" ]]; then mk false backward identity 468; expect "prepare: synthetic prior with complete=false: continues" 0 "$(prepare)"; fi
expect "validate: stage 9 inputs: accepted" 0 "$(validate)"
grep -qx "max_edges=64" "$tmp/vout" && grep -qx "expect_prior_edges=468" "$tmp/vout" && grep -qx "prior_run_id=43414242499" "$tmp/vout" && { pass=$((pass+1)); echo "ok   validate: outputs max_edges 64, expect_prior_edges 468, prior_run_id"; } || { failn=$((failn+1)); echo "FAIL validate: outputs: $(tr '\n' ' ' < "$tmp/vout")"; }
expect "validate: root_month set with backward: fails" 1 "$(validate IN_ROOT=2019-01)" "empty root_month"
expect "validate: join_end empty with backward: fails" 1 "$(validate IN_JOIN_END=)" "join_end=identity"
expect "validate: prior pins without prior_run_id: fails" 1 "$(validate IN_PRIOR= IN_EXPECT=)" "need prior_run_id"
echo "stage 9 workflow inputs: $pass checks passed, $failn failed"
[[ $failn == 0 ]]
