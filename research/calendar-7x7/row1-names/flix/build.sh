#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${CALENDAR7_NAMES_FLIX_BUILD_DIR:?Use a unique scratch build directory}
mkdir -p "$build_dir/src"
cp -R "$here/../../english/flix/.flixw" "$build_dir/"
cp "$here/../../english/flix/flixw" "$here/../../english/flix/flix.toml" "$build_dir/"
cp "$here/../../english/flix/src/"{Core,Data,Dag}.flix "$build_dir/src/"
cp "$here/../../pure-split-states/flix/src/Stacked.flix" "$build_dir/src/"
cp "$here/src/Main.flix" "$build_dir/src/"
cd "$build_dir"
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
./flixw build-jar
