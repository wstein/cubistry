#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Source mutants of test_window_chain_best_effort.jl: each mutated copy of this directory must make the named test set fail.
# The copy lives in a temporary tree whose sibling directories (print, solver and checker code) are symlinks to the real ones.
# Usage: run_best_effort_mutants.sh [julia]
#   mutants 1 to 5 are caught by the units and the print C tests (about 30 s each, CAL7_BE_REAL=0);
#   mutant 6 (the producer stops before the best-effort month) needs the producer as a process: the real edge test, several minutes.
set -u
here=$(cd "$(dirname "$0")" && pwd); cal=$(dirname "$here"); julia=${1:-julia}; bad=0
run() { # name, test set that must fail, real edge test (0|1), file to mutate, sed expression
  local name=$1 set=$2 real=$3 file=$4 expr=$5 t out rc
  t=$(mktemp -d); mkdir "$t/row1-window-chain"
  for d in "$cal"/*; do [ "$d" = "$here" ] || ln -s "$d" "$t/$(basename "$d")"; done
  for f in "$here"/*.jl "$here"/*.sh "$here"/README.md; do cp "$f" "$t/row1-window-chain/"; done
  ln -s "$here/evidence" "$t/row1-window-chain/evidence"
  cp "$t/row1-window-chain/$file" "$t/orig"; sed -i "$expr" "$t/row1-window-chain/$file"
  if cmp -s "$t/orig" "$t/row1-window-chain/$file"; then echo "NOT APPLIED $name"; bad=1; rm -rf "$t"; return; fi
  out=$(cd /tmp && CAL7_BE_REAL=$real "$julia" --startup-file=no --threads=4 "$t/row1-window-chain/test_window_chain_best_effort.jl" 2>&1); rc=$?
  if [ $rc -ne 0 ] && printf '%s\n' "$out" | grep -Eq "^[[:space:]]*$set[[:space:]]*\|[[:space:]]+[0-9 ]*[0-9]+[[:space:]]+[0-9]+"; then echo "KILLED   $name ($set)"
  else echo "SURVIVED $name (expected failure in: $set, rc=$rc)"; bad=1; fi
  rm -rf "$t"
}
L=window_chain_lib.jl
run wrong-cell-default-7-7   "wrong cell: file, switch, corner cells only"        0 $L 's/isempty(switch) ? file_cells : switch/isempty(switch) ? "7,7" : switch/'
run digit-29-not-required    "what counts as 29: text and ink, every sticker that carries it" 0 $L 's/^shows_art(sticker,art)=sticker.text==art\[1\] && /shows_art(sticker,art)=/'
run dedup-by-text-and-ink    "what counts as 29: text and ink, every sticker that carries it" 0 $L 's/^art_stickers(source,art)=\[s.id for s in source if s.text==art\[1\] && s.ink==art\[2\]\]/art_stickers(source,art)=first.(values(Dict((s.text,s.ink)=>[s.id] for s in reverse(source) if s.text==art[1] \&\& s.ink==art[2])))/'
run hall-line-missing        "edge lines and header"                               0 $L 's/,"hall\\t"\*join(("\$r,\$c" for (r,c) in best_effort_hall()),'"';'"')\]/]/'
run ink-not-in-rule          "what counts as 29: text and ink, every sticker that carries it" 0 $L 's/^best_effort_ink(c)=c in (1,7) ? "red" : "dark"/best_effort_ink(c)="dark"/'
run stop-before-best-effort  "real best-effort edge 2026-02 on print C"            1 window_chain.jl 's/^    stop===nothing || break$/    stop===nothing \&\& haskey(best,plan[edges_before+2+done]) \&\& (stop="best_effort_month")\n    stop===nothing || break/'
exit $bad
