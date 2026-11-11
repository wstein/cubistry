#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# run_mutants.sh JULIA : applies each source mutant in place (restored afterwards) and requires the named test set to fail.
set -u
J=${1:?julia}; here=$(cd -- "$(dirname -- "$0")" && pwd); cal=$(cd "$here/../../.." && pwd); cd "$cal"
t=row1-window-chain/evidence/window-skip
mut(){ # file sed-expr expected-failing-testset test-file
  cp "$here/$1" "$here/$1.orig"; sed -i "$2" "$here/$1"
  if cmp -s "$here/$1" "$here/$1.orig"; then echo "MUTANT-NOT-APPLIED $1 $2"; mv "$here/$1.orig" "$here/$1"; return; fi
  out=$("$J" --startup-file=no "$here/$4" 2>&1); mv "$here/$1.orig" "$here/$1"
  if echo "$out" | grep -q "$3.*Fail\|$3.*Error\|$3 *|.*[0-9] *[0-9]*" && echo "$out" | grep -E "^$3" | grep -qE "Fail|Error"; then echo "KILLED  $1 [$2] by '$3'"; else echo "SURVIVED $1 [$2]"; fi
}
mut months.jl 's/maximum(count(==(a),xs) for xs in per)/minimum(count(==(a),xs) for xs in per)/' "corner demand of a target set" test_skip.jl
mut months.jl 's/length(unique(ms))==length(ms)/true/' "month list parsing" test_skip.jl
mut months.jl 's/(2026,1)<=(y,mo)/(2025,1)<=(y,mo)/' "month list parsing" test_skip.jl
mut months.jl 's/else\n        parse_months(s)/XX/;s/^        parse_months(s)$/        mlist_ignored(s)/' "receipts equal" test_skip.jl
mut coverage.jl 's/i!=p+1/i!=p+2/' "coverage runs and gaps" test_coverage.jl
mut coverage.jl 's/x\[1\]<=idx(ROOT...)<=x\[2\]/x[1]<idx(ROOT...)<=x[2]/' "coverage runs and gaps" test_coverage.jl
mut coverage.jl 's/r\[1\]\[2\]-r\[1\]\[1\]+1/r[1][2]-r[1][1]/' "coverage runs and gaps" test_coverage.jl
mut coverage.jl 's/b-a+1,"\\t\\t"/b-a,"\\t\\t"/' "coverage runs and gaps" test_coverage.jl
