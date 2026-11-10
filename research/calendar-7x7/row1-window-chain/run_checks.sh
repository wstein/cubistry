#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
jar=${3:?Chain verifier jar}; out=${4:?Unique workspace scratch directory}
mode=${5:-}
# Window end (YYYY-MM) comes from WINDOW_END, default 2028-01. A longer window needs its own print
# (PRINT_OVERRIDE), its chain and states (CHAIN_OVERRIDE, STATES_OVERRIDE) and its SHA-256 (CAL7_WINDOW_PRINT_SHA); both checkers and verify_chain.jl read them.
window_end=${WINDOW_END:-2028-01}; export WINDOW_END="$window_end"
[[ "$mode" == "" || "$mode" == --mutations ]] || exit 2
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"
printing=${PRINT_OVERRIDE:-"$here/../row1-window-print/evidence/printing.tsv"}
chain=${CHAIN_OVERRIDE:-"$here/evidence/moves.tsv"}; states=${STATES_OVERRIDE:-"$here/evidence/states"}
evidence="$repo/research/calendar-7x7/english/evidence"
flix_extra=(); [[ "$window_end" == 2028-01 ]] || flix_extra=("$window_end" "${CAL7_WINDOW_PRINT_SHA:?print SHA-256 for a window end after 2028-01}")
"$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$chain" "$states" > "$out/julia.tsv"
"$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$chain" "$states" "$evidence" "${flix_extra[@]}" > "$out/flix.tsv"
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
        if "$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$trial/moves.tsv" "$trial/states" "$evidence" "${flix_extra[@]}" > "$trial/flix.log" 2>&1; then
            echo "Flix accepted mutation: $name" >&2; exit 1
        fi
        grep -Fq -- "$julia_reason" "$trial/julia.log"
        grep -Fq -- "$flix_reason" "$trial/flix.log"
        printf '%s\tREJECT\tREJECT\n' "$name" >> "$out/negative.tsv"
    done < "$out/cases.txt"
fi
