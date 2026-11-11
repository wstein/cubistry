#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# run_mutants.sh JULIA : applies each mutant in place (restored afterwards) and requires the named test set to fail.
set -u
J=${1:?julia}; here=$(cd -- "$(dirname -- "$0")" && pwd); cal=$(cd "$here/../../.." && pwd); cd "$cal"
mut(){ # file sed-expr expected-failing-testset [test-file]
  cp "$here/$1" "$here/$1.orig"; sed -i "$2" "$here/$1"
  if cmp -s "$here/$1" "$here/$1.orig"; then echo "MUTANT-NOT-APPLIED $1 $2"; mv "$here/$1.orig" "$here/$1"; return; fi
  out=$("$J" --startup-file=no "$here/${4:-test_config.jl}" 2>&1); mv "$here/$1.orig" "$here/$1"
  if echo "$out" | grep -qE "^$3: (Test Failed|Error During Test)"; then echo "KILLED  $1 [$2] by '$3'"; else echo "SURVIVED $1 [$2]"; fi
}
mut config_table.jl 's/Dates.dayofweek(Date(y,m,1)),Dates.daysinmonth(Date(y,m,1))/Dates.dayofweek(Date(y,m,2)),Dates.daysinmonth(Date(y,m,1))/' "committed tables equal recomputed tables"
mut config_table.jl 's/Dates.dayofweek(Date(y,m,1)),Dates.daysinmonth(Date(y,m,1))/Dates.dayofweek(Date(y,m,1)),min(30,Dates.daysinmonth(Date(y,m,1)))/' "configuration set"
mut config_table.jl 's/ckey(y,m)==ckey(y+400,m)/ckey(y,m)==ckey(y+401,m)/' "calendar facts and Gregorian cycle"
mut config_table.jl 's/for y in 2026:2425,m in 1:12/for y in 2026:2424,m in 1:12/' "calendar facts and Gregorian cycle"
mut config_table.jl 's/y<=2099\]/y<=2098]/' "committed tables equal recomputed tables"
mut config_table.jl 's/owner\[j\]==0 || augment(owner\[j\],seen)/owner[j]==0/' "match verdict agrees with the repository matcher"
mut config_table.jl 's/pid,join(rotate((1,0,0),rot),/pid,join(rotate((0,0,1),rot),/' "committed tables equal recomputed tables"
mut config_table.jl 's/hall==(0,0) \&\& (hall=(length(xs),count(seen)))/hall==(0,0) \&\& (hall=(length(xs),count(seen)+1))/' "match verdict agrees with the repository matcher"
mut config_table.jl 's/demand=d.required,blank=d.blank/demand=d.required-1,blank=d.blank/' "corner lemma per configuration"
mut config_table.jl 's/(t,isempty(t) ? "band" : "month")/(t,isempty(t) ? "blank" : "month")/' "committed tables equal recomputed tables"
mut front-matches-config-B.tsv '0,/\t49\t0,0,-1\t-1,0,0\t0,1,0/s//\t50\t0,0,-1\t-1,0,0\t0,1,0/' "matchings replay in the repository print checker"
mut config-table.tsv '0,/\tSAT\t\tSAT\t/s//\tNOMATCH\t\tSAT\t/' "committed tables equal recomputed tables"
mut failing-dates.tsv 's/2099-02/2098-02/' "committed tables equal recomputed tables"
mut ../window-skip/design_skip.jl 's/^    root_front(h,n) \&\& return false$/    false \&\& return false/' "root front surfaces are never frozen to the seed" test_root.jl
mut ../window-skip/design_skip.jl 's/haskey(ENV,"ROOT") \&\& @assert/haskey(ENV,"ROOT") \&\& true || @assert/' "root month of the designer" test_root.jl
mut config_table.jl 's/ckey(y,m) in badk || push!(seq,(y,m))/push!(seq,(y,m))/' "committed tables equal recomputed tables"
mut config_table.jl 's/lemma=d.lemma))/lemma=!d.lemma))/' "corner lemma per configuration"
mut config_table.jl 's|const PRINT_C=joinpath(@__DIR__,"printing-C.tsv")|const PRINT_C=PRINT_B|' "identity pose and print C month list"
mut stage_pairs.jl 's/Dates.dayofweek(Date(y,m,1))/Dates.dayofweek(Date(y,m,2))/' "staged chain pairs" test_stages.jl
mut stage_pairs.jl 's/("2",(1950,1),(1980,1))/("2",(1950,1),(1979,12))/' "staged chain pairs" test_stages.jl
mut config_table.jl 's/(r,c)!=skip\]/true]/' "committed tables equal recomputed tables"
mut best-effort-feb-sunday-28.tsv '0,/^B\t/s//C\t/' "committed tables equal recomputed tables"
mut ../window-skip/design_skip.jl 's/digest=bytes2hex(sha256(smt));path=/digest="x";path=/' "solved classes are read from the result directory" test_cache.jl
mut ../window-skip/design_skip.jl 's/if !isempty(path) \&\& isfile(path)$/if false/' "solved classes are read from the result directory" test_cache.jl
mut ../window-skip/design_skip.jl 's/if !isempty(path) \&\& result.status==1$/if !isempty(path)/' "solved classes are read from the result directory" test_cache.jl
mut ../window-skip/design_skip.jl 's/ls\[1\]=="digest\\t"\*digest/true/' "solved classes are read from the result directory" test_cache.jl
