#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Root 2019-01 (the solved cube of print C) and the best-effort 29 rule for Julia (check.jl), the independent verifier (verify_chain.jl) and Flix.
#   [ONLY="name ..."] [RECORD=1] run_root2019_checks.sh JULIA JAVA CHAIN_JAR OUT
# Every accept case of root2019_cases.jl is accepted by all three; the receipts of the stored fixtures (evidence/root-2019) equal the committed
# julia.tsv, flix.tsv and independent.tsv (RECORD=1 writes them) and Julia equals Flix byte for byte. Every reject case is rejected by all three
# at the named reason. Cases with rule29.txt run with CAL7_BEST_EFFORT_29=1 (Flix: last argument 29). About 15 s per case and checker set at load 25.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}; jar=${3:?Chain verifier jar}; out=${4:?Unique workspace scratch directory}
mkdir -p "$out"
layout="$here/evidence/print-c/layout.tsv"; lsha=$(sha256sum "$layout" | cut -d' ' -f1); evidence="$here/../english/evidence"
"$julia_bin" --startup-file=no "$here/root2019_cases.jl" "$out" > "$out/generator.txt"
unset CAL7_JOIN_START CAL7_JOIN_END CAL7_BEST_EFFORT_29 WINDOW_END
run_all() { # dir -> sets JR FR IR (1 = rejected)
    local d=$1 jr=0 fr=0 ir=0 root="" rule="-" pin psha
    pin=$(cat "$d/months.sha256"); psha=$(cat "$d/print.sha256")
    [[ ! -f "$d/root.txt" ]] || root=$(cat "$d/root.txt")
    [[ ! -f "$d/rule29.txt" ]] || rule=29
    export CAL7_WINDOW_MONTHS="$d/months.tsv" CAL7_WINDOW_MONTHS_SHA256="$pin" CAL7_WINDOW_PRINT_SHA="$psha" CAL7_WINDOW_LAYOUT_SHA256="$lsha"
    if [[ -n "$root" ]]; then export CAL7_ROOT_MONTH="$root"; else unset CAL7_ROOT_MONTH; fi
    if [[ $rule == 29 ]]; then export CAL7_BEST_EFFORT_29=1; else unset CAL7_BEST_EFFORT_29; fi
    "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" > "$d/julia.out" 2> "$d/julia.err" || jr=1
    "$julia_bin" --startup-file=no "$here/verify_chain.jl" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" > "$d/ind.out" 2> "$d/ind.err" || ir=1
    local fx=(months "$d/months.tsv" "$pin" "$psha" "$lsha" "${root:--}" - -); [[ $rule == - ]] || fx+=("$rule")
    "$java_bin" -Xmx2g -jar "$jar" "$layout" "$d/print.tsv" "$d/moves.tsv" "$d/states" "$evidence" "${fx[@]}" > "$d/flix.out" 2> "$d/flix.err" || fr=1
    unset CAL7_WINDOW_MONTHS CAL7_WINDOW_MONTHS_SHA256 CAL7_WINDOW_PRINT_SHA CAL7_WINDOW_LAYOUT_SHA256 CAL7_ROOT_MONTH CAL7_BEST_EFFORT_29
    JR=$jr FR=$fr IR=$ir
}
printf 'case\tjulia\tflix\tindependent\n' > "$out/results.tsv"; na=0; nr=0
while IFS=$'\t' read -r name kind jreason freason ireason rec; do
    [[ -z "${ONLY:-}" || " $ONLY " == *" $name "* ]] || continue
    d="$out/cases/$name"; run_all "$d"
    if [[ $kind == accept ]]; then
        [[ $JR == 0 && $FR == 0 && $IR == 0 ]] || { echo "$name rejected (julia=$JR flix=$FR independent=$IR): $(head -c 300 "$d/julia.err") $(head -c 300 "$d/flix.out") $(head -c 300 "$d/ind.err")" >&2; exit 1; }
        cmp "$d/julia.out" "$d/flix.out"
        if [[ $rec != - ]]; then
            if [[ -n "${RECORD:-}" ]]; then cp "$d/julia.out" "$here/evidence/root-2019/$rec/julia.tsv"; cp "$d/flix.out" "$here/evidence/root-2019/$rec/flix.tsv"; cp "$d/ind.out" "$here/evidence/root-2019/$rec/independent.tsv"; fi
            cmp "$d/julia.out" "$here/evidence/root-2019/$rec/julia.tsv"; cmp "$d/flix.out" "$here/evidence/root-2019/$rec/flix.tsv"; cmp "$d/ind.out" "$here/evidence/root-2019/$rec/independent.tsv"
        fi
        na=$((na+1)); printf '%s\tACCEPT\tACCEPT\tACCEPT\n' "$name" >> "$out/results.tsv"
    else
        [[ $JR == 1 && $FR == 1 && $IR == 1 ]] || { echo "$name accepted (julia rejected=$JR flix rejected=$FR independent rejected=$IR)" >&2; exit 1; }
        grep -Fq -- "$jreason" "$d/julia.err"; grep -Fq -- "$freason" "$d/flix.out"; grep -Fq -- "$ireason" "$d/ind.err"; nr=$((nr+1))
        printf '%s\tREJECT\tREJECT\tREJECT\n' "$name" >> "$out/results.tsv"
    fi
done < "$out/cases.tsv"
[[ $((na+nr)) -ge 1 ]] || { echo "no case selected (ONLY=${ONLY:-})" >&2; exit 2; }
# shape of the stored receipts (all cases only)
if [[ -z "${ONLY:-}" ]]; then
    d="$out/cases/exact-2019-03"
    grep -q $'^root\t2019\t1\t' "$d/julia.out"; grep -q $'^verdict\tSAT\tlegal-retained-state-window-chain\t3\t2$' "$d/julia.out"; [[ $(grep -c ROOTEDGE "$d/julia.out") == 0 ]]
    grep -q $'^independent-verdict\tACCEPT_CHAIN\t3\t2\t' "$d/ind.out"
    d="$out/cases/best-effort-2026-02"
    grep -q $'^root\t2019\t1\t' "$d/julia.out"; grep -q $'\tROOTEDGE\tBEST_EFFORT\t1\t7,1$' "$d/julia.out"; grep -q $'^verdict\tBEST_EFFORT\tlegal-retained-state-window-chain\t3\t2$' "$d/julia.out"
    grep -q $'^independent-verdict\tACCEPT_BEST_EFFORT_CHAIN\t3\t2\t' "$d/ind.out"
fi
echo "root 2019 checks: $na accepted, $nr rejected by Julia, Flix and the independent verifier"
