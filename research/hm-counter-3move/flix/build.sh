#!/usr/bin/env bash
# Builds the Flix checker jar (Flix 0.79.0, Java 21; a structural port of
# checker/check.jl) using the flixw scaffolding of
# research/calendar-7x7/english/flix.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${HM_FLIX_BUILD_DIR:-/tmp/cubistry-hm-counter-flix}
mkdir -p "$build_dir/src"
cp -R "$here/../../calendar-7x7/english/flix/.flixw" "$build_dir/"
cp "$here/../../calendar-7x7/english/flix/flixw" "$here/../../calendar-7x7/english/flix/flix.toml" "$build_dir/"
cp "$here/src/Main.flix" "$build_dir/src/"
cd "$build_dir"
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
./flixw build-jar
project_name=$(basename -- "$build_dir")
if [ "$project_name" != flix ]; then
    cp "artifact/$project_name.jar" artifact/flix.jar
fi
printf '%s\n' "$build_dir/artifact/flix.jar"
