#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Mutants of the tests of the backward chain 1900-01 .. 2019-01: every check must fail for the intended reason.
#   data    data mutants of evidence/month-list and print C   -> test_month_chain_back_1900.jl (about 20 s each)
#   lib     source mutants of window_chain_lib.jl             -> test_month_chain_back_1900.jl, set "prior compatibility" (about 20 s each)
#   wf      mutants of window-chain.yml (origin/main)         -> check_back1900_workflow_inputs.sh (about 2 s each)
# Usage: [ONLY=mutant-name] [MUTGROUPS="data lib wf"] run_back1900_mutants.sh JULIA     (default: all three groups)
set -u
here=$(cd "$(dirname "$0")" && pwd); J=${1:?Julia executable}; src=$here/evidence/month-list; bad=0; n=0; groups=${MUTGROUPS:-data lib wf}
root=$(git -C "$here" rev-parse --show-toplevel)
want() { [[ " $groups " == *" $1 "* ]]; }
verdict() { # name, expected text, rc, output, kind
  if [ "$3" -ne 0 ] && printf '%s\n' "$4" | grep -Eq "$2"; then echo "KILLED   $1 ($5)"; else echo "SURVIVED $1 (expected: $5, rc=$3)"; bad=1; fi
}
data() { # name, failing test set, mutation (shell, run inside the copy)
  want data || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local d; d=$(mktemp -d)
  cp "$src"/* "$d"/; cp "$here"/evidence/print-c/{printing,layout}.tsv "$d"/; ( cd "$d" && eval "$3" )
  local out; out=$(CAL7_CHAINBACK_DIR=$d CAL7_CHAINBACK_PRINTC=$d "$J" --startup-file=no "$here/test_month_chain_back_1900.jl" 2>&1); verdict "$1" "^$2: (Test Failed|Error During Test)" $? "$out" "$2"; rm -rf "${d:?}"
}
lib() { # name, failing test set, sed expression on the library copy
  want lib || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local d; d=$(mktemp -d)
  cp "$here/window_chain_lib.jl" "$d/lib.jl"; sed -i "$3" "$d/lib.jl"; cmp -s "$d/lib.jl" "$here/window_chain_lib.jl" && { echo "NOEFFECT $1"; bad=1; }
  local out; out=$(CAL7_BACKWARD_LIB=$d/lib.jl "$J" --startup-file=no "$here/test_month_chain_back_1900.jl" 2>&1); verdict "$1" "^$2: (Test Failed|Error During Test)" $? "$out" "$2"; rm -rf "${d:?}"
}
wf() { # name, sed expression on a copy of the workflow on origin/main
  want wf || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local d; d=$(mktemp -d)
  git -C "$root" show origin/main:.github/workflows/window-chain.yml > "$d/wf.yml" || { echo "no workflow on origin/main"; bad=1; return; }
  cp "$d/wf.yml" "$d/wf0.yml"; sed -i "$2" "$d/wf.yml"; cmp -s "$d/wf.yml" "$d/wf0.yml" && { echo "NOEFFECT $1"; bad=1; }
  local out rc=0; out=$(bash "$here/check_back1900_workflow_inputs.sh" "$d/wf.yml" 2>&1) || rc=$?; verdict "$1" "^FAIL" $rc "$out" "workflow inputs probe"; rm -rf "${d:?}"
}
L=months-back-1900-01-2019-01.tsv; B=best-effort-back-1900-01-2019-01.tsv; S=stages-back-1900-01-2019-01.tsv; C=coverage-back-1900-01-2019-01; H=february-hall-C-back-1900.tsv
data duplicate-month         "range, order, count" "sed -i 's/^1950-05\$/1950-04/' $L"
data gap-month-removed       "range, order, count" "sed -i '/^1950-05\$/d' $L"
data first-month-1899-12     "range, order, count" "sed -i '1s/.*/1899-12/' $L"
data first-month-1900-02     "range, order, count" "sed -i '1d' $L"
data last-month-2018-12      "range, order, count" "sed -i '\$s/.*/2018-12/' $L"
data crlf                    "pin and format"      "sed -i 's/\$/\r/' $L"
data pin-line-missing        "pin and format"      "sed -i '/months-back-1900-01-2019-01.tsv/d' sha256.txt"
data best-effort-new-missing "best-effort file"    "sed -i '/^1914-02\t/d' $B"
data best-effort-old-missing "best-effort file"    "sed -i '/^1998-02\t/d' $B"
data best-effort-first       "best-effort file"    "printf '1900-01\tbest_effort_unverified\t7,1\t$H\n' >> $B"
data best-effort-cell-7-7    "best-effort file"    "sed -i 's/^1925-02\tbest_effort_unverified\t7,1\t/1925-02\tbest_effort_unverified\t7,7\t/' $B"
data best-effort-unsorted    "best-effort file"    "awk 'NR==3{a=\$0;next} NR==4{print;print a;next} {print}' $B > t && mv t $B"
data hall-row-removed        "best-effort file"    "sed -i '/^1942-02\t/d' $H"
data hall-wrong-cell         "best-effort file"    "sed -i 's/^1953-02\t-3,-3,-3\t1\t7,1\t/1953-02\t-3,-3,-3\t1\t7,2\t/' $H"
data hall-old-row-changed    "best-effort file"    "sed -i 's/^2009-02\t-3,-3,-3\t1\t7,1\t7,1;7,7\t1/2009-02\t-3,-3,-3\t1\t7,1\t7,7;7,1\t1/' $H"
data stage-first-expect      "stage plan"          "sed -i 's/^9\t469\t532\t64\t468\t/9\t469\t532\t64\t467\t/' $S"
data stage-too-long          "stage plan"          "sed -i 's/^12\t661\t724\t64\t660\t64\t1958-09/12\t661\t725\t65\t660\t65\t1958-09/' $S"
data stage-expect-prior      "stage plan"          "sed -i 's/^15\t853\t916\t64\t852\t/15\t853\t916\t64\t851\t/' $S"
data stage-start-best-effort "stage plan"          "sed -i 's/^13\t725\t788\t64\t724\t64\t1953-05/13\t725\t788\t64\t724\t64\t1953-02/' $S"
data stage-last-removed      "stage plan"          "sed -i '/^23\t/d' $S"
data coverage-headline       "coverage"            "sed -i 's/\t1903-01\t37\$/\t1903-01\t38/' $C.tsv"
data print-sticker-text      "months print C shows exactly" "awk -F'\t' -v OFS='\t' 'NR>1 && \$6==\"5\" && !d {\$6=\"x\"; d=1} {print}' printing.tsv > t && mv t printing.tsv"
lib plan-not-reversed        "prior compatibility of the producer \(no solver\)" 's/^backward_plan(members)=reverse(members)/backward_plan(members)=members/'
lib prefix-check-removed     "prior compatibility of the producer \(no solver\)" 's/for (i,ym) in enumerate(months);ym==plan\[i+1\] || error/for (i,ym) in enumerate(months);true || error/'
lib root-check-removed       "prior compatibility of the producer \(no solver\)" 's/ || error("chain source is not the root month/ || true || error("chain source is not the root month/'
lib more-edges-allowed       "prior compatibility of the producer \(no solver\)" 's/length(months)<=length(plan)-1 || error/true || error/'
lib list-range-1900-02       "prior compatibility of the producer \(no solver\)" 's/^const YM_MIN=(1900,1)/const YM_MIN=(1900,2)/'
wf prior-months-pin-ignored  's/\${PRIOR_MONTHS_SHA:-\$MONTHS_SHA}/$MONTHS_SHA/g'
wf prior-best-pin-ignored    's/\${PRIOR_BEST_SHA:-\$BEST_SHA}/$BEST_SHA/g'
wf complete-always-required  's/\[ "\${PRIOR_MONTHS_SHA:-\$MONTHS_SHA}" != "\$MONTHS_SHA" \] || //'
wf direction-unchecked       's/\[ "\${pd:-forward}" = "\$DIRECTION" \]/true/'
wf join-end-unchecked        's/\[ "\${pj:--}" = "\${JOIN_END:--}" \]/true/'
wf expect-prior-ignored      's/\[ "\$most" = "\$EXPECT_PRIOR" \]/true/'
wf backward-join-end-free    '/direction backward needs join_end=identity/d'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-}, MUTGROUPS=$groups)" >&2; exit 2; }
echo "mutants: $n, $([ $bad = 0 ] && echo 'all killed' || echo 'SURVIVORS')"
exit $bad
