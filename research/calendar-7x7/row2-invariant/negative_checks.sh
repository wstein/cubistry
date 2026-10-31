#!/usr/bin/env bash
# Driver only: each native checker makes its own acceptance decision.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
dag=${1:?DAG path required}
jar=${2:?Native Flix jar required}
out=${3:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
mkdir -p "$out"
sed $'4s/column\t1\t66\t44/column\t1\t67\t44/' "$here/certificate.tsv" > "$out/wrong-id.tsv"
sed '4s/0,1,0$/0,-1,0/' "$here/certificate.tsv" > "$out/wrong-up.tsv"
sed $'5s/column\t2/column\t1/' "$here/certificate.tsv" > "$out/duplicate-column.tsv"
sed '4s/-3,2,3/-3,1,3/' "$here/certificate.tsv" > "$out/wrong-row.tsv"
printf 'case\tjulia-exit\tflix-exit\n' > "$out/results.tsv"
for name in wrong-id wrong-up duplicate-column wrong-row; do
    julia_status=0
    "$julia_bin" --startup-file=no "$here/check.jl" "$out/$name.tsv" "$dag" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || julia_status=$?
    flix_status=0
    java -Xmx8g -jar "$jar" "$out/$name.tsv" "$dag" "$repo/research/calendar-7x7/english/evidence" "$repo/research/calendar-7x7/en-physical-review" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || flix_status=$?
    if [ "$julia_status" -ne 1 ] || [ "$flix_status" -ne 1 ]; then
        printf 'UNKNOWN: unexpected native result for %s: Julia=%s Flix=%s\n' "$name" "$julia_status" "$flix_status" >&2
        exit 1
    fi
    printf '%s\t%s\t%s\n' "$name" "$julia_status" "$flix_status" >> "$out/results.tsv"
done
