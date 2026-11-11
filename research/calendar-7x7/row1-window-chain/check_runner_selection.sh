#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# The fixture runner selects what it claims: the default call runs fixtures, ONLY selects by name, an empty selection and a bad GROUP fail.
#   check_runner_selection.sh JULIA JAVA CHAIN_JAR OUT
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
J=${1:?julia}; JAVA=${2:?java}; jar=${3:?jar}; out=${4:?scratch dir}
run() { bash "$here/run_root_best_effort_checks.sh" "$J" "$JAVA" "$jar" "$out/$1" 2>&1; }
r=$(ONLY="exact-v2 best-effort-no-hall" run a) || { echo "default call with ONLY failed: $r" >&2; exit 1; }
[[ $r == *"1 accepted, 1 rejected"* ]] || { echo "ONLY did not run both fixtures: $r" >&2; exit 1; }
r=$(GROUP=4/4 run b) && { echo "GROUP=4/4 passed: $r" >&2; exit 1; }
r=$(GROUP=0/0 run c) && { echo "GROUP=0/0 passed" >&2; exit 1; }
r=$(GROUP=x run d) && { echo "GROUP=x passed" >&2; exit 1; }
r=$(ONLY="no-such-fixture" run e) && { echo "empty selection passed" >&2; exit 1; }
echo "runner selection: ONLY runs 2 fixtures, GROUP=4/4, 0/0, x and an empty selection fail"
