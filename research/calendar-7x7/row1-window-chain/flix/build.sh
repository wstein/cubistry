#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
build_dir=${CALENDAR7_CHAIN_FLIX_BUILD_DIR:?Use a unique workspace scratch build directory}
mkdir -p "$build_dir/src"
cp -R "$here/../../english/flix/.flixw" "$build_dir/"
cp "$here/../../english/flix/flixw" "$here/../../english/flix/flix.toml" "$build_dir/"
cp "$here/../../english/flix/src/"{Core,Data,Dag}.flix "$build_dir/src/"
cp "$here/../../pure-split-states/flix/src/Stacked.flix" "$build_dir/src/"
awk '/^def main\(\)/ { exit } { print }' "$here/../../row1-corner-coupling/flix/src/Main.flix" > "$build_dir/src/Coupling.flix"
awk '/^def main\(\)/ { exit } { print }' "$here/../../row1-window-print/flix/src/Main.flix" > "$build_dir/src/Window.flix"
cp "${CALENDAR7_CHAIN_FLIX_MAIN:-$here/src/Main.flix}" "$build_dir/src/Main.flix"
cd "$build_dir"
export FLIX_CACHE_HOME=${FLIX_CACHE_HOME:-/tmp/cubistry-flix-cache}
export COURSIER_CACHE=${COURSIER_CACHE:-/tmp/cubistry-flix-coursier}
./flixw build-jar
