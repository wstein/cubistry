#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of root_change.jl: each mutated copy must make test_root_change.jl fail at the named reason.
# Usage: [ONLY=mutant-name] run_root_change_mutants.sh [julia]
# Time: every mutant is one run of the test (about 10 s); ONLY=name selects one.
set -u
here=$(cd "$(dirname "$0")" && pwd); julia=${1:-julia}; bad=0; n=0
run() { # name, regex of the failure that must appear in the output, perl substitution applied to the copy (must change the file)
  local name=$1 reason=$2 d out rc
  [ -z "${ONLY:-}" ] || [ "$ONLY" = "$name" ] || return
  n=$((n+1)); d=$(mktemp -d); mkdir "$d/a"; ln -s "$here/../upright-moves" "$d/upright-moves"; cp "$here/root_change.jl" "$d/a/"
  perl -0pi -e "$3" "$d/a/root_change.jl"
  if cmp -s "$here/root_change.jl" "$d/a/root_change.jl"; then echo "NOCHANGE $name"; bad=1; rm -rf "$d"; return; fi
  out=$(CAL7_ROOTCHANGE_LIB=$d/a/root_change.jl "$julia" --startup-file=no "$here/test_root_change.jl" 2>&1); rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "$reason"; then echo "KILLED   $name ($reason)"
  else echo "SURVIVED $name (expected: $reason, rc=$rc)"; bad=1; fi
  rm -rf "$d"
}
run wrong-side          "root state is the identity"        's/J=\[slot\[\(p\.pos,p\.normal\)\] for p in P\]/J0=[slot[(p.pos,p.normal)] for p in P]; J=invperm(J0)/'
run slot-with-up        "KeyError"      's/slot=Dict\(\(s\.pos,s\.normal\)=>s\.id/slot=Dict((s.pos,s.normal,s.up)=>s.id/; s/slot\[\(p\.pos,p\.normal\)\]/slot[(p.pos,p.normal,p.up)]/'
run print-up-kept       "root state is the identity"               's/up=root\[J\[p\.id\]\]\.up,text/up=p.up,text/'
run state-up-from-print "root and fronts"        's/up=st\[J\[p\.id\]\]\.up,text/up=Pn[p.id].up,text/'
run edge-digest-old     "digests"                's/state_sha\(S\[k-1\]\),state_sha\(S\[k\]\)/e.sh,e.eh/'
run source-digest-old   "digests"                's/\\t\$\(state_sha\(S\[1\]\)\)"\]/\\t\$(chains[1].src.hash)"]/'
run join-month-twice    "root and fronts" 's/p\[2:end\] for p in parts\[2:end\]/p for p in parts[2:end]/'
run join-month-listed   "months and best effort" 's/k==1 && push!\(seq/push!(seq/'
run join-month-unchecked "joins are checked"     's/\@assert \(ch\.src\.year,ch\.src\.month\)==last\.month "chains join in one month"//'
run join-state-unchecked "joins are checked"     's/\@assert canon\(states\[1\]\)==canon\(last\.state\) "chains join in one state"//'
run start-word-ignored  "inputs are refused|Test threw|ERROR" 's/st=ch\.startword===nothing \? P : apply_word\(P,ch\.startword\)/st=P/'
run end-digest-unchecked "inputs are refused"    's/\@assert state_sha\(st\)==e\.eh "edge end digest";//'
run source-digest-unchecked "inputs are refused" 's/\@assert state_sha\(st\)==ch\.src\.hash "source digest of the chain"//'
run extra-lines-dropped "months and best effort|words unchanged" 's/append!\(lines,e\.extra\);//'
run best-effort-wrong   "BoundsError" 's/startswith\(x,"wrong\\t"\)\]/startswith(x,"hall\\t")]/'
run manifest-skipped    "manifest and provenance" 's/write\(joinpath\(out,f\),encode\(s\)\);push!\(man,ID\(joinpath\(out,f\)\)\*"  "\*f\)/write(joinpath(out,f),encode(s));push!(man,"0"^64*"  "*f)/'
[ $n -ge 1 ] || { echo "no mutant selected (ONLY=${ONLY:-})" >&2; exit 2; }
exit $bad
