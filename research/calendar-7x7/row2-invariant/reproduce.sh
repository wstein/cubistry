#!/usr/bin/env bash
# Orchestration only; Julia and Flix independently make all proof decisions.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
work=${1:-/tmp/cubistry-calendar7-row2-reproduction}
julia_bin=${JULIA_BIN:-julia}
source_commit=545e342b75d883e88159fd31d8acfcdee3b95f59
if ! git -C "$repo" cat-file -e "$source_commit^{commit}"; then
    printf 'Missing pinned research dependency %s; fetch PR #115 before reproduction.\n' "$source_commit" >&2
    exit 1
fi
mkdir -p "$work"
gzip -dc "$repo/research/calendar-7x7/en-physical-review/all-targets-dag.tsv.gz" > "$work/legal-dag.tsv"
chains=()
for name in chain-1 chain-2 chain-3 chain-4 midge-recovery; do
    git -C "$repo" show "$source_commit:research/calendar-7x7/minimax/verification/$name.moves.tsv" > "$work/$name.moves.tsv"
    chains+=("$work/$name.moves.tsv")
done
"$julia_bin" --startup-file=no "$here/check.jl" "$here/certificate.tsv" "$work/legal-dag.tsv" "${chains[@]}" > "$work/julia.tsv" 2> "$work/julia.stderr"
"$here/flix/build.sh" > "$work/flix-build.log" 2>&1
jar=${CALENDAR7_ROW2_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-row2-flix}/artifact/flix.jar
java -Xmx8g -jar "$jar" "$here/certificate.tsv" "$work/legal-dag.tsv" "$repo/research/calendar-7x7/english/evidence" "$repo/research/calendar-7x7/en-physical-review" "${chains[@]}" > "$work/flix.tsv" 2> "$work/flix.stderr"
sed -n '/^row2-/p' "$work/flix.tsv" > "$work/flix-receipt.tsv"
cmp "$work/julia.tsv" "$work/flix-receipt.tsv"
JULIA_BIN="$julia_bin" "$here/negative_checks.sh" "$work/legal-dag.tsv" "$jar" "$work/negative-controls"
printf 'Native receipts match; four corruption controls rejected by both. Evidence: %s\n' "$work"
