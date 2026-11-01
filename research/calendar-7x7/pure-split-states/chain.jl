#!/usr/bin/env julia
# UNTRUSTED chain generator (candidate only): one retained physical state from the
# January 2027 root of the stage-2 DAG through December 2027, each month edge found by
# the unchanged PR #130 global beam search (planner orbit solve as fallback) under the
# pure-split print and displays. HTM numbers are search results, not optimal.
# Usage: chain.jl DAG PRINT OUT_PREFIX
include(joinpath(@__DIR__,"pure_common.jl"))
include(joinpath(@__DIR__,"..","global-search","search.jl"))
include(joinpath(@__DIR__,"orbit_solve.jl"))
const G=GlobalSearch
function chain(dag_path,print_path,out)
    goals=stacked_goals(PURE_VARIANT);old=physical_targets("EN")
    index=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(old))
    idof(y,m)=index[join(string.(wrapped_board(y,m)),"|")]
    proof=G.P.replay_dag(dag_path);action=proof.action;a=G.M.Algebra(action)
    source=G.P.read_physical(print_path)
    library=G.build_library(action,a,G.library_spec(:L5));catalogs=G.P.chain_catalogues(action)
    root=idof(2027,1);state=G.P.signed_perm(proof.registers,proof.targets[root])
    hash0=G.P.state_digest(G.P.decode_physical(source,state,action))
    words=Vector{Int}[];hashes=Tuple{String,String}[];edges=Any[]
    open(out*"-edges.tsv","w") do log
        println(log,"from\tto\tmethod\thtm\tseconds")
        for m in 2:12
            target=(year=2027,month=m,board=goals[idof(2027,m)].board);t0=time()
            r=G.search_edge(source,state,target,action,a,library);method="GLOBAL"
            if isnothing(r.word)
                o=orbit_solve(G.P,source,state,target,action,catalogs)
                isnothing(o) && (println(log,"2027-$(m-1)\t2027-$m\tUNKNOWN\t-1\t-");return)
                r=(word=o.word,state=o.state,htm=G.M.htm(o.word));method="ORBIT"
            end
            before=G.P.state_digest(G.P.decode_physical(source,state,action))
            state=r.state
            after=G.P.state_digest(G.P.decode_physical(source,state,action))
            push!(words,r.word);push!(hashes,(before,after));push!(edges,(;year=2027,month=m))
            println(log,"2027-$(m-1)\t2027-$m\t",method,'\t',r.htm,'\t',round(time()-t0;digits=1));flush(log)
        end
    end
    G.M.export_chain(out*".moves.tsv",(;root,year=2027,month=1,hash=hash0,edges),words,action;hashes)
end
chain(ARGS...)
