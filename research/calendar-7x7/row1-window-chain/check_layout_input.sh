#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# run_checks.sh takes the layout from CAL7_WINDOW_LAYOUT (path) with CAL7_WINDOW_LAYOUT_SHA256; without them it reads
# ../row1-revision/layout.tsv as before. Julia and Java are stubs that record their arguments; no checker runs.
#   check_layout_input.sh
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
printf '#!/usr/bin/env bash\necho "julia $* LAYOUT_SHA=${CAL7_WINDOW_LAYOUT_SHA256:--}" >> "$STUB_LOG"\necho ok\n' > "$tmp/julia"
printf '#!/usr/bin/env bash\necho "java $*" >> "$STUB_LOG"\necho ok\n' > "$tmp/java"
chmod +x "$tmp/julia" "$tmp/java"; : > "$tmp/jar"
printf 'a\tb\n' > "$tmp/layout.tsv"
sha=$(sha256sum "$tmp/layout.tsv" | cut -d' ' -f1)
months="$tmp/months.tsv"; printf '2026-05\n2026-06\n' > "$months"
msha=$(sha256sum "$months" | cut -d' ' -f1); psha=$(printf 'p%.0s' {1..64})
export STUB_LOG="$tmp/log" CAL7_WINDOW_MONTHS="$months" CAL7_WINDOW_MONTHS_SHA256="$msha" CAL7_WINDOW_PRINT_SHA="$psha"
run() { : > "$STUB_LOG"; bash "$here/run_checks.sh" "$tmp/julia" "$tmp/java" "$tmp/jar" "$tmp/out$1" > "$tmp/stdout" 2> "$tmp/stderr"; }
fail() { echo "FAIL: $1" >&2; cat "$tmp/stderr" "$STUB_LOG" >&2; exit 1; }
default="$here/../row1-revision/layout.tsv"

# 1. no layout input: the old path, no layout pin passed on
run a || fail "default call failed"
grep -q "check.jl $default " "$STUB_LOG" || fail "default: check.jl does not read row1-revision/layout.tsv"
grep -q "verify_chain.jl $default " "$STUB_LOG" || fail "default: verify_chain.jl does not read row1-revision/layout.tsv"
grep -q "^java .* $default " "$STUB_LOG" || fail "default: Flix does not read row1-revision/layout.tsv"
grep -q "LAYOUT_SHA=-" "$STUB_LOG" || fail "default: a layout pin leaked into the environment"
grep -q "$sha" "$STUB_LOG" && fail "default: the layout pin appears in the arguments"

# 2. path and SHA: all three checkers read the path, Julia sees the pin in the environment, Flix gets it as argument
CAL7_WINDOW_LAYOUT="$tmp/layout.tsv" CAL7_WINDOW_LAYOUT_SHA256="$sha" run b || fail "layout input failed"
for c in check.jl verify_chain.jl; do grep -q "$c $tmp/layout.tsv " "$STUB_LOG" || fail "layout input: $c does not read the given layout"; done
grep -q "^java .* $tmp/layout.tsv " "$STUB_LOG" || fail "layout input: Flix does not read the given layout"
grep -q "^java .* $psha $sha\$" "$STUB_LOG" || fail "layout input: Flix does not get the layout SHA-256 after the print SHA-256"
[[ $(grep -c "LAYOUT_SHA=$sha" "$STUB_LOG") == 2 ]] || fail "layout input: Julia does not see the pin"
# 2b. with a root month the pin stays before the root month
CAL7_ROOT_MONTH=2026-05 CAL7_WINDOW_LAYOUT="$tmp/layout.tsv" CAL7_WINDOW_LAYOUT_SHA256="$sha" run c || fail "layout input with root failed"
grep -q "^java .* $psha $sha 2026-05\$" "$STUB_LOG" || fail "layout input with root: argument order differs"

# 3. refusals: no SHA, wrong SHA, missing file, window-end mode
CAL7_WINDOW_LAYOUT="$tmp/layout.tsv" run d && fail "a layout path without SHA-256 passed"
[[ -s "$STUB_LOG" ]] && fail "a layout path without SHA-256 started a checker"
CAL7_WINDOW_LAYOUT="$tmp/layout.tsv" CAL7_WINDOW_LAYOUT_SHA256="$psha" run e && fail "a wrong layout SHA-256 passed"
[[ -s "$STUB_LOG" ]] && fail "a wrong layout SHA-256 started a checker"
CAL7_WINDOW_LAYOUT="$tmp/none.tsv" CAL7_WINDOW_LAYOUT_SHA256="$sha" run f && fail "a missing layout passed"
(unset CAL7_WINDOW_MONTHS CAL7_WINDOW_MONTHS_SHA256; CAL7_WINDOW_LAYOUT="$tmp/layout.tsv" CAL7_WINDOW_LAYOUT_SHA256="$sha" run g) && fail "a layout input without a month list passed"
echo "layout input: default path kept, path+SHA reach 3 checkers, 4 refusals (no SHA, wrong SHA, missing file, no month list)"
