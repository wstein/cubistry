#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of .github/workflows/beam-reroot-measure.yml: tests/beam-reroot-measure-workflow.test.mjs must fail on each mutated copy.
# Usage: [ONLY=name] MUTANT_TMP=<existing dir, not /tmp> scripts/ci/beam-reroot-measure-mutants.sh [node]    (about 2 s each, 33 mutants)
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
run rc-from-dollar-question 'rc=${PIPESTATUS[0]}' 'rc=$?'
run rc-gate-removed          '          [ "$rc" = 0 ]
      - uses: actions/upload-artifact' '          true
      - uses: actions/upload-artifact'
run wrong-script-path        'src/research/calendar-7x7/row1-window-chain/run_reroot_measure.sh' 'src/research/calendar-7x7/row1-window-chain/run_reroot.sh'
run checkout-ref-main        '          ref: ${{ inputs.research_ref }}' '          ref: main'
run required-check-dropped   '[ "$missing" = 0 ] || fail "research commit lacks required files"' 'true'
run missing-flag-dropped     'missing=1; }' ':; }'
run beam2-not-required       'research/calendar-7x7/upright-beam/beam2.jl research/calendar-7x7/global-search/search.jl; do' 'research/calendar-7x7/global-search/search.jl; do'
run edges-expanded-in-run    'deadline_s=$((DEADLINE_MIN * 60)) 2>&1' 'deadline_s=$((DEADLINE_MIN * 60)) edges=${{ inputs.edges }} 2>&1'
run ref-width-unvalidated    '[ -z "$IN_REF_WIDTH" ] || { [[ "$IN_REF_WIDTH"' 'true || { [[ "$IN_REF_WIDTH"'
run ref-width-cap            '-le 400 ]; } || fail "ref_width' '-le 4000 ]; } || fail "ref_width'
run ref-width-not-passed     '${REF_WIDTH:+ref_width="$REF_WIDTH"} ' ''
run ref-width-env-dropped    '      REF_WIDTH: ${{ inputs.ref_width }}' '      REF_WIDTH: ""'
run ref-width-grep-dropped   'git grep -qw ref_width "$SHA" -- "$WC/measure_edges.jl" ||' 'true ||'
run summary-cut-shifted     'cut -f1-9,19-21,29-32 "$out/summary.tsv"' 'cut -f1-9,19-21,28-31 "$out/summary.tsv"'
run summary-cut-first-range 'cut -f1-9,19-21,29-32' 'cut -f1-8,19-21,29-32'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
