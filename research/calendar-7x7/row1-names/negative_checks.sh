#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Targeted raw-input mutations only; full mutation sweep is opt-in, not run here.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
jar=${3:?New inventory Flix jar}; out=${4:?Unique scratch output directory}
mkdir -p "$out"
awk 'NR==2{sub(/J/,"j")} {print}' "$here/layout.tsv" > "$out/lowercase.tsv"
awk 'BEGIN{FS=OFS="\t"} NR==3{$1="1"} {print}' "$here/layout.tsv" > "$out/duplicate-month.tsv"
awk 'BEGIN{FS=OFS="\t"} NR==2{$5="X"} {print}' "$here/layout.tsv" > "$out/column-four.tsv"
awk '{printf "%s\r\n",$0}' "$here/layout.tsv" > "$out/crlf.tsv"
printf 'case\tjulia\tflix\n' > "$out/results.tsv"
for name in lowercase duplicate-month column-four crlf; do
    if "$julia_bin" --startup-file=no "$here/inventory.jl" "$out/$name.tsv" names > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr"; then
        echo "Julia accepted $name" >&2; exit 1
    fi
    if "$java_bin" -Xmx2g -jar "$jar" "$out/$name.tsv" names "$repo/research/calendar-7x7/english/evidence" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr"; then
        echo "Flix accepted $name" >&2; exit 1
    fi
    grep -q INVALID "$out/$name.julia.stderr"
    grep -q INVALID "$out/$name.flix.stdout"
    printf '%s\tREJECT\tREJECT\n' "$name" >> "$out/results.tsv"
done
cat "$out/results.tsv"
echo 'mutations: four targeted raw-input cases; full sweep not run (opt-in)'
