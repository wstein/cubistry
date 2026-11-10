#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
jar=${3:?Chain verifier jar}; out=${4:?Unique workspace scratch directory}
mode=${5:-}
[[ "$mode" == "" || "$mode" == --mutations ]] || exit 2
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"
printing="$here/../row1-window-print/evidence/printing.tsv"
chain="$here/evidence/moves.tsv"; states="$here/evidence/states"
evidence="$repo/research/calendar-7x7/english/evidence"
"$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$chain" "$states" > "$out/julia.tsv"
"$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$chain" "$states" "$evidence" > "$out/flix.tsv"
cmp "$out/julia.tsv" "$out/flix.tsv"
"$julia_bin" --startup-file=no "$here/verify_chain.jl" "$layout" "$printing" "$chain" "$states" > "$out/independent.tsv"
if [[ "$mode" == --mutations ]]; then
    "$julia_bin" --startup-file=no "$here/negative_cases.jl" "$chain" "$states" "$out/mutations" > "$out/cases.txt"
    printf 'case\tjulia\tflix\n' > "$out/negative.tsv"
    while IFS=$'\t' read -r name julia_reason flix_reason; do
        trial="$out/mutations/$name"
        if "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$trial/moves.tsv" "$trial/states" > "$trial/julia.log" 2>&1; then
            echo "Julia accepted mutation: $name" >&2; exit 1
        fi
        if "$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$trial/moves.tsv" "$trial/states" "$evidence" > "$trial/flix.log" 2>&1; then
            echo "Flix accepted mutation: $name" >&2; exit 1
        fi
        grep -Fq -- "$julia_reason" "$trial/julia.log"
        grep -Fq -- "$flix_reason" "$trial/flix.log"
        printf '%s\tREJECT\tREJECT\n' "$name" >> "$out/negative.tsv"
    done < "$out/cases.txt"
fi
