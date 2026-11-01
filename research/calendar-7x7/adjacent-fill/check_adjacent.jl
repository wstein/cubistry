#!/usr/bin/env julia
# Native Julia static-capacity checker for adjacent-month display sets (see README).
#   check_adjacent.jl inventory SPEC   SPEC = lead=blank|prev,trail=blank|next,six=overflow|earlylate
#   check_adjacent.jl matrix           all coherent combinations (incoherent ones listed)
include(joinpath(@__DIR__,"adjacent_common.jl"))
if abspath(PROGRAM_FILE)==@__FILE__
    try
        if length(ARGS)==2 && ARGS[1]=="inventory"
            adjacent_inventory(ARGS[2])
        elseif ARGS==["matrix"]
            adjacent_matrix()
        else
            error("expected: inventory SPEC | matrix")
        end
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
