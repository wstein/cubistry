#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# End-to-end test of window_chain.jl direction=backward on a tiny list (print C, layout C). Opt-in: it builds the beam library twice and computes 3 edges.
#   run_backward_e2e.sh JULIA JAVA CHAIN_JAR OUT        (OUT: a new scratch directory; time: see the README of evidence/month-list, UNKNOWN until measured)
# Run A: list 2037-01, 2037-02, 2041-01 (root = identity pose = 2041-01, Jan/Tue/31 like 2019-01). The first edge is a bridge edge (2037-02 is 47 months earlier) into
#        the best-effort month 2037-02 (February, Sunday, 28 days; max_edges=1 must not stop at that tip), the second edge goes to 2037-01.
# Run B: list 2036-12 .. 2041-01 with prior = the exported chain of run A and max_edges=1 (one new edge into 2036-12): the continuation.
# Positive: the three checkers (Julia, Flix, independent) accept A and B with CAL7_JOIN_END=identity and the 29 rule, Julia and Flix receipts byte-identical.
# Negative: a wrong CAL7_JOIN_END and CAL7_ROOT_MONTH are rejected by all three; the producer refuses a root month and a best-effort first member.
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
J=${1:?Julia executable}; JAVA=${2:?Java executable}; JAR=${3:?Flix chain checker jar}; OUT=${4:?new scratch directory}
[[ ! -e "$OUT" ]] || { echo "OUT exists: $OUT" >&2; exit 2; }
mkdir -p "$OUT"
PR=$here/evidence/print-c/printing.tsv; LAY=$here/evidence/print-c/layout.tsv
PS=0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc; LS=e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a
IDENT=780201ff253bd9769cfeee9c7f3f66e94bc988db83d97e25e258df20e12c4d72   # digest of the identity pose of print C (the root of the first chain)
EVID=$here/../english/evidence
n=0; bad=0
ok()   { n=$((n+1)); echo "ok   $1"; }
fail() { n=$((n+1)); bad=1; echo "FAIL $1"; }
sha() { sha256sum "$1" | cut -d' ' -f1; }
printf '2037-01\n2037-02\n2041-01\n' > "$OUT/list-a.tsv"
printf '2036-12\n2037-01\n2037-02\n2041-01\n' > "$OUT/list-b.tsv"
printf 'month\tstatus\twrong_cells\tevidence\n2037-02\tbest_effort_unverified\t7,1\tnone\n' > "$OUT/best.tsv"
printf 'month\tstatus\twrong_cells\tevidence\n2037-01\tbest_effort_unverified\t7,1\tnone\n' > "$OUT/best-first.tsv"
producer() { # name list env-extra... -- producer args
  local name=$1 list=$2; shift 2
  ( export CAL7_WINDOW_MONTHS="$list" CAL7_WINDOW_MONTHS_SHA256 CAL7_WINDOW_PRINT_SHA=$PS CAL7_WINDOW_LAYOUT=$LAY CAL7_WINDOW_LAYOUT_SHA256=$LS
    CAL7_WINDOW_MONTHS_SHA256=$(sha "$list")
    timeout 1500 "$J" --startup-file=no --threads=4 "$here/window_chain.jl" "$OUT/$name" "$PR" "$@" ) > "$OUT/$name.log" 2>&1
}
chk_env() { # list -> exports the checker contract
  export CAL7_WINDOW_MONTHS="$1" CAL7_WINDOW_MONTHS_SHA256 CAL7_WINDOW_PRINT_SHA=$PS CAL7_WINDOW_LAYOUT=$LAY CAL7_WINDOW_LAYOUT_SHA256=$LS CAL7_BEST_EFFORT_29=1
  CAL7_WINDOW_MONTHS_SHA256=$(sha "$1")
}
accept() { # name list edges best_edges: the three checkers on OUT/name
  local name=$1 list=$2 edges=$3 best=$4 d="$OUT/$1" c="$OUT/$1.chk"
  ( chk_env "$list"; export CAL7_JOIN_END=identity PRINT_OVERRIDE=$PR CHAIN_OVERRIDE=$d/chain.moves.tsv STATES_OVERRIDE=$d/states
    bash "$here/run_checks.sh" "$J" "$JAVA" "$JAR" "$c" > "$OUT/$name.chk.log" 2>&1 ) && ok "$name: Julia, Flix and the independent verifier accept (run_checks.sh)" || { fail "$name: checkers: $(tail -c 400 "$OUT/$name.chk.log")"; return; }
  cmp -s "$c/julia.tsv" "$c/flix.tsv" && ok "$name: Julia and Flix receipts are byte-identical" || fail "$name: receipts differ"
  grep -qx $'verdict\tBEST_EFFORT\tlegal-retained-state-window-chain\t'"$((edges+1))"$'\t'"$edges" "$c/julia.tsv" && ok "$name: verdict BEST_EFFORT, $edges edges" || fail "$name: verdict line"
  grep -qx $'status\texact\t'"$((edges-best))"$'\tbest_effort\t'"$best" "$c/julia.tsv" && ok "$name: $best best-effort edge(s)" || fail "$name: status line"
  grep -qx $'join\tend\t'"$IDENT" "$c/julia.tsv" && ok "$name: ends at the identity pose (join end $IDENT)" || fail "$name: join end line"
  grep -q $'^independent-verdict\tACCEPT_BEST_EFFORT_CHAIN\t' "$c/independent.tsv" && grep -qx $'independent-join\tend\t'"$IDENT" "$c/independent.tsv" && ok "$name: independent verifier accepts and joins at the identity pose" || fail "$name: independent verdict"
  grep -q $'\tBRIDGE' "$c/julia.tsv" && ok "$name: the edge into the identity pose is a bridge edge" || fail "$name: no BRIDGE flag"
}
# ---- run A -------------------------------------------------------------------------------------------------------------------------
producer a "$OUT/list-a.tsv" direction=backward best_effort="$OUT/best.tsv" max_edges=1 && ok "run A: producer finished (exit 0)" || fail "run A: producer: $(tail -c 400 "$OUT/a.log")"
[[ -f "$OUT/a/chain.moves.tsv" ]] || { echo "no chain from run A"; exit 1; }
head -1 "$OUT/a/chain.moves.tsv" | grep -qx cubistry.calendar7.chain.v3 && ok "run A: chain.v3" || fail "run A: header"
grep -qx 'complete=true' "$OUT/a/PROGRESS.txt" && grep -qx 'edges_total=2' "$OUT/a/PROGRESS.txt" && ok "run A: max_edges=1 did not stop at the best-effort tip: 2 edges, complete" || fail "run A: progress: $(tr '\n' ' ' < "$OUT/a/PROGRESS.txt")"
grep -qx 'direction=backward' "$OUT/a/PROGRESS.txt" && grep -qx 'chain_start=2037-01' "$OUT/a/PROGRESS.txt" && grep -qx 'chain_end=2041-01' "$OUT/a/PROGRESS.txt" && grep -qx 'best_effort_edges=1' "$OUT/a/PROGRESS.txt" && ok "run A: PROGRESS direction, chain_start, chain_end, best_effort_edges" || fail "run A: PROGRESS fields"
accept a "$OUT/list-a.tsv" 2 1
# ---- negatives on the chain of run A -------------------------------------------------------------------------------------------------
reject() { # name, expected text in the output, env assignments...  (all three checkers must fail)
  local name=$1 want=$2; shift 2; local d="$OUT/a" r="$OUT/neg-$name" k
  mkdir -p "$r"; local flix=(months "$OUT/list-a.tsv" "$(sha "$OUT/list-a.tsv")" "$PS" "$LS")
  for k in julia flix independent; do
    ( chk_env "$OUT/list-a.tsv"; export CAL7_JOIN_END=identity; for kv in "$@"; do declare -x "$kv"; done
      case $k in
        julia) "$J" --startup-file=no "$here/check.jl" "$LAY" "$PR" "$d/chain.moves.tsv" "$d/states" ;;
        independent) "$J" --startup-file=no "$here/verify_chain.jl" "$LAY" "$PR" "$d/chain.moves.tsv" "$d/states" ;;
        flix) root=-; je=identity; for kv in "$@"; do case $kv in CAL7_ROOT_MONTH=*) root=${kv#*=};; CAL7_JOIN_END=*) je=${kv#*=};; esac; done
              "$JAVA" -Xmx2g -jar "$JAR" "$LAY" "$PR" "$d/chain.moves.tsv" "$d/states" "$EVID" "${flix[@]}" "$root" - "$je" 29 ;;
      esac ) > "$r/$k.out" 2>&1
    rc=$?
    if [[ $rc -ne 0 ]] && grep -qi -- "$want" "$r/$k.out"; then ok "$name rejected by $k"; else fail "$name: $k rc=$rc: $(tail -c 200 "$r/$k.out")"; fi
  done
}
reject wrong-join-end "end junction digest" CAL7_JOIN_END=aec0c66defe82197da48ddb6c15e269902f474d1d00fd5aab49f62e9fe82821c
reject root-month "root" CAL7_ROOT_MONTH=2041-01
# ---- run B: the continuation ----------------------------------------------------------------------------------------------------------
producer b "$OUT/list-b.tsv" direction=backward best_effort="$OUT/best.tsv" max_edges=1 prior="$OUT/a" && ok "run B: producer finished (exit 0)" || fail "run B: producer: $(tail -c 400 "$OUT/b.log")"
grep -qx 'edges_total=3' "$OUT/b/PROGRESS.txt" && grep -qx 'edges_new=1' "$OUT/b/PROGRESS.txt" && grep -qx 'chain_start=2036-12' "$OUT/b/PROGRESS.txt" && grep -qx 'complete=true' "$OUT/b/PROGRESS.txt" && ok "run B: one new edge into 2036-12, 3 edges in total" || fail "run B: progress: $(tr '\n' ' ' < "$OUT/b/PROGRESS.txt")"
accept b "$OUT/list-b.tsv" 3 1
# the old edges are carried over: the start word of B begins with the start word of A (the new edge is prepended to the search)
a1=$(grep -c '^move' "$OUT/a/chain.moves.tsv"); b1=$(grep -c '^move' "$OUT/b/chain.moves.tsv"); [[ $b1 -gt $a1 ]] && ok "run B: more moves than run A ($a1 -> $b1)" || fail "run B: moves"
cmp -s <(sed -n '1,/^edge/p' "$OUT/a.search/chain.moves.tsv" | head -2) <(sed -n '1,/^edge/p' "$OUT/b.search/chain.moves.tsv" | head -2) && ok "run B: the search chain keeps the root record of run A" || fail "run B: root record"
cmp -s "$OUT/a.search/states/state-01.tsv" "$OUT/b.search/states/state-01.tsv" && ok "run B: identity snapshot unchanged" || fail "run B: snapshot"
# ---- producer refusals (fast: they stop before the library is built) ----------------------------------------------------------------------
( export CAL7_ROOT_MONTH=2041-01; producer c "$OUT/list-a.tsv" direction=backward ) ; grep -q "root_month must be empty" "$OUT/c.log" && ok "producer: a root month is refused" || fail "producer: root month accepted: $(tail -c 200 "$OUT/c.log")"
producer d "$OUT/list-a.tsv" direction=sideways; grep -q "direction must be forward or backward" "$OUT/d.log" && ok "producer: unknown direction is refused" || fail "producer: direction: $(tail -c 200 "$OUT/d.log")"
printf '2037-02\n2041-01\n' > "$OUT/list-c.tsv"
producer e "$OUT/list-c.tsv" direction=backward best_effort="$OUT/best.tsv"; grep -q "earliest month 2037-02 is declared best-effort" "$OUT/e.log" && ok "producer: a best-effort first member is refused" || fail "producer: best-effort start: $(tail -c 200 "$OUT/e.log")"
echo "backward e2e: $n checks, $([[ $bad == 0 ]] && echo all passed || echo FAILED)"
exit $bad
