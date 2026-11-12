#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# run_checks.sh passes CAL7_JOIN_START and CAL7_JOIN_END to all three checkers: the Julia checkers read them from the environment, the Flix
# checker takes them as the two arguments after the root month (then the rule `29`). Stub julia/java record what they get; no chain is checked.
#   check_join_forwarding.sh [RUN_CHECKS]       (about 1 s; RUN_CHECKS is a mutated copy in the tests of this test)
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd); rc=${1:-$here/run_checks.sh}
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT; bad=0
cat > "$d/julia" <<'STUB'
#!/usr/bin/env bash
echo "ok"; echo "julia ${CAL7_JOIN_START:-unset} ${CAL7_JOIN_END:-unset}" >> "$STUB_LOG"
STUB
cat > "$d/java" <<'STUB'
#!/usr/bin/env bash
echo "ok"; printf 'flix %s\n' "$*" >> "$STUB_LOG"
STUB
chmod +x "$d/julia" "$d/java"
H=$(printf 'a%.0s' $(seq 64)); G=$(printf 'b%.0s' $(seq 64)); P=$(printf 'c%.0s' $(seq 64)); M=$(printf 'd%.0s' $(seq 64)); L=$(printf 'e%.0s' $(seq 64))
run() { # name, expected tail of the Flix arguments, expected env line of the Julia checkers, then VAR=value settings
  local name=$1 want=$2 wantenv=$3; shift 3; export STUB_LOG="$d/log.$name"; : > "$STUB_LOG"
  ( unset CAL7_JOIN_START CAL7_JOIN_END CAL7_BEST_EFFORT_29 CAL7_ROOT_MONTH CAL7_WINDOW_LAYOUT CAL7_WINDOW_LAYOUT_SHA256
    export CAL7_WINDOW_MONTHS=/m.tsv CAL7_WINDOW_MONTHS_SHA256=$M CAL7_WINDOW_PRINT_SHA=$P; for kv in "$@"; do declare -x "$kv"; done
    bash "$rc" "$d/julia" "$d/java" /x.jar "$d/out.$name" > /dev/null 2> "$d/err.$name" ) || { echo "FAIL $name: run_checks.sh failed: $(head -c 300 "$d/err.$name")"; bad=1; return; }
  local got; got=$(grep '^flix' "$STUB_LOG" | head -1); local env; env=$(grep '^julia' "$STUB_LOG" | head -1)
  if [[ "$got" == *"months /m.tsv $M $P$want" && "$env" == "julia $wantenv" ]]; then echo "ok   $name"; else echo "FAIL $name: flix='$got' env='$env' want tail '$want' env '$wantenv'"; bad=1; fi
}
run none          ""                      "unset unset"
run only29        " - - - - 29"           "unset unset"      CAL7_BEST_EFFORT_29=1
run end-identity  " - - - identity"       "unset identity"   CAL7_JOIN_END=identity
run end-29        " - - - identity 29"    "unset identity"   CAL7_JOIN_END=identity CAL7_BEST_EFFORT_29=1
run start-end     " - - $H $G"            "$H $G"            CAL7_JOIN_START="$H" CAL7_JOIN_END="$G"
run start-only    " - - identity -"       "identity unset"   CAL7_JOIN_START=identity
run layout-root   " $L 2019-01 - identity" "unset identity"  CAL7_WINDOW_LAYOUT_SHA256="$L" CAL7_ROOT_MONTH=2019-01 CAL7_JOIN_END=identity
[[ $bad == 0 ]] && echo "join forwarding: 7 cases" || exit 1
