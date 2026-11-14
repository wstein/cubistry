#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of .github/workflows/beam-reroot-measure.yml: tests/beam-reroot-measure-workflow.test.mjs must fail on each mutated copy.
# Usage: [ONLY=name] MUTANT_TMP=<existing dir, not /tmp> scripts/ci/beam-reroot-measure-mutants.sh [node]    (about 2 s each)
set -u
here=$(cd "$(dirname "$0")/../.." && pwd); node=${1:-node}; bad=0; n=0
base=${MUTANT_TMP:-${TMPDIR:-}}
{ [ -n "$base" ] && [ -d "$base" ] && [ "${base%/}" != /tmp ]; } || { echo "set MUTANT_TMP to an existing directory outside /tmp" >&2; exit 2; }
wf="$here/.github/workflows/beam-reroot-measure.yml"
run() { # name, exact text, replacement (literal)
  local name=$1 old=$2 new=$3 t src
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); t=$(mktemp -d -p "$base"); src=$(<"$wf")
  if [[ "$src" != *"$old"* ]]; then echo "NOT APPLIED $name"; bad=1; rm -rf "$t"; return; fi
  printf '%s\n' "${src/"$old"/"$new"}" > "$t/w.yml"
  if TMPDIR="$base" WORKFLOW_FILE="$t/w.yml" "$node" --test "$here/tests/beam-reroot-measure-workflow.test.mjs" >"$t/log" 2>&1; then echo "SURVIVED $name"; bad=1
  else echo "KILLED   $name ($(grep -m1 '^not ok' "$t/log" | cut -c1-80))"; fi
  rm -rf "$t"
}
run push-trigger        '  workflow_dispatch:
    inputs:' '  push:
  workflow_dispatch:
    inputs:'
run pr-trigger          'permissions:
  contents: read' 'on_pr_placeholder: x
  pull_request:
permissions:
  contents: read'
run write-permission    '  contents: read
  # Needed only' '  contents: write
  # Needed only'
run unpinned-checkout   'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1' 'actions/checkout@v7'
run job-limit-345       'timeout-minutes: 340' 'timeout-minutes: 345'
run no-nice             'nice -n 10 timeout' 'timeout'
run no-deadline-arg     'deadline_s=$((DEADLINE_MIN * 60))' 'deadline_s=0'
run artifact-only-on-success '        if: always()
' ''
run chain-gate-dropped  '[ "$n" = 0 ] || { echo "::error::$n window-chain' 'true || { echo "::error::$n window-chain'
run chain-gate-statuses 'for s in queued in_progress waiting pending requested; do' 'for s in queued; do'
run ancestor-check-dropped 'git merge-base --is-ancestor "$SHA" "refs/remotes/origin/$RESEARCH_BRANCH" ||' 'true ||'
run deadline-range      '[ "$IN_DEADLINE" -le 320 ]' '[ "$IN_DEADLINE" -le 400 ]'
run duplicate-edges     '[ "$(printf '"'"'%s\n'"'"' "${ids[@]}" | sort -u | wc -l)" = "${#ids[@]}" ] ||' 'true ||'
run edge-range          '[ "$i" -le 205 ]' '[ "$i" -le 999 ]'
run commit-zero         '^[1-9][0-9]{0,3}(,[1-9][0-9]{0,3}){0,7}$' '^[0-9]{1,4}(,[0-9]{1,4}){0,7}$'
run pair-grouping       'NR%2==1{p=$0; next}' 'NR%3==1{p=$0; next}'
run concurrency-cancel  'cancel-in-progress: false' 'cancel-in-progress: true'
run persist-credentials 'persist-credentials: false # the repository' 'persist-credentials: true # the repository'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
