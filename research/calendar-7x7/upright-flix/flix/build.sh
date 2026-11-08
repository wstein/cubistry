#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Builds the Flix replay jar: the English Core.flix (rule-parametrized) plus src/Replay.flix.
# Prints the jar path on the last line. Same build pattern as ../../pure-split-states/flix/build.sh.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${CALENDAR7_UPRIGHT_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-upright-flix}
mkdir -p "$build_dir/src"
cp -R "$here/../../english/flix/.flixw" "$build_dir/"
cp "$here/../../english/flix/flixw" "$here/../../english/flix/flix.toml" "$build_dir/"
cp "$here/../../english/flix/src/Core.flix" "$build_dir/src/"
cp "$here/src/Replay.flix" "$build_dir/src/"
cd "$build_dir"
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
./flixw build-jar >&2
project_name=$(basename -- "$build_dir")
if [ "$project_name" != flix ]; then
    cp "artifact/$project_name.jar" artifact/flix.jar
fi
printf '%s\n' "$build_dir/artifact/flix.jar"
