#!/usr/bin/env bash
# Runs both native checkers (Julia and Flix) on the certified witnesses,
# compares receipts byte for byte, and runs all 10 negative controls.
# Usage: research/counter-r2c1-0to9/evidence/run.sh
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
julia=${JULIA:-julia}
jar=${FLIX_JAR:-$("$here/../flix/build.sh")}
jl() { "$julia" --startup-file=no "$here/../julia/check.jl" "$@"; }
fx() { java -jar "$jar" "$@" 2>/dev/null | grep -v '^Picked up'; }
cd "$here"
status=0
for m in closed wrap1 constL-closed constL-wrap1 9L1D-closed 9L1D-wrap1 2qtm-closed; do
    jl print-$m.tsv $m routes-$m.tsv setup-$m.tsv > receipt-julia-$m.tsv
    fx print-$m.tsv $m routes-$m.tsv setup-$m.tsv > receipt-flix-$m.tsv
    if cmp -s receipt-julia-$m.tsv receipt-flix-$m.tsv; then
        echo "receipts $m IDENTICAL $(tail -1 receipt-julia-$m.tsv)"
    else
        echo "receipts $m DIFFER"
        status=1
    fi
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
neg wrong-glyph closed $c/print-wrong-glyph.tsv routes-closed.tsv setup-closed.tsv "LL shows 9"
neg wrong-move closed print-closed.tsv $c/routes-wrong-move.tsv setup-closed.tsv "increment 0->1: LL shows blank"
neg wrong-up closed $c/print-wrong-up.tsv routes-closed.tsv setup-closed.tsv "not upright"
neg front-nonblank closed $c/print-front-nonblank.tsv routes-closed.tsv setup-closed.tsv "UL shows 5"
neg two-touch-moves closed print-closed.tsv $c/routes-two-touch.tsv setup-closed.tsv "exactly 1 move touching r2c1 (got 2)"
neg three-prep-moves closed print-closed.tsv $c/routes-three-prep.tsv setup-closed.tsv "at most 2 preparing moves (got 3)"
neg prep-after-touch closed print-closed.tsv $c/routes-prep-after-touch.tsv setup-closed.tsv "preparing moves must precede the r2c1 touching move"
neg bad-inverse closed print-closed.tsv $c/routes-bad-inverse.tsv setup-closed.tsv "not the exact inverse word"
neg short-claim closed print-closed.tsv $c/routes-short-claim.tsv setup-closed.tsv "claimed increment shortest"
neg hidden-unreachable closed $c/print-hidden-unreachable.tsv routes-closed.tsv setup-closed.tsv "row 4: target display 5 is unreachable"
neg open-closure closed print-wrap1.tsv $c/routes-open-as-closed.tsv setup-closed.tsv "cycle does not return to the exact full start state"
neg non-const-touch constL-closed print-closed.tsv $c/routes-non-const-touch.tsv setup-constL-closed.tsv "constant-L mode requires final touching move L (got D)"
} | tee negative-controls.tsv
exit $status
