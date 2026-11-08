#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# What the 2028-01..2099-12 chain needs (planning only, no search). Independent of the
# research code (uses verify_moves.jl for boards and replay).
#   chain_plan.jl PRINT MOVES_TSV
# Prints: the root (display of 2028-01), the 864 months / 863 edges, the distinct
# directed display transitions (the edge graph over the 91 displays), and for each a
# NAIVE route word (inverse of the source display word, then the target display word,
# adjacent equal generators merged). The naive HTM is only an upper bound, not a search.
include(joinpath(@__DIR__,"verify_moves.jl"))
function main2(print_path,moves_path)
    types=all_types(); rows=[split(l,'\t') for l in readlines(moves_path)[2:end] if !isempty(l)]
    byid=Dict{Int,Vector{Int}}(); idof=Dict{String,Int}()
    for f in rows
        id=parse(Int,f[1]); byid[id]=parse.(Int,split(f[6],','))
        idof[join(string.(board(parse(Int,f[2]),parse(Int,f[3]))),"|")]=id
    end
    months=[(y,m) for y in 2028:2099 for m in 1:12]
    seq=[idof[join(string.(board(y,m)),"|")] for (y,m) in months]
    println("plan-root\tdisplay=",seq[1],"\tmonth=2028-01\tword_htm=",htm(byid[seq[1]]))
    println("plan-months\t",length(months),"\tedges\t",length(months)-1)
    pairs=Dict{Tuple{Int,Int},Int}()
    for i in 1:length(seq)-1; pairs[(seq[i],seq[i+1])]=get(pairs,(seq[i],seq[i+1]),0)+1; end
    println("plan-distinct-display-transitions\t",length(pairs))
    println("plan-self-transitions\t",count(p->p[1]==p[2],keys(pairs)))
    println("plan-displays-used\t",length(unique(seq)))
    inv(w)=-reverse(w)
    naive=Dict(p=>htm(vcat(inv(byid[p[1]]),byid[p[2]])) for p in keys(pairs))
    v=sort(collect(values(naive))); n=length(v)
    println("plan-naive-transition-htm\tmedian=",n%2==1 ? v[(n+1)÷2] : (v[n÷2]+v[n÷2+1])/2,"\tmean=",round(sum(v)/n;digits=1),"\tmax=",v[end])
    tot=sum(naive[(seq[i],seq[i+1])] for i in 1:length(seq)-1)
    println("plan-naive-chain-htm-863-edges\t",tot)
    out=Dict{Int,Int}(); for (a,_) in keys(pairs); out[a]=get(out,a,0)+1; end
    println("plan-fanout\tmin=",minimum(values(out)),"\tmax=",maximum(values(out)))
    println("plan-header\tfrom_id\tto_id\tcount_in_chain\tnaive_htm")
    for p in sort(collect(keys(pairs))); println("plan-edge\t",p[1],'\t',p[2],'\t',pairs[p],'\t',naive[p]); end
end
main2(ARGS[1],ARGS[2])
