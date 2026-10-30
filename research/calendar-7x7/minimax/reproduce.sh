#!/usr/bin/env bash
# Independent verifier receipts remain separate from candidate generation.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel)
cd "$root"
julia_bin=${JULIA_BIN:-julia}
out=${CALENDAR7_MINIMAX_RESULTS_DIR:-$(mktemp -d /tmp/calendar7-minimax-check.XXXXXX)}
mkdir -p "$out"
dag="$out/source-dag.tsv"
gzip -dc "$here/../en-physical-review/all-targets-dag.tsv.gz" > "$dag"
git rev-parse HEAD > "$out/source-revision.txt"
"$julia_bin" --version > "$out/toolchains.log"
java -version >> "$out/toolchains.log" 2>&1
sha256sum "$dag" "$here/../english/evidence/physical-print.tsv" "$here"/verification/*.moves.tsv > "$out/inputs.sha256"
"$julia_bin" --startup-file=no "$here/test.jl" > "$out/tests.log" 2>&1
if [ "${1:---regenerate}" = --regenerate ]; then
    "$julia_bin" --startup-file=no "$here/../continuous/solver_chain.jl" "$dag" "$out/r2-baseline" > "$out/r2-baseline.log" 2>&1
    for i in 1 2 3 4; do
        cmp "$here/../continuous/evidence/chain-$i.moves.tsv" "$out/r2-baseline/chain-$i.moves.tsv"
    done
    "$julia_bin" --startup-file=no "$here/chains.jl" "$dag" "$out/regenerated" 8 20000 2 > "$out/regeneration.log" 2>&1
    "$julia_bin" --startup-file=no "$here/midge_probe.jl" "$dag" "$out/midge" 8 40000 > "$out/midge.log" 2>&1
    for i in 1 2 3 4; do
        cmp "$here/verification/chain-$i.moves.tsv" "$out/regenerated/chain-$i.moves.tsv"
    done
    cmp "$here/verification/midge-recovery.moves.tsv" "$out/midge/midge-recovery.moves.tsv"
elif [ "$1" != --verify-only ]; then
    printf 'Expected --regenerate (default) or --verify-only\n' >&2
    exit 1
fi
CALENDAR7_CHAIN_FLIX_BUILD_DIR=${CALENDAR7_MINIMAX_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-minimax-flix} \
    bash "$here/../continuous/flix/build.sh" > "$out/flix-build.log" 2>&1
jar="${CALENDAR7_MINIMAX_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-minimax-flix}/artifact/flix.jar"
java -Xmx8g -jar "$jar" selftest "$here/../english/evidence" "$here/../en-physical-review" > "$out/flix-selftest.log"
java -Xmx8g -jar "$jar" orientation-selftest "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$here/verification/chain-1.moves.tsv" > "$out/flix-orientation.log"
for name in chain-1 chain-2 chain-3 chain-4 midge-recovery; do
    input="$here/verification/$name.moves.tsv"
    "$julia_bin" --startup-file=no "$here/../continuous/verify.jl" "$dag" "$input" > "$out/julia-$name.tsv"
    java -Xmx8g -jar "$jar" chain "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$input" > "$out/flix-$name-full.tsv"
    tail -n 7 "$out/flix-$name-full.tsv" > "$out/flix-$name.tsv"
    cmp "$out/julia-$name.tsv" "$out/flix-$name.tsv"
    cmp "$here/verification/julia-$name.tsv" "$out/julia-$name.tsv"
done
"$julia_bin" --startup-file=no "$here/../continuous/negative_controls.jl" "$dag" "$here/verification/chain-1.moves.tsv" "$out/negative" > "$out/negative-generation.log"
printf 'fixture\tjulia-exit\tflix-exit\tinput-sha256\n' > "$out/negative-results.tsv"
for fixture in "$out"/negative/*.tsv; do
    name=$(basename -- "$fixture" .tsv)
    jc=0; fc=0
    "$julia_bin" --startup-file=no "$here/../continuous/verify.jl" "$dag" "$fixture" > "$out/negative/$name.julia.stdout" 2> "$out/negative/$name.julia.stderr" || jc=$?
    java -Xmx8g -jar "$jar" chain "$here/../english/evidence" "$here/../en-physical-review" "$dag" "$fixture" > "$out/negative/$name.flix.stdout" 2> "$out/negative/$name.flix.stderr" || fc=$?
    digest=$(sha256sum "$fixture");digest=${digest%% *}
    printf '%s\t%s\t%s\t%s\n' "$name" "$jc" "$fc" "$digest" >> "$out/negative-results.tsv"
    if [ "$jc" -ne 1 ] || [ "$fc" -ne 1 ]; then
        printf 'UNKNOWN: unexpected native decision; retain receipts and perform root-cause review.\n' >&2
        exit 1
    fi
done
printf 'PASS: five native chain agreements, nine shared rejections; receipts: %s\n' "$out"
