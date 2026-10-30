#!/usr/bin/env julia
# Exact unexpanded generator-leaf counts, not HTM or a shortest-path claim.
function leaf_counts(input,output)
    layers=BigInt[];globals=BigInt[];results=Tuple{Int,BigInt,BigInt}[]
    for (line_number,line) in enumerate(eachline(input))
        parts=split(line,'\t';keepempty=true)
        if line_number==1
            @assert parts==["cubistry.calendar7.legal-dag.v1","264","21"]
        elseif parts[1]=="generator"
            id=parse(Int,parts[2]);g=parse(Int,parts[3]);@assert id==length(layers)+1
            push!(layers,BigInt(g in (7,14,21) ? 0 : 1))
            push!(globals,BigInt(g in (7,14,21) ? 1 : 0))
        elseif parts[1]=="product"
            id,a,b=parse.(Int,parts[2:4]);@assert id==length(layers)+1
            @assert abs(a)<id && abs(b)<id
            push!(layers,(a==0 ? BigInt(0) : layers[abs(a)])+(b==0 ? BigInt(0) : layers[abs(b)]))
            push!(globals,(a==0 ? BigInt(0) : globals[abs(a)])+(b==0 ? BigInt(0) : globals[abs(b)]))
        elseif parts[1]=="result"
            i,root=parse.(Int,parts[2:3]);@assert abs(root)<=length(layers)
            push!(results,(i,root==0 ? BigInt(0) : layers[abs(root)],root==0 ? BigInt(0) : globals[abs(root)]))
        else
            error("Unknown DAG record at line $line_number")
        end
    end
    open(output,"w") do io
        println(io,"target\tunreduced_layer_quarters\tunreduced_whole_cube_quarters\ttotal_generator_leaves")
        for (i,l,g) in results;println(io,join([i,l,g,l+g],'\t'));end
    end
    totals=[l+g for (_,l,g) in results]
    println("Native Julia leaf counts: ",length(results)," roots; min=",minimum(totals)," max=",maximum(totals))
    println("These are exact unreduced expression leaf counts, not HTM and not shortest or practically executable transition lengths.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    length(ARGS)==2 || error("usage: dag_leaf_counts.jl INPUT OUTPUT")
    leaf_counts(ARGS...)
end
