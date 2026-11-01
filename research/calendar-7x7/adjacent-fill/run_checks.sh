#!/usr/bin/env bash
# Driver only: Julia and Flix each compute the static-capacity matrix on their own.
# Usage: run_checks.sh FLIX_JAR OUT_DIR   (JULIA_BIN overrides julia)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
mkdir -p "$out"
js=0; "$julia_bin" --startup-file=no "$here/check_adjacent.jl" matrix > "$out/matrix.julia.stdout" 2> "$out/matrix.julia.stderr" || js=$?
fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" matrix "$cal/english/evidence" > "$out/matrix.flix.stdout" 2> "$out/matrix.flix.stderr" || fs=$?
grep '^adjacent-' "$out/matrix.julia.stdout" > "$out/matrix.julia.tsv" || true
grep '^adjacent-' "$out/matrix.flix.stdout" > "$out/matrix.flix.tsv" || true
same=DIFFERENT; cmp -s "$out/matrix.julia.tsv" "$out/matrix.flix.tsv" && same=IDENTICAL
printf 'matrix\tjulia-exit=%s\tflix-exit=%s\t%s\n' "$js" "$fs" "$same" | tee "$out/cases.tsv"
grep -E '^adjacent-(inventory|incoherent)' "$out/matrix.julia.tsv" | tee -a "$out/cases.tsv"
