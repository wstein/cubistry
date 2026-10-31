#!/usr/bin/env julia
include(joinpath(@__DIR__,"oriented_common.jl"))
if abspath(PROGRAM_FILE)==@__FILE__
    try
        @assert length(ARGS)==3 "PRINT ART DAG"
        check_oriented(ARGS...)
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
