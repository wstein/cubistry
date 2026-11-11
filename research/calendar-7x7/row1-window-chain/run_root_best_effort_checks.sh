#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Root month (root != first member of S) and best-effort months for the chain checkers.
#   run_root_best_effort_checks.sh JULIA JAVA CHAIN_JAR OUT
# Every accept fixture of root_best_effort_cases.jl is accepted by Julia, Flix and the independent verifier with identical
# Julia and Flix receipts; every reject fixture is rejected by all three at the named reason.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}; jar=${3:?Chain verifier jar}; out=${4:?Unique workspace scratch directory}
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"; evidence="$here/../english/evidence"
"$julia_bin" --startup-file=no "$here/root_best_effort_cases.jl" "$out/cases" > "$out/generator.txt"
run_all() { # dir -> sets JR FR IR (1 = rejected)
    local d=$1 jr=0 fr=0 ir=0 root="" pin psha
    pin=$(cat "$d/months.sha256"); psha=$(cat "$d/print.sha256")
    [[ ! -f "$d/root.txt" ]] || root=$(cat "$d/root.txt")
    export CAL7_WINDOW_MONTHS="$d/months.tsv" CAL7_WINDOW_MONTHS_SHA256="$pin" CAL7_WINDOW_PRINT_SHA="$psha"
    if [[ -n "$root" ]]; then export CAL7_ROOT_MONTH="$root"; else unset CAL7_ROOT_MONTH; fi
    "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" > "$d/julia.out" 2> "$d/julia.err" || jr=1
    "$julia_bin" --startup-file=no "$here/verify_chain.jl" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" > "$d/ind.out" 2> "$d/ind.err" || ir=1
    local fx=(months "$d/months.tsv" "$pin" "$psha"); [[ -z "$root" ]] || fx+=(- "$root")
    "$java_bin" -Xmx2g -jar "$jar" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" "$evidence" "${fx[@]}" > "$d/flix.out" 2> "$d/flix.err" || fr=1
    unset CAL7_WINDOW_MONTHS CAL7_WINDOW_MONTHS_SHA256 CAL7_WINDOW_PRINT_SHA CAL7_ROOT_MONTH
    JR=$jr FR=$fr IR=$ir
}
printf 'case\tjulia\tflix\tindependent\n' > "$out/results.tsv"; na=0; nr=0
while IFS=$'\t' read -r name kind jreason freason ireason; do
    [[ -z "${ONLY:-}" || " $ONLY " == *" $name "* ]] || continue
    d="$out/cases/$name"; run_all "$d"
    if [[ $kind == accept ]]; then
        [[ $JR == 0 && $FR == 0 && $IR == 0 ]] || { echo "$name rejected (julia=$JR flix=$FR independent=$IR): $(head -c 300 "$d/julia.err") $(head -c 300 "$d/flix.out") $(head -c 300 "$d/ind.err")" >&2; exit 1; }
        cmp "$d/julia.out" "$d/flix.out"; na=$((na+1))
        printf '%s\tACCEPT\tACCEPT\tACCEPT\n' "$name" >> "$out/results.tsv"
    else
        [[ $JR == 1 && $FR == 1 && $IR == 1 ]] || { echo "$name accepted (julia rejected=$JR flix rejected=$FR independent rejected=$IR)" >&2; exit 1; }
        grep -Fq -- "$jreason" "$d/julia.err"; grep -Fq -- "$freason" "$d/flix.out"; grep -Fq -- "$ireason" "$d/ind.err"; nr=$((nr+1))
        printf '%s\tREJECT\tREJECT\tREJECT\n' "$name" >> "$out/results.tsv"
    fi
done < "$out/cases/cases.tsv"
# shape of the accepted receipts
if [[ -z "${ONLY:-}" ]]; then
    d="$out/cases/root-edge-2037-05"
    grep -q $'^root\t2037\t5\t' "$d/julia.out"; [[ $(grep -c $'\tROOTEDGE$' "$d/julia.out") == 1 && $(grep -c $'\tROOTEDGE$' "$d/ind.out") == 1 && $(grep -c $'\tROOTEDGE$' "$d/flix.out") == 1 ]]
    grep -q $'^verdict\tSAT\tlegal-retained-state-window-chain\t21\t20$' "$d/julia.out"
    d="$out/cases/best-effort-center"
    grep -q $'\tBEST_EFFORT\t1\t4,4$' "$d/julia.out"; grep -q $'^status\texact\t0\tbest_effort\t1$' "$d/julia.out"; grep -q $'^verdict\tBEST_EFFORT\t' "$d/julia.out"
    grep -q $'\tBEST_EFFORT\t1\t4,4$' "$d/ind.out"; grep -q $'^independent-verdict\tACCEPT_BEST_EFFORT_CHAIN\t' "$d/ind.out"
    d="$out/cases/root-edge-zero-moves"; grep -q $'^verdict\tSAT\tlegal-retained-state-window-chain\t22\t21$' "$d/julia.out"
fi
echo "root and best-effort chain checks: $na accepted, $nr rejected by Julia, Flix and the independent verifier"
