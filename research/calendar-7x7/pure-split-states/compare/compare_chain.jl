#!/usr/bin/env julia
# UNTRUSTED same-search comparison (candidate generator only). Carries one physical state
# from the December 2026 root of a DAG through December 2027 under a given print and
# layout, each month edge by the unchanged PR #130 global beam search with the given
# options; the planner's orbit solve is used only when the beam stalls. Exports the chain.
# Usage: compare_chain.jl DAG PRINT LAYOUT OUT_PREFIX [key=value search options]
#   LAYOUT: pr99 (PR #99 displays) or pure (pure split, letter scheme A)
include(joinpath(@__DIR__,"..","pure_common.jl"))
include(joinpath(@__DIR__,"..","..","global-search","search.jl"))
include(joinpath(@__DIR__,"..","orbit_solve.jl"))
const G=GlobalSearch
function run(dag_path,print_path,layout,out,opts)
    variant=layout=="pr99" ? "F31=keep,S30=keep,S31=keep" : layout=="pure" ? PURE_VARIANT : error("LAYOUT must be pr99 or pure")
    old=physical_targets("EN");index=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(old))
    idof(y,m)=index[join(string.(wrapped_board(y,m)),"|")]
    proof=G.P.replay_dag(dag_path);action=proof.action;a=G.M.Algebra(action)
    source=G.P.read_physical(print_path)
    params,spec,lib=G.parse_options(opts)
    t0=time();library=G.build_library(action,a,spec);catalogs=G.P.chain_catalogues(action);tlib=time()-t0
    root=idof(2026,12);state=G.P.signed_perm(proof.registers,proof.targets[root])
    G.P.validate_front(G.P.decode_physical(source,state,action),(year=2026,month=12,board=stacked_board(2026,12,variant)))
    hash0=G.P.state_digest(G.P.decode_physical(source,state,action))
    words=Vector{Int}[];hashes=Tuple{String,String}[];edges=Any[]
    open(out*"-edges.tsv","w") do log
        println(log,"# layout=",layout," options=",join(opts,' ')," library=",lib," library_seconds=",round(tlib;digits=1))
        println(log,"from\tto\tmethod\thtm\tseconds")
        for (y,m) in [(2027,mm) for mm in 1:12]
            target=(year=y,month=m,board=stacked_board(y,m,variant));t=time()
            r=G.search_edge(source,state,target,action,a,library,params);method="GLOBAL"
            if isnothing(r.word)
                o=orbit_solve(G.P,source,state,target,action,catalogs)
                isnothing(o) && (println(log,"prev\t$y-$m\tUNKNOWN\t-1\t-");return)
                r=(word=o.word,state=o.state,htm=G.M.htm(o.word));method="ORBIT_FALLBACK"
            end
            before=G.P.state_digest(G.P.decode_physical(source,state,action));state=r.state
            after=G.P.state_digest(G.P.decode_physical(source,state,action))
            push!(words,r.word);push!(hashes,(before,after));push!(edges,(;year=y,month=m))
            prev=m==1 ? "2026-12" : "2027-$(m-1)"
            println(log,prev,'\t',"$y-$m",'\t',method,'\t',r.htm,'\t',round(time()-t;digits=1));flush(log)
        end
    end
    G.M.export_chain(out*".moves.tsv",(;root,year=2026,month=12,hash=hash0,edges),words,action;hashes)
end
run(ARGS[1],ARGS[2],ARGS[3],ARGS[4],ARGS[5:end])
