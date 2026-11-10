#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Default: positive replay only. --mutations enables 15 targeted raw mutations.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
jar=${3:?Window verifier jar}; out=${4:?Unique workspace scratch directory}
mode=${5:-}
if [[ "$mode" != "" && "$mode" != --mutations ]]; then
    echo 'usage: run_checks.sh JULIA JAVA WINDOW_JAR OUT [--mutations]' >&2; exit 2
fi
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"
printing="$here/evidence/printing.tsv"
matches="$here/evidence/front-matches.tsv"
evidence="$repo/research/calendar-7x7/english/evidence"
"$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$matches" > "$out/positive.julia.tsv"
"$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$matches" "$evidence" > "$out/positive.flix.tsv"
cmp "$out/positive.julia.tsv" "$out/positive.flix.tsv"
echo 'positive replay: Julia + Flix, 21 targets, 1029 front cells'
if [[ "$mode" != --mutations ]]; then
    echo 'mutations: not run (opt-in)'; exit 0
fi
"$julia_bin" --startup-file=no "$here/negative_cases.jl" --mutations "$printing" "$matches" "$out/raw"
printf 'case\tjulia\tflix\n' > "$out/negative-results.tsv"
while IFS=$'\t' read -r name jr fr; do
    [[ "$name" != case ]] || continue
    p="$out/raw/$name.print.tsv"; m="$out/raw/$name.matches.tsv"
    if "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$p" "$m" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr"; then
        echo "Julia accepted $name" >&2; exit 1
    fi
    if "$java_bin" -Xmx2g -jar "$jar" "$layout" "$p" "$m" "$evidence" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr"; then
        echo "Flix accepted $name" >&2; exit 1
    fi
    grep -q "$jr" "$out/$name.julia.stderr"
    grep -q "$fr" "$out/$name.flix.stdout"
    printf '%s\tREJECT\tREJECT\n' "$name" >> "$out/negative-results.tsv"
done < "$out/raw/cases.tsv"
"$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$out/raw/six-nine-twin.print.tsv" "$out/raw/six-nine-twin.matches.tsv" > "$out/twin.julia.tsv"
"$java_bin" -Xmx2g -jar "$jar" "$layout" "$out/raw/six-nine-twin.print.tsv" "$out/raw/six-nine-twin.matches.tsv" "$evidence" > "$out/twin.flix.tsv"
cmp "$out/twin.julia.tsv" "$out/twin.flix.tsv"
echo 'raw mutations: 30 intended rejections; six-nine twin accepted by both'
echo 'full mutation sweep: not run (owner decision)'
