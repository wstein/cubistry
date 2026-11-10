#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Opt-in: prepares the five Julia and five Flix source mutants, rebuilds each Flix
# mutant (about a minute each) and writes evidence/source-negative.tsv format.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}
build=${3:?Built Flix directory (CALENDAR7_CORNER_FLIX_BUILD_DIR of flix/build.sh)}
out=${4:?New unique workspace scratch directory}
"$julia_bin" --startup-file=no "$here/prepare_mutants.jl" --mutations "$build" "$out/mutants"
receipt="$out/source-negative.tsv"
printf 'case\tjulia\tflix\n' > "$receipt"
for name in capacity singleton nonempty-domain all-targets body-faces; do
    dir="$out/mutants/$name"
    if "$julia_bin" --startup-file=no "$dir/julia/test_lemma.jl" > "$dir/julia.log" 2>&1; then
        echo "Julia mutant survived: $name" >&2; exit 1
    fi
    grep -q 'Test Failed' "$dir/julia.log"
    (
        cd "$dir/flix"
        export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
        export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
        timeout 290 ./flixw build-jar > "$dir/flix-build.log" 2>&1
    )
    if "$java_bin" -Xmx2g -jar "$dir/flix/artifact/flix.jar" self-test > "$dir/flix.log" 2>&1; then
        echo "Flix mutant survived: $name" >&2; exit 1
    fi
    grep -q 'INVALID.*lemma test' "$dir/flix.log"
    printf '%s\tREJECT\tREJECT\n' "$name" >> "$receipt"
done
cmp "$receipt" "$here/evidence/source-negative.tsv"
echo 'source mutants: five Julia and five Flix rejected; receipt identical to evidence/source-negative.tsv'
