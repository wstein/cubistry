#!/usr/bin/env bash
# Driver only: malformed or incoherent display sets; each checker must exit 1 on its own.
# Usage: negative_checks.sh FLIX_JAR OUT_DIR   (JULIA_BIN overrides julia)
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
jar=${1:?Native Flix jar required}
out=${2:?Output directory required}
julia_bin=${JULIA_BIN:-julia}
cal="$repo/research/calendar-7x7"
mkdir -p "$out"
printf 'case\tjulia-exit\tflix-exit\treason (julia | flix)\n' > "$out/results.tsv"
status=0
run_case() {
    name=$1; spec=$2
    js=0; "$julia_bin" --startup-file=no "$here/check_adjacent.jl" inventory "$spec" > "$out/$name.julia.stdout" 2> "$out/$name.julia.stderr" || js=$?
    fs=0; java -Dstdout.encoding=UTF-8 -Xmx8g -jar "$jar" inventory "$spec" "$cal/english/evidence" > "$out/$name.flix.stdout" 2> "$out/$name.flix.stderr" || fs=$?
    jr=$(grep -m1 'INVALID' "$out/$name.julia.stderr" | sed 's/^INVALID\t//' | cut -c1-160 || true)
    fr=$(grep -hm1 '^invalid' "$out/$name.flix.stdout" | sed 's/^invalid\t//' | cut -c1-160 || true)
    printf '%s\t%s\t%s\t%s | %s\n' "$name" "$js" "$fs" "$jr" "$fr" >> "$out/results.tsv"
    if [ "$js" -ne 1 ] || [ "$fs" -ne 1 ]; then printf 'UNKNOWN: unexpected native result for %s\n' "$name" >&2; status=1; fi
}
run_case unknown-key         "lead=blank,tail=blank,six=overflow"
run_case unknown-choice      "lead=next,trail=blank,six=overflow"
run_case misordered-keys     "trail=blank,lead=blank,six=overflow"
run_case missing-key         "lead=blank,trail=blank"
run_case incoherent-overflow "lead=prev,trail=next,six=overflow"
cat "$out/results.tsv"
exit $status
