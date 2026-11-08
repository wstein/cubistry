#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runner for chain_controls.sh and the chain workflow: the Flix chain verifier, strict rule.
#   chain_runner_flix.sh PRINT CHAIN ROOT_MOVES         (env FLIX_JAR = pure-split-states/flix/build.sh jar)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
cal=$(cd -- "$here/.." && pwd)
: "${FLIX_JAR:?FLIX_JAR must point at the pure-split Flix jar}"
exec java -Dstdout.encoding=UTF-8 -Xmx6g -jar "$FLIX_JAR" chain "$1" - "$2" "$cal/english/evidence" "$cal/en-physical-review" strict "$3"
