#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel)
cd "$root"
julia_bin=${JULIA_BIN:-julia}
out=${CALENDAR7_CHAIN_RESULTS_DIR:-$(mktemp -d /tmp/calendar7-continuous-results.XXXXXX)}
mkdir -p "$out"
dag="$out/source-dag.tsv"
gzip -dc "$here/../en-physical-review/all-targets-dag.tsv.gz" > "$dag"
git rev-parse HEAD > "$out/source-revision.txt"
"$julia_bin" --version > "$out/toolchains.log"
java -version >> "$out/toolchains.log" 2>&1
sha256sum "$dag" "$here/../english/evidence/physical-print.tsv" "$here/verify.jl" "$here/flix/src/Main.flix" "$here"/evidence/chain-*.moves.tsv > "$out/inputs.sha256"
"$julia_bin" --startup-file=no "$here/test.jl" > "$out/parser-tests.log" 2>&1
"$julia_bin" --startup-file=no "$here/solver_chain_test.jl" > "$out/macro-tests.log" 2>&1
"$julia_bin" --startup-file=no "$here/solver_chain.jl" "$dag" "$out/generated" > "$out/generator.log" 2>&1
for chain in 1 2 3 4; do
    cmp "$here/evidence/chain-$chain.moves.tsv" "$out/generated/chain-$chain.moves.tsv"
done
"$julia_bin" --startup-file=no "$here/solver_state_selection.jl" "$dag" "$out/state-selection" > "$out/state-selection.log" 2>&1
for name in hidden-corner hidden-axial-center hidden-midge-prefix; do
    cmp "$here/evidence/state-selection/$name.moves.tsv" "$out/state-selection/$name.moves.tsv"
done
# Only elapsed time (column 7) varies in this deterministic candidate survey.
cut -f1-6,8- "$here/evidence/state-selection/state-selection.tsv" > "$out/selection-expected.tsv"
cut -f1-6,8- "$out/state-selection/state-selection.tsv" > "$out/selection-generated.tsv"
cmp "$out/selection-expected.tsv" "$out/selection-generated.tsv"
"$julia_bin" --startup-file=no "$here/negative_controls.jl" "$dag" "$here/evidence/chain-1.moves.tsv" "$out/negative" > "$out/negative-generation.log"
bash "$here/flix/build.sh" > "$out/flix-build.log" 2>&1
jar="${CALENDAR7_CHAIN_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-continuous-flix}/artifact/flix.jar"
java -Xmx8g -jar "$jar" selftest "$here/../english/evidence" "$here/../en-physical-review" > "$out/flix-selftest.log"
for chain in 1 2 3 4; do
    input="$here/evidence/chain-$chain.moves.tsv"
    "$julia_bin" --startup-file=no "$here/verify.jl" "$dag" "$input" > "$out/julia-chain-$chain.tsv"
    java -Xmx8g -jar "$jar" chain "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$input" > "$out/flix-chain-$chain-full.tsv"
    # Each selected fixture has exactly two edges: seven shared receipt lines.
    tail -n 7 "$out/flix-chain-$chain-full.tsv" > "$out/flix-chain-$chain.tsv"
    cmp "$out/julia-chain-$chain.tsv" "$out/flix-chain-$chain.tsv"
done
printf 'fixture\tjulia-exit\tflix-exit\tinput-sha256\n' > "$out/negative-results.tsv"
for fixture in "$out"/negative/*.tsv; do
    name=$(basename -- "$fixture" .tsv)
    julia_code=0; flix_code=0
    "$julia_bin" --startup-file=no "$here/verify.jl" "$dag" "$fixture" > "$out/negative/$name.julia.stdout" 2> "$out/negative/$name.julia.stderr" || julia_code=$?
    java -Xmx8g -jar "$jar" chain "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$fixture" > "$out/negative/$name.flix.stdout" 2> "$out/negative/$name.flix.stderr" || flix_code=$?
    input_hash=$(sha256sum "$fixture"); input_hash=${input_hash%% *}
    printf '%s\t%s\t%s\t%s\n' "$name" "$julia_code" "$flix_code" "$input_hash" >> "$out/negative-results.tsv"
    if [ "$julia_code" -ne 1 ] || [ "$flix_code" -ne 1 ]; then
        printf 'UNKNOWN: unexpected native result; retain receipts and investigate before proceeding.\n' >&2
        exit 1
    fi
done
"$julia_bin" --startup-file=no "$here/statistics.jl" "$here"/evidence/chain-{1,2,3,4}.moves.tsv > "$out/statistics.tsv"
cmp "$here/evidence/statistics.tsv" "$out/statistics.tsv"
printf 'Four continuous chains independently accepted; nine corrupt chains rejected. Receipts: %s\n' "$out"
