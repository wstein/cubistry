#!/usr/bin/env julia
# Native Julia checker: pure stacked split with month-letter scheme A (see README).
#   check_pure.jl PRINT DAG TARGETS   TARGETS = comma-separated display ids or all
#   check_pure.jl matchability PRINT  cubie-level front matchability (design check)
include(joinpath(@__DIR__,"pure_common.jl"))
# Glyph half-turn rule: CUBISTRY_RULE=legacy (default, the rule of the chains in main) or
# strict (../upright-flix/rule_select.jl). Two separate top-level statements on purpose.
include(joinpath(@__DIR__,"..","upright-flix","rule_select.jl"))
select_rule!(Main)
if abspath(PROGRAM_FILE)==@__FILE__
    try
        if length(ARGS)==2 && ARGS[1]=="matchability"
            matchability_report(ARGS[2])
        else
            @assert length(ARGS)==3 "PRINT DAG TARGETS | matchability PRINT"
            check_pure(ARGS...)
        end
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
