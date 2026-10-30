#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
dag=${1:?Pass the decompressed PR99 DAG}
candidate=${2:?Pass the February-to-March 2026 transition}
jar=${CALENDAR7_FLIX_BUILD_DIR:-/tmp/cubistry-calendar7-practical-flix}/artifact/flix.jar
out=${CALENDAR7_FLIX_TEST_DIR:-/tmp/cubistry-calendar7-practical-flix-tests}
mkdir -p "$out"
run() {
    local name=$1 expected=$2
    shift 2
    local code=0
    java -Xmx8g -jar "$jar" "$@" > "$out/$name.tsv" 2> "$out/$name.stderr" || code=$?
    if [ "$code" -ne "$expected" ]; then
        printf 'Unexpected exit for %s: %s (expected %s)\n' "$name" "$code" "$expected" >&2
        return 1
    fi
    printf '%s\t%s\tPASS\n' "$name" "$code"
}
run selftest 0 selftest "$here/../../english/evidence" "$here/../../en-physical-review"
run valid 0 transition "$here/../../english/evidence" "$here/../../en-physical-review" "$dag" "$candidate"
sed '4d' "$candidate" > "$out/drop-first.tsv"
sed 's/destination\t2026\t3/destination\t2026\t4/' "$candidate" > "$out/wrong-month.tsv"
head -n 3 "$candidate" > "$out/identity.tsv"
for name in drop-first wrong-month identity; do
    run "$name" 1 transition "$here/../../english/evidence" "$here/../../en-physical-review" "$dag" "$out/$name.tsv"
done
