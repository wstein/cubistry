#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED smoke test of chain edges under the strict print (candidate generator; the
# edges are replayed by verify_moves.jl-style code at the end). From the solved cube:
# root word of the 2028-01 display, then the next N month edges with the unchanged
# global search (fallback planner orbit solve), one retained physical state.
#   chain_smoke.jl DAG PRINT MOVES_TSV N OUT_TSV [key=value search options]
const HERE=@__DIR__
include(joinpath(HERE,"..","pure-split-states","pure_common.jl"))
include(joinpath(HERE,"..","global-search","search.jl"))
include(joinpath(HERE,"..","pure-split-states","orbit_solve.jl"))
include(joinpath(HERE,"..","upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)
function run(dag_path,print_path,moves_path,n,out_path,opts)
    goals=stacked_goals(PURE_VARIANT)
    idof=Dict(join(string.(g.board),"|")=>i for (i,g) in enumerate(goals))
    proof=G.P.replay_dag(dag_path);action=proof.action;a=G.M.Algebra(action)
    gens=[UInt16.(g) for g in action.generators]
    source=G.P.read_physical(print_path)
    rootword=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(moves_path)[2:end])
    params,spec,_=G.parse_options(opts)
    library=G.build_library(action,a,spec);catalogs=G.P.chain_catalogues(action)
    months=[(2028,1)];for i in 1:n;y,m=months[end];push!(months,m==12 ? (y+1,1) : (y,m+1));end
    ids=[idof[join(string.(stacked_board(y,m,PURE_VARIANT)),"|")] for (y,m) in months]
    state=G.P.macro_word_perm(rootword[ids[1]],gens)
    open(out_path,"w") do log
        println(log,"from\tto\tfrom_id\tto_id\tmethod\thtm\tseconds\tword")
        for i in 1:n
            y,m=months[i+1];target=(year=y,month=m,board=goals[ids[i+1]].board)
            t0=time();r=G.search_edge(source,state,target,action,a,library,params);method="global"
            if isnothing(r.word)
                o=orbit_solve(G.P,source,state,target,action,catalogs)
                isnothing(o) && (println(log,join([months[i],months[i+1],ids[i],ids[i+1],"UNKNOWN",-1,round(time()-t0;digits=1),"-"],'\t'));flush(log);break)
                r=(word=o.word,state=o.state,htm=G.M.htm(o.word));method="orbit"
            end
            state=r.state
            println(log,join(["$(months[i][1])-$(months[i][2])","$y-$m",ids[i],ids[i+1],method,r.htm,round(time()-t0;digits=1),join(r.word,',')],'\t'));flush(log)
        end
    end
end
run(ARGS[1],ARGS[2],ARGS[3],parse(Int,ARGS[4]),ARGS[5],ARGS[6:end])
