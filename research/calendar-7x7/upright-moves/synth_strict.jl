#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED move-word generator (candidate generator only; verify_moves.jl decides).
# Unchanged pure-split solver machinery (PR #130 global beam search, planner orbit
# solve, hybrid finish as in pure-split-states/pilot/producer-resume.jl) with ONE
# change: the glyph rule (strict_rule.jl from upright-feasibility is applied to every
# module that owns image_normal/HALF). Start state = the solved cube (identity).
# Goal = the 49 front cells of one display, don't-care elsewhere.
#   synth_strict.jl DAG PRINT OUT_TSV MODE [id ...] [key=value search options]
#   MODE orbit: planner orbit solve only (the beam always stalls from the solved cube,
#   see README); MODE beam: global beam first, then orbit solve and hybrid finish.
# DAG is only used for the pose action (its registers are not used).
# Method per display: (1) global beam from the solved cube; if it solves, done.
# (2) otherwise the planner orbit solve from the solved cube, and the hybrid finish
# (orbit solve from the cheapest beam snapshots, up to 4); the cheapest word is kept.
const HERE=@__DIR__
include(joinpath(HERE,"..","pure-split-states","pure_common.jl"))
include(joinpath(HERE,"..","global-search","search.jl"))
include(joinpath(HERE,"..","pure-split-states","orbit_solve.jl"))
include(joinpath(HERE,"..","upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)   # top level, before any search runs
function run(dag_path,print_path,out_path,mode,ids,opts)
    goals=stacked_goals(PURE_VARIANT)
    proof=G.P.replay_dag(dag_path);action=proof.action;a=G.M.Algebra(action)
    source=G.P.read_physical(print_path)
    params,spec,_=G.parse_options(opts)
    library=mode=="beam" ? G.build_library(action,a,spec) : G.Macro[]
    catalogs=G.P.chain_catalogues(action)
    gens=[UInt16.(g) for g in action.generators]
    start=G.P.identity_perm()
    open(out_path,"w") do log
        println(log,"id\tyear\tmonth\tstatus\thtm\tword\tseconds")
        for id in ids
            target=(year=goals[id].year,month=goals[id].month,board=goals[id].board)
            t0=time()
            prefix=G.P.chain_core_prefix(source,start,target,action)
            pr=G.Problem(source,target,action,params.orbit_weights)
            res=mode=="beam" ? G.beam_search(prefix.state,prefix.word,pr,library,a,params) : (;best=nothing,status=:skipped,snapshots=Dict{Int,Any}())
            cands=Tuple{String,Vector{Int}}[]
            if !isnothing(res.best)
                push!(cands,("GLOBAL",G.M.improve_word(res.best.word,a)))
            else
                println(stderr,"id ",id," global stalled (",res.status,"); orbit solve + hybrid finish")
                o=orbit_solve(G.P,source,start,target,action,catalogs)
                isnothing(o) || push!(cands,("ORBIT",o.word))
                for u in first(sort!(collect(keys(res.snapshots))),4)
                    node=res.snapshots[u];st=G.P.compose(start,G.P.macro_word_perm(node.word,gens))
                    f=try orbit_solve(G.P,source,st,target,action,catalogs) catch; nothing end
                    isnothing(f) || push!(cands,("HYBRID$(u)",G.M.improve_word(vcat(node.word,f.word),a)))
                end
            end
            # keep only words whose replay shows the display under the library's own check
            good=Tuple{String,Vector{Int}}[]
            for (m,w) in cands
                st=G.P.compose(start,G.P.macro_word_perm(w,gens))
                try G.P.validate_front(G.P.decode_physical(source,st,action),target);push!(good,(m,w)) catch end
            end
            if isempty(good)
                println(log,join([id,target.year,target.month,"UNKNOWN",-1,"-",round(time()-t0;digits=1)],'\t'));flush(log);continue
            end
            sort!(good;by=x->(G.M.htm(x[2]),x[1]))
            m,w=first(good)
            println(log,join([id,target.year,target.month,"FOUND_"*m,G.M.htm(w),join(w,','),round(time()-t0;digits=1)],'\t'));flush(log)
            println(stderr,"id ",id," ",m," htm=",G.M.htm(w)," candidates=",join(["$(x[1]):$(G.M.htm(x[2]))" for x in good],' ')," ",round(time()-t0;digits=1),"s")
        end
    end
end
mode=ARGS[4];@assert mode in ("orbit","beam")
rest=ARGS[5:end]
ids=[parse(Int,x) for x in rest if !occursin('=',x)]
run(ARGS[1],ARGS[2],ARGS[3],mode,isempty(ids) ? collect(1:91) : ids,[x for x in rest if occursin('=',x)])
