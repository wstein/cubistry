#!/usr/bin/env julia
# Native Julia checker for the stacked dual-label front semantics (see README).
#   check_stacked.jl PRINT DAG VARIANT MODE   legal-state check of one candidate print
#   check_stacked.jl inventory VARIANT MODE   inventory obstruction for any print
#   check_stacked.jl inventory-all            all 24 mixed layouts, both readings
#   VARIANT is A, B, W or a mixed layout F31=keep|bfold,S30=keep|bfold|afold,
#   S31=keep|bfold|bfold30|afold
include(joinpath(@__DIR__,"stacked_common.jl"))
if abspath(PROGRAM_FILE)==@__FILE__
    try
        if length(ARGS)==3 && ARGS[1]=="inventory"
            stacked_inventory(ARGS[2],ARGS[3])
        elseif ARGS==["inventory-all"]
            stacked_inventory_all()
        else
            @assert length(ARGS)==4 "PRINT DAG VARIANT(A|B|W) MODE(strict|context) | inventory VARIANT MODE"
            check_stacked(ARGS...)
        end
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
