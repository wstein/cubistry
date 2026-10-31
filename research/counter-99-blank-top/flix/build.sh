#!/usr/bin/env bash
# Builds the native Flix checker jar outside the repository (flixw scaffolding copied
# from research/calendar-7x7/english/flix). Prints the jar path.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${COUNTER99_FLIX_BUILD_DIR:-/tmp/cubistry-counter99-flix}
mkdir -p "$build_dir/src"
cp -R "$here/../../calendar-7x7/english/flix/.flixw" "$build_dir/"
cp "$here/../../calendar-7x7/english/flix/flixw" "$here/../../calendar-7x7/english/flix/flix.toml" "$build_dir/"
rm -f "$build_dir"/src/*.flix
cp "$here/src/Main.flix" "$build_dir/src/"
cd "$build_dir"
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
./flixw build-jar >&2
project_name=$(basename -- "$build_dir")
[ "$project_name" = flix ] || cp "artifact/$project_name.jar" artifact/flix.jar
printf '%s\n' "$build_dir/artifact/flix.jar"
