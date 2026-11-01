#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${CALENDAR7_ADJACENT_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-adjacent-flix}
mkdir -p "$build_dir/src"
cp -R "$here/../../english/flix/.flixw" "$build_dir/"
cp "$here/../../english/flix/flixw" "$here/../../english/flix/flix.toml" "$build_dir/"
cp "$here/../../english/flix/src/Core.flix" "$here/../../english/flix/src/Data.flix" "$here/../../english/flix/src/Dag.flix" "$build_dir/src/"
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
