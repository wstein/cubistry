#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Mutants of the backward-mode tests: every new check must make its test fail.
#   lib      source mutants of window_chain_lib.jl           -> test_window_chain_backward.jl (about 5 s each)
#   data     data mutants of evidence/month-list and print C  -> test_month_chain_back.jl (about 35 s each)
#   runner   mutants of run_checks.sh                         -> check_join_forwarding.sh (about 1 s each)
#   producer mutants of window_chain.jl                       -> check_backward_refusals.sh (about 35 s each)
# Usage: [ONLY=mutant-name] [MUTGROUPS="lib data"] run_backward_mutants.sh JULIA     (default: all four groups; the end-to-end test is not mutated here)
set -u
here=$(cd "$(dirname "$0")" && pwd); J=${1:?Julia executable}; src=$here/evidence/month-list; bad=0; n=0; groups=${MUTGROUPS:-lib data runner producer}
want() { [[ " $groups " == *" $1 "* ]]; }
verdict() { # name, expected set, rc, output, kind
  if [ "$3" -ne 0 ] && printf '%s\n' "$4" | grep -Eq "$2"; then echo "KILLED   $1 ($5)"; else echo "SURVIVED $1 (expected: $5, rc=$3)"; bad=1; fi
}
lib() { # name, failing test set, sed expression on the library copy
  want lib || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local d; d=$(mktemp -d)
  cp "$here/window_chain_lib.jl" "$d/lib.jl"; sed -i "$3" "$d/lib.jl"; cmp -s "$d/lib.jl" "$here/window_chain_lib.jl" && { echo "NOEFFECT $1"; bad=1; }
  local out; out=$(CAL7_BACKWARD_LIB=$d/lib.jl "$J" --startup-file=no "$here/test_window_chain_backward.jl" 2>&1); verdict "$1" "^$2: (Test Failed|Error During Test)" $? "$out" "$2"; rm -rf "$d"
}
data() { # name, failing test set, mutation (shell, run inside the copy)
  want data || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local d; d=$(mktemp -d)
  cp "$src"/* "$d"/; cp "$here"/evidence/print-c/{printing,layout}.tsv "$d"/; ( cd "$d" && eval "$3" )
  local out; out=$(CAL7_CHAINBACK_DIR=$d CAL7_CHAINBACK_PRINTC=$d "$J" --startup-file=no "$here/test_month_chain_back.jl" 2>&1); verdict "$1" "^$2: (Test Failed|Error During Test)" $? "$out" "$2"; rm -rf "$d"
}
runner() { # name, sed expression on a copy of run_checks.sh
  want runner || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local m="$here/run_checks_mut.sh"
  cp "$here/run_checks.sh" "$m"; sed -i "$2" "$m"; cmp -s "$m" "$here/run_checks.sh" && { echo "NOEFFECT $1"; bad=1; }
  local out rc=0; out=$(bash "$here/check_join_forwarding.sh" "$m" 2>&1) || rc=$?; verdict "$1" "^FAIL" $rc "$out" "join forwarding"; rm -f "$m"
}
producer() { # name, sed expression on a copy of window_chain.jl
  want producer || return; [ -z "${ONLY:-}" ] || [ "$ONLY" = "$1" ] || return; n=$((n+1)); local m="$here/window_chain_mut.jl"
  cp "$here/window_chain.jl" "$m"; sed -i "$2" "$m"; cmp -s "$m" "$here/window_chain.jl" && { echo "NOEFFECT $1"; bad=1; }
  local out rc=0; out=$(bash "$here/check_backward_refusals.sh" "$J" "$m" 2>&1) || rc=$?; verdict "$1" "^FAIL" $rc "$out" "backward refusals"; rm -f "$m"
}
L=months-back-1980-01-2019-01.tsv; B=best-effort-back-1980-01-2019-01.tsv; S=stages-back-1980-01-2019-01.tsv; C=coverage-back-1980-01-2019-01; H=february-hall-C-back.tsv
lib plan-not-reversed       "plan and root"                              's/^backward_plan(members)=reverse(members)/backward_plan(members)=members/'
lib root-text-accepted      "plan and root"                              '/isempty(root_text) || error/d'
lib root-first-member       "plan and root"                              's/^    members\[end\]$/    members[1]/'
lib state-index-off-by-one  "state snapshot numbering"                   's/    n+2-j$/    n+1-j/'
lib exponent-not-inverted   "export: forward-reading chain.v3"          's/(e==2 ? 2 : -e)/e/'
lib moves-not-reversed      "export: forward-reading chain.v3"           's/append!(out,\[invert_move(l) for l in reverse(b.moves)\])/append!(out,[invert_move(l) for l in b.moves])/'
lib edges-in-search-order   "export: forward-reading chain.v3"           's/    for k in n:-1:1$/    for k in 1:n/'
lib wrong-lines-of-edge-k   "export: forward-reading chain.v3"           's/k>=2 \&\& append!(out,bs\[k-1\].extra)/append!(out,bs[k].extra)/'
lib start-word-sorted       "export: forward-reading chain.v3"           's/start=vcat((b.moves for b in bs)...)/start=vcat((b.moves for b in reverse(bs))...)/'
lib best-start-accepted     "export rejections"                          '/is a best-effort month: a free start must show/d'
lib export-continuity       "export rejections"                          's/b.f\[8\]==prev || error/true || error/'
lib export-no-edge          "export rejections"                          's/n>=1 || error("no edge to export")/true/'
lib import-continuity       "import rejections"                          's/bs\[j\].f\[9\]==bs\[j+1\].f\[8\] || error/true || error/'
lib import-start-word       "import rejections"                          's/vcat(words...)==start || error/true || error/'
lib import-source-digest    "import rejections"                          's/bs\[1\].f\[8\]==src\[5\] || error/true || error/'
lib import-identity-exact   "import rejections"                          '/the identity pose is exact: best-effort month/d'
lib import-header-any       "import rejections"                          's/ls\[1\]=="cubistry.calendar7.chain.v3" || error("a backward prior/true || error("a backward prior/'
lib import-header-v1        "import is the inverse of the export"        's/ && (best=true)//'
lib records-bridge-abs      "month records of a decreasing plan"         's/abs(ym_index(ym)-ym_index(plan\[i-1\]))>1/(ym_index(ym)-ym_index(plan[i-1]))>1/'
lib records-before-name     "month records of a decreasing plan"         's/"before_month_list"/"before_chain_root"/'
lib tip-never-continues     "a best-effort tip is no stop"               's/^backward_must_continue(tip,best)=haskey(best,tip)/backward_must_continue(tip,best)=false/'
data duplicate-month        "range, order, count" "sed -i 's/^2000-05\$/2000-04/' $L"
data gap-month-removed      "range, order, count" "sed -i '/^2000-05\$/d' $L"
data first-month-1979-12    "range, order, count" "sed -i '1s/.*/1979-12/' $L"
data last-month-2018-12     "range, order, count" "sed -i '\$s/.*/2018-12/' $L"
data crlf                   "pin and format"      "sed -i 's/\$/\r/' $L"
data best-effort-missing    "best-effort file"    "sed -i '/^1998-02\t/d' $B"
data best-effort-first      "best-effort file"    "printf '1980-01\tbest_effort_unverified\t7,1\t$H\n' >> $B"
data best-effort-cell-7-7   "best-effort file"    "sed -i 's/^2009-02\tbest_effort_unverified\t7,1\t/2009-02\tbest_effort_unverified\t7,7\t/' $B"
data best-effort-unsorted   "best-effort file"    "awk 'NR==3{a=\$0;next} NR==4{print;print a;next} {print}' $B > t && mv t $B"
data hall-row-removed       "best-effort file"    "sed -i '/^1987-02\t/d' $H"
data hall-wrong-cell        "best-effort file"    "sed -i 's/^2015-02\t-3,-3,-3\t1\t7,1\t/2015-02\t-3,-3,-3\t1\t7,2\t/' $H"
data stage-too-long         "stage plan"          "sed -i 's/^2\t65\t128\t64\t64\t64\t2008-05/2\t65\t129\t65\t64\t65\t2008-05/' $S"
data stage-expect-prior     "stage plan"          "sed -i 's/^3\t129\t192\t64\t128\t/3\t129\t192\t64\t127\t/' $S"
data stage-start-best-effort "stage plan"         "sed -i 's/^6\t321\t384\t64\t320\t64\t1987-01/6\t321\t384\t64\t320\t64\t1987-02/' $S"
data coverage-headline      "coverage"            "sed -i 's/\t1981-01\t13\$/\t1981-01\t14/' $C.tsv"
data print-sticker-text     "months print C shows exactly" "awk -F'\t' -v OFS='\t' 'NR>1 && \$6==\"5\" && !d {\$6=\"x\"; d=1} {print}' printing.tsv > t && mv t printing.tsv"
runner join-end-not-to-flix "s/\"\${js:--}\" \"\${je:--}\"/\"\${js:--}\" -/"
runner join-start-end-swapped "s/\"\${js:--}\" \"\${je:--}\"/\"\${je:--}\" \"\${js:--}\"/"
runner join-end-not-exported "s/\[\[ -z \"\$je\" \]\] || export CAL7_JOIN_END//"
runner rule-after-join-dropped "s/flix_extra+=(29)/:/"
producer root-month-accepted "s/backward_root(members,get(ENV,\"CAL7_ROOT_MONTH\",\"\"))/members[end]/"
producer direction-unchecked "s/BACKWARD in (\"forward\",\"backward\") || error/true || error/"
producer best-first-accepted "s/^backward \&\& haskey(best,members\[1\]) \&\& error/false \&\& haskey(best,members[1]) \&\& error/"
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-}, MUTGROUPS=$groups)" >&2; exit 2; }
exit $bad
