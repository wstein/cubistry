#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Explicit month list S for the chain checkers. Needs the chain Flix jar built from flix/build.sh.
#   run_month_list_checks.sh JULIA JAVA CHAIN_JAR OUT
# Positive: the stored 21-month chain with one interior month skipped (one bridge edge) is accepted by Julia, Flix and the
# independent verifier, Julia and Flix receipts byte-identical. Negative: every fixture of month_list_cases.jl and the bridge
# chain under the default WINDOW_END is rejected by all three, each at the named reason.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)

julia_bin=${1:?Julia executable}; java_bin=${2:?Java executable}; jar=${3:?Chain verifier jar}; out=${4:?Unique workspace scratch directory}
mkdir -p "$out"
layout="$here/../row1-revision/layout.tsv"; printing="$here/../row1-window-print/evidence/printing.tsv"
chain="$here/evidence/moves.tsv"; states="$here/evidence/states"
evidence="$here/../english/evidence"
print_sha=0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127
"$julia_bin" --startup-file=no "$here/month_list_cases.jl" "$chain" "$states" "$out/cases" > "$out/generator.txt"
run_all() { # name dir [list-mode: yes|no] -> writes $dir/{julia,flix,ind}.{out,err}; returns 0 if all accept
    local d=$1 mode=$2 jr=0 fr=0 ir=0
    if [[ "$mode" == yes ]]; then
        local pin; pin=$(cat "$d/months.sha256")
        CAL7_WINDOW_MONTHS="$d/months.tsv" CAL7_WINDOW_MONTHS_SHA256="$pin" CAL7_WINDOW_PRINT_SHA=$print_sha \
            "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$d/moves.tsv" "$d/states" > "$d/julia.out" 2> "$d/julia.err" || jr=1
        "$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$d/moves.tsv" "$d/states" "$evidence" months "$d/months.tsv" "$pin" $print_sha > "$d/flix.out" 2> "$d/flix.err" || fr=1
        CAL7_WINDOW_MONTHS="$d/months.tsv" CAL7_WINDOW_MONTHS_SHA256="$pin" CAL7_WINDOW_PRINT_SHA=$print_sha \
            "$julia_bin" --startup-file=no "$here/verify_chain.jl" "$layout" "$printing" "$d/moves.tsv" "$d/states" > "$d/ind.out" 2> "$d/ind.err" || ir=1
    else
        "$julia_bin" --startup-file=no "$here/check.jl" "$layout" "$printing" "$d/moves.tsv" "$d/states" > "$d/julia.out" 2> "$d/julia.err" || jr=1
        "$java_bin" -Xmx2g -jar "$jar" "$layout" "$printing" "$d/moves.tsv" "$d/states" "$evidence" > "$d/flix.out" 2> "$d/flix.err" || fr=1
        "$julia_bin" --startup-file=no "$here/verify_chain.jl" "$layout" "$printing" "$d/moves.tsv" "$d/states" > "$d/ind.out" 2> "$d/ind.err" || ir=1
    fi
    JR=$jr FR=$fr IR=$ir
}
# positive
d="$out/cases/skip-positive"; run_all "$d" yes
[[ $JR == 0 && $FR == 0 && $IR == 0 ]] || { echo "positive skip chain rejected (julia=$JR flix=$FR independent=$IR)" >&2; exit 1; }
cmp "$d/julia.out" "$d/flix.out"
[[ $(grep -c $'\tBRIDGE$' "$d/julia.out") == 1 && $(grep -c $'\tBRIDGE$' "$d/ind.out") == 1 ]]
grep -q $'^months\t' "$d/julia.out"; grep -q $'^verdict\tSAT\tlegal-retained-state-window-chain\t20\t19$' "$d/julia.out"
grep -q $'^independent-verdict\tACCEPT_CHAIN\t20\t19\t' "$d/ind.out"
printf 'case\tjulia\tflix\tindependent\n' > "$out/negative.tsv"; printf 'skip-positive\tACCEPT(bridge)\tACCEPT(bridge)\tACCEPT(bridge)\n' >> "$out/negative.tsv"
# negatives (ONLY="name ..." restricts them, for mutation runs)
while IFS=$'\t' read -r name jreason freason ireason; do
    [[ -z "${ONLY:-}" || " $ONLY " == *" $name "* ]] || continue
    d="$out/cases/$name"; run_all "$d" yes
    [[ $JR == 1 && $FR == 1 && $IR == 1 ]] || { echo "$name accepted (julia rejected=$JR flix rejected=$FR independent rejected=$IR)" >&2; exit 1; }
    grep -Fq -- "$jreason" "$d/julia.err"; grep -Fq -- "$freason" "$d/flix.out"; grep -Fq -- "$ireason" "$d/ind.err"
    printf '%s\tREJECT\tREJECT\tREJECT\n' "$name" >> "$out/negative.tsv"
done < "$out/cases/cases.tsv"
# the bridge chain presented under the default WINDOW_END (no list at all)
if [[ -z "${ONLY:-}" || " $ONLY " == *" interior-gap-default-window-end "* ]]; then
d="$out/cases/interior-gap-default-window-end"; mkdir -p "$d"; cp "$out/cases/skip-positive/moves.tsv" "$d/"; cp -R "$out/cases/skip-positive/states" "$d/"
run_all "$d" no
[[ $JR == 1 && $FR == 1 && $IR == 1 ]] || { echo "bridge chain accepted under WINDOW_END" >&2; exit 1; }
grep -Fq "exactly 20 chronological edges" "$d/julia.err"; grep -Fq "exactly 20 chronological edges" "$d/flix.out"
printf 'interior-gap-default-window-end\tREJECT\tREJECT\tREJECT\n' >> "$out/negative.tsv"
fi
echo "month-list chain checks: 1 positive (bridge) accepted by Julia, Flix, independent; $(($(wc -l < "$out/negative.tsv")-2)) negatives rejected by all three"
