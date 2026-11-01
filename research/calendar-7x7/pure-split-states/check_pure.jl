#!/usr/bin/env julia
# Native Julia checker: pure stacked split with month-letter scheme A (see README).
#   check_pure.jl PRINT DAG TARGETS   TARGETS = comma-separated display ids or all
include(joinpath(@__DIR__,"pure_common.jl"))
if abspath(PROGRAM_FILE)==@__FILE__
    try
        @assert length(ARGS)==3 "PRINT DAG TARGETS"
        check_pure(ARGS...)
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
