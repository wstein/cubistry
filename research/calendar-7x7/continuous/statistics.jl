#!/usr/bin/env julia
# Descriptive statistics only; native replay receipts establish acceptance.
using Statistics
include(joinpath(@__DIR__,"verify.jl"))
function summarize_chains(paths)
    inputs=read_chain.(paths)
    edges=reduce(vcat,[i.edges for i in inputs])
    htm=sort!([e.htm for e in edges]);n=length(htm)
    println("scope\tFOUR_SELECTED_PRIMARY_CHAINS_ONLY")
    println("chains\t",length(inputs))
    println("edges\t",n)
    for (name,value) in (("min-htm",first(htm)),("mean-htm",mean(htm)),("median-htm",median(htm)),
        ("p90-nearest-rank-htm",htm[ceil(Int,.90*n)]),("p95-nearest-rank-htm",htm[ceil(Int,.95*n)]),
        ("max-htm",last(htm)),("total-htm",sum(htm)),("total-qtm",sum(e.qtm for e in edges)),
        ("total-whole-cube-rotation-records",sum(e.rot for e in edges)))
        println(name,'\t',value)
    end
    for count in sort!(unique(htm))
        println("frequency-htm\t",count,'\t',Base.count(==(count),htm))
    end
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==4 "Pass exactly the four selected primary raw chains"
    summarize_chains(ARGS)
end
