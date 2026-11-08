#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Necessary-condition check of a print under the strict upright rule: (1) every orbit
# supplies every required class at least as often as its peak demand, (2) every one of
# the 91 displays has a cubie-level front matching. Not a legal-state proof.
#   verify_strict_print.jl PRINT
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
include(joinpath(@__DIR__,"strict_rule.jl"));apply_strict_rule!(Main)
function main(path)
    source=read_physical(path);goals=stacked_goals(PURE_VARIANT)
    short=print_supply(source,goals)
    println("strict-supply-missing\t",short)
    bad=0
    for (id,g) in enumerate(goals)
        u=unmatched_count(source,g.board)
        u>0 && (bad+=1;println("strict-unmatched\t",id,'\t',g.year,'\t',g.month,'\t',u))
    end
    println("strict-matchability\t",bad)
    println("strict-printed\t",count(s->!isempty(s.text),source))
    println("strict-verdict\t",short==0 && bad==0 ? "NECESSARY_CONDITIONS_MET" : "FAIL")
end
main(ARGS[1])
