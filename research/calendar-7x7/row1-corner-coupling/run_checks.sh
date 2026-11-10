#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Default fast suite only. Source mutants are separately opt-in.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
jar=${3:?Corner verifier jar}; out=${4:?Unique workspace scratch directory}
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"
"$julia_bin" --startup-file=no "$here/test_lemma.jl" > "$out/lemma.julia.log"
"$java_bin" -Xmx2g -jar "$jar" self-test > "$out/lemma.flix.log"
for pair in names-band:all names-band:window names:all scheme-a:all; do
    profile=${pair%:*}; domain=${pair#*:}; name=$profile-$domain
    "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$profile" "$domain" > "$out/$name.julia.tsv"
    "$java_bin" -Xmx2g -jar "$jar" "$layout" "$profile" "$domain" "$repo/research/calendar-7x7/english/evidence" > "$out/$name.flix.tsv"
    cmp "$out/$name.julia.tsv" "$out/$name.flix.tsv"
done
grep -q $'verdict\tUNSAT\tfixed-print-corner-body-matching' "$out/names-band-all.julia.tsv"
for name in names-band-window names-all scheme-a-all; do
    grep -q $'verdict\tUNKNOWN\tfixed-print-corner-body-matching' "$out/$name.julia.tsv"
done
echo 'lemma tests: Julia14 / Flix11 pass; four domain/profile pairs identical'
echo 'mutations: not run (opt-in)'
