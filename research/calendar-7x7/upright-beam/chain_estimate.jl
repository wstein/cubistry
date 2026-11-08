#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Re-estimate of the 863-edge chain from measured per-transition results (each distinct
# display transition solved once from the ROOT state of its source display).
#   chain_estimate.jl CHAIN_PLAN_TSV EDGES_TSV
# CHAIN_PLAN_TSV: upright-moves/evidence/chain-plan.tsv (plan-edge from to count naive_htm)
# EDGES_TSV: rows from_id to_id ... htm seconds method word (edge_batch.jl "pairs" output)
# Estimate = sum over the 98 transitions of (count in the chain) x (measured value).
# This is an estimate, not a run: a real chain starts every edge from the retained state.
function main(plan,edges)
    cnt=Dict{Tuple{Int,Int},Int}();naive=Dict{Tuple{Int,Int},Int}()
    for l in readlines(plan)
        f=split(l,'\t');f[1]=="plan-edge" || continue
        k=(parse(Int,f[2]),parse(Int,f[3]));cnt[k]=parse(Int,f[4]);naive[k]=parse(Int,f[5])
    end
    rows=[split(l,'\t') for l in readlines(edges)[2:end] if !isempty(l)]
    got=Dict((parse(Int,f[1]),parse(Int,f[2]))=>(htm=parse(Int,f[7]),sec=parse(Float64,f[8]),ok=f[9]!="UNKNOWN") for f in rows)
    done=[k for k in keys(cnt) if haskey(got,k) && got[k].ok]
    println("chain-estimate\ttransitions_measured\t",length(done),"\tof\t",length(cnt))
    hs=sort([got[k].htm for k in done]);n=length(hs)
    println("chain-estimate\thtm_per_transition\tmedian=",isodd(n) ? hs[(n+1)÷2] : (hs[n÷2]+hs[n÷2+1])/2,"\tmean=",round(sum(hs)/n;digits=1),"\tmin=",hs[1],"\tmax=",hs[end])
    ss=[got[k].sec for k in done]
    println("chain-estimate\tseconds_per_transition\tmean=",round(sum(ss)/n;digits=1),"\tmax=",round(maximum(ss);digits=1))
    # weighted by how often the chain uses the transition (only over measured ones, then scaled to 863)
    w=sum(cnt[k] for k in done)
    th=sum(cnt[k]*got[k].htm for k in done);ts=sum(cnt[k]*got[k].sec for k in done)
    println("chain-estimate\tweighted_edges_covered\t",w,"\tof\t",sum(values(cnt)))
    println("chain-estimate\tweighted_mean_htm_per_edge\t",round(th/w;digits=1))
    println("chain-estimate\tweighted_mean_seconds_per_edge\t",round(ts/w;digits=1))
    println("chain-estimate\testimated_chain_htm_863_edges\t",round(Int,th/w*sum(values(cnt))))
    println("chain-estimate\testimated_chain_cpu_hours_863_edges\t",round(ts/w*sum(values(cnt))/3600;digits=1))
    nv=sum(cnt[k]*naive[k] for k in keys(cnt))
    println("chain-estimate\tnaive_concatenation_htm_863_edges\t",nv,"\t(upper bound from chain-plan)")
end
main(ARGS[1],ARGS[2])
