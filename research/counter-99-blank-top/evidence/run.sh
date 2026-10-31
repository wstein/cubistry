#!/usr/bin/env bash
# Runs both native checkers on the certified print, compares receipts byte for byte and
# runs the negative controls. No Python. Usage: research/counter-99-blank-top/evidence/run.sh
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
julia=${JULIA:-julia}
jar=${FLIX_JAR:-$("$here/../flix/build.sh")}
jl() { "$julia" --startup-file=no "$here/../julia/check.jl" "$@"; }
fx() { java -jar "$jar" "$@" 2>/dev/null | grep -v '^Picked up'; }
cd "$here"
status=0
for m in lz nz; do
    jl print.tsv $m routes-$m.tsv setup-$m.tsv > receipt-julia-$m.tsv
    fx print.tsv $m routes-$m.tsv setup-$m.tsv > receipt-flix-$m.tsv
    if cmp -s receipt-julia-$m.tsv receipt-flix-$m.tsv; then echo "receipts $m IDENTICAL $(tail -1 receipt-julia-$m.tsv)"; else echo "receipts $m DIFFER"; status=1; fi
done
"$julia" --startup-file=no "$here/../search/controls.jl" "$here" "$here/controls" > /dev/null
neg() { # name mode print routes setup expected-substring
    local name=$1 m=$2 p=$3 r=$4 s=$5 want=$6
    local a b; a=$(jl "$p" $m "$r" "$s"); ea=$?; b=$(fx "$p" $m "$r" "$s"); eb=$?
    local la lb; la=$(printf '%s\n' "$a" | tail -1); lb=$(printf '%s\n' "$b" | tail -1)
    local ok=REJECTED_AS_INTENDED
    { [ $ea -ne 0 ] && [ $eb -ne 0 ] && [[ $la == invalid* ]] && [[ $la == *"$want"* ]] && [ "$la" = "$lb" ]; } || { ok=UNEXPECTED; status=1; }
    printf '%s\t%s\tjulia_exit=%s\tflix_exit=%s\t%s\t%s\n' "$name" "$ok" $ea $eb "$la" "$( [ "$la" = "$lb" ] && echo same-message || echo "flix: $lb")"
}
c=controls
{
neg wrong-glyph lz $c/print-wrong-glyph.tsv routes-lz.tsv setup-lz.tsv "LR shows"
neg wrong-up lz $c/print-wrong-up.tsv routes-lz.tsv setup-lz.tsv "not upright"
neg top-nonblank lz $c/print-top-nonblank.tsv routes-lz.tsv setup-lz.tsv "UL shows 5"
neg nz-tens-nonblank nz $c/print-nz-tens-nonblank.tsv routes-nz.tsv setup-nz.tsv "LL shows 0"
neg wrong-move lz print.tsv $c/routes-lz-wrong-move.tsv setup-lz.tsv "increment 40->41"
neg short-claim lz print.tsv $c/routes-lz-short-claim.tsv setup-lz.tsv "claimed increment shortest"
neg bad-inverse lz print.tsv $c/routes-lz-bad-inverse.tsv setup-lz.tsv "not the exact inverse word"
neg hidden-unreachable lz $c/print-hidden-unreachable.tsv routes-lz.tsv setup-lz.tsv "row 4: target display 05 is unreachable"
} | tee negative-controls.tsv
exit $status
