#!/usr/bin/env julia
# Native Julia checker for the stacked dual-label front semantics (see README).
include(joinpath(@__DIR__,"stacked_common.jl"))
if abspath(PROGRAM_FILE)==@__FILE__
    try
        @assert length(ARGS)==4 "PRINT DAG VARIANT(A|B|W) MODE(strict|context)"
        check_stacked(ARGS...)
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
