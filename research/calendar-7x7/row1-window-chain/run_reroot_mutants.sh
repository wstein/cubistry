#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of reroot_measure_lib.jl: each mutated copy must make the named test set of test_reroot_measure.jl fail.
# Usage: [ONLY=name] MUTANT_TMP=<dir> run_reroot_mutants.sh [julia]    (about 12 s each, 14 mutants; MUTANT_TMP must exist and is not /tmp)
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; bad=0; n=0
base=${MUTANT_TMP:-${TMPDIR:-}}
{ [ -n "$base" ] && [ -d "$base" ] && [ "${base%/}" != /tmp ]; } || { echo "set MUTANT_TMP to an existing directory outside /tmp" >&2; exit 2; }
run() { # name, test set that must fail, exact text, replacement (literal, no patterns)
  local name=$1 set=$2 old=$3 new=$4 t out rc src
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); t=$(mktemp -d -p "$base"); mkdir "$t/row1-window-chain"; cp "$here"/test_reroot_measure.jl "$t/row1-window-chain/"; ln -s "$here/evidence" "$t/row1-window-chain/evidence"
  src=$(<"$here/reroot_measure_lib.jl")
  if [[ "$src" != *"$old"* ]]; then echo "NOT APPLIED $name"; bad=1; rm -rf "$t"; return; fi
  printf '%s\n' "${src/"$old"/"$new"}" > "$t/row1-window-chain/reroot_measure_lib.jl"
  out=$(cd "$t" && "$julia" --startup-file=no "$t/row1-window-chain/test_reroot_measure.jl" 2>&1); rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -F "$set" | grep -Eq '\|[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+[0-9.]+s'; then echo "KILLED   $name ($set)"
  else echo "SURVIVED $name (expected failure in: $set, rc=$rc)"; bad=1; fi
  rm -rf "$t"
}
run lcp-all-max              "lcp"                          'n=min(n,lcp(ref,x));n==0 && break' 'n=max(n,lcp(ref,x));n==0 && break'
run wrong-as-move            "chain reader keeps move"      'push!(wr,(parse(Int,p[2]),parse(Int,p[3])))' 'push!(mv,(parse(Int,p[2]),parse(Int,p[3])))'
run unknown-record-ignored   "chain reader keeps move"      'else error("chain: unknown record $(p[1])");end' 'else end'
run finish-not-required      "chain reader keeps move"      'ls[end]=="finish" || error("chain: no finish record")' 'true'
run commit-without-extension "commit events of a logged"    'lcp(A,C)==length(C) || (skipped+=1;continue)' 'true'
run commit-on-equal          "commit events of a logged"    'h>htm(C) || continue' 'h>=htm(C) || continue'
run last-commit-dropped      "commit points"                'push!(chosen,length(ev))' 'push!(chosen,1)'
run threshold-zero-allowed   "commit points"                'all(t->t>=1,thresholds) || error("thresholds must be >= 1")' 'true'
run cost-sign                "re-root cost"                 'cost=s-free_htm' 'cost=free_htm-s'
run share-of-rest            "re-root cost"                 'share=s==0 ? NaN : ph/s' 'share=s==0 ? NaN : rh/s'
run seam-cancel-sign         "re-root cost"                 'seam_cancel(P,rest,norm)=length(P)+length(rest)-length(norm(vcat(P,rest)))' 'seam_cancel(P,rest,norm)=length(norm(vcat(P,rest)))-length(P)-length(rest)'
run sums-mismatch-ignored    "frozen inputs"                'sha256_file(p)==m[1] || error("sha256 mismatch for $(m[2])")' 'true'
run selection-keeps-measured "edge selection"               't.id∉measured && t.id∉be' 't.id∉be'
run selection-rank-offset    "edge selection"               'idx=unique([1+round(Int,(k-1)*(m-1)/(n-1)) for k in 1:n])' 'idx=unique([1+floor(Int,(k-1)*(m-1)/(n-1)) for k in 1:n])'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
