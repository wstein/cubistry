#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel)
cd "$root"
julia_bin=${JULIA_BIN:-julia}
out=${CALENDAR7_RESULTS_DIR:-$(mktemp -d /tmp/calendar7-practical-results.XXXXXX)}
mkdir -p "$out"
dag="$out/source-dag.tsv"
candidate="$here/evidence/feb-mar-2026.tsv"
gzip -dc "$here/../en-physical-review/all-targets-dag.tsv.gz" > "$dag"
"$julia_bin" --version > "$out/toolchains.log"
java -version >> "$out/toolchains.log" 2>&1
sha256sum "$here/../english/evidence/physical-print.tsv" "$dag" "$candidate" > "$out/inputs.sha256"
"$julia_bin" --startup-file=no "$here/solver_macros.jl" "$dag" "$out/generated" > "$out/generator.log" 2>&1
cmp "$candidate" "$out/generated/feb-mar-2026.moves.tsv"
"$julia_bin" --startup-file=no "$here/solver_macros_test.jl" > "$out/macro-tests.log" 2>&1
"$julia_bin" --startup-file=no "$here/test.jl" "$dag" "$candidate" > "$out/julia-tests.log" 2>&1
"$julia_bin" --startup-file=no "$here/verify.jl" "$dag" "$candidate" > "$out/julia.tsv"
"$julia_bin" --startup-file=no "$here/analyze_domain.jl" "$out/domain" > "$out/domain.log"
cmp "$here/evidence/domain-transitions.tsv" "$out/domain/transitions.tsv"
cmp "$here/evidence/same-date-grid.tsv" "$out/domain/same-date-grid.tsv"
bash "$here/flix/build.sh" > "$out/flix-build.log" 2>&1
CALENDAR7_FLIX_TEST_DIR="$out/flix-tests" bash "$here/flix/test.sh" "$dag" "$candidate" > "$out/flix-tests.log"
# The inherited DAG progress records are diagnostic, not verifier verdicts.
tail -n 4 "$out/flix-tests/valid.tsv" > "$out/flix.tsv"
cmp "$out/julia.tsv" "$out/flix.tsv"
for entry in '38 2029' '50 2030'; do
    read -r source_id year <<< "$entry"
    selected="$here/evidence/feb-mar-$year.tsv"
    "$julia_bin" --startup-file=no "$here/solver_macros.jl" "$dag" "$out/generated-$year" "$source_id" "$year" 3 > "$out/generator-$year.log" 2>&1
    cmp "$selected" "$out/generated-$year/feb-mar-$year.moves.tsv"
    "$julia_bin" --startup-file=no "$here/verify.jl" "$dag" "$selected" > "$out/julia-$year.tsv"
    java -Xmx8g -jar "${CALENDAR7_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-practical-flix}/artifact/flix.jar" transition "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$selected" > "$out/flix-$year-full.tsv"
    tail -n 4 "$out/flix-$year-full.tsv" > "$out/flix-$year.tsv"
    cmp "$out/julia-$year.tsv" "$out/flix-$year.tsv"
done
printf 'Both native replays agree; receipts: %s\n' "$out"
