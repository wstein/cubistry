#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate producer (check.jl, the Flix checker and verify_chain.jl decide).
# Window chain with optimized edges: loops the beam edge of beam_edge.jl (global macro beam, greedy orbit solver
# as fallback) sequentially from the retained state over the months of the print window. The library is built once
# per process. Months outside the print window get a status record (months.tsv), not an edge.
#   julia --threads=4 window_chain.jl OUT PRINT [key=value ...]
# Env WINDOW_END (YYYY-MM): the window of PRINT (default 2037-01 here); GENERATE_DEADLINE_S: no new edge starts when
# the slowest edge so far would not fit before this many seconds (default 14400).
# Options: start=YYYY-MM end=YYYY-MM (range of months.tsv; default 2026-01 .. 2050-01) prior=DIR (continue DIR/chain.moves.tsv
# and DIR/states) claims=FILE max_edges=N library=L1|L4|L5 width lambda corew fanout maxdepth patience nsnap finish_depth.
# Output OUT: chain.moves.tsv, states/state-NN.tsv, months.tsv, edges.tsv, PROGRESS.txt.
# Exit: 0 chain complete or stopped cleanly (PROGRESS.txt says which), 3 no new edge was produced, otherwise error.
@assert length(ARGS)>=2 "usage: window_chain.jl OUT PRINT [key=value ...]"
ENV["WINDOW_END"]=get(ENV,"WINDOW_END","2037-01")
const T0=time()
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(@__DIR__,"window_chain_lib.jl"));using .WindowChainLib
include(joinpath(CAL,"row1-window-print/common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
include(joinpath(CAL,"pure-split-states","orbit_solve.jl"))
const G=GlobalSearch
apply_strict_rule!(G.P,G.M.V)
Core.eval(G.P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
include(joinpath(CAL,"upright-beam","beam2.jl"))
const P=G.P

out,printpath=ARGS[1:2]
opts=Dict(String.(split(x,'='))[1]=>String.(split(x,'='))[2] for x in ARGS[3:end])
window_end=parse_ym(ENV["WINDOW_END"]);range_start=parse_ym(get(opts,"start","2026-01"));range_end=parse_ym(get(opts,"end","2050-01"))
max_edges=parse(Int,get(opts,"max_edges","100000"));deadline=parse(Float64,get(ENV,"GENERATE_DEADLINE_S","14400"))
claims=haskey(opts,"claims") ? read_claims(opts["claims"]) : Dict{Tuple{Int,Int},NTuple{4,String}}()
@assert !ispath(out) "Use a new scratch output directory";mkpath(joinpath(out,"states"))

labels=coupled_labels(read(joinpath(CAL,"row1-revision/layout.tsv"),String))
goals=coupled_goals(labels,"names-band","window")      # months May 2026 .. WINDOW_END
source=window_read_print(printpath)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators];a=G.M.Algebra(action)
digest(st)=P.state_digest(P.decode_physical(source,st,action))
plan=chain_months(range_start,range_end,window_end);@assert length(plan)<=length(goals)
statepath(id)=joinpath(out,"states","state-"*lpad(string(id),2,'0')*".tsv")
function snapshot(state,id,g)
    actual=P.decode_physical(source,state,action);P.validate_front(actual,g)
    open(statepath(id),"w") do io
        println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
        for s in actual;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    end
    P.state_digest(actual)
end
# Start: identity (May 2026) or a prior chain, replayed with the print; its rows and snapshots are copied verbatim.
if haskey(opts,"prior")
    ls=String.(split(chop(read(joinpath(opts["prior"],"chain.moves.tsv"),String);tail=1),'\n'))
    months,k=chain_progress(ls);@assert months==plan[1:k+1] "prior chain months do not match the plan (print window or range changed)"
    state=P.identity_perm();lastend=String(split(ls[2],'\t')[5])
    for l in ls[3:end-1];global state,lastend;f=String.(split(l,'\t'))
        if f[1]=="edge";lastend=f[9]
        elseif f[1]=="move";g,q=parse(Int,f[2]),parse(Int,f[3]);for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end;end
    end
    @assert digest(state)==lastend "resume: replayed prior end state does not match its end digest"
    for i in 1:k+1;cp(joinpath(opts["prior"],"states","state-"*lpad(string(i),2,'0')*".tsv"),statepath(i));end
    rows=ls[1:end-1];edges_before=k
else
    state=P.identity_perm();h0=snapshot(state,1,goals[1])
    rows=String["cubistry.calendar7.chain.v1","source\t5\t2026\t5\t$h0"];edges_before=0
end
function dump(rows)
    tmp=joinpath(out,"chain.moves.tsv.tmp");write(tmp,join(vcat(rows,["finish"]),'\n')*"\n");mv(tmp,joinpath(out,"chain.moves.tsv");force=true)
end
dump(rows)
# Beam library, built once.
params0,spec,_=G.parse_options(String["lambda="*get(opts,"lambda","3"),"width="*get(opts,"width","40"),"library="*get(opts,"library","L5"),
    (haskey(opts,"fanout") ? ["fanout="*opts["fanout"]] : String[])...,(haskey(opts,"maxdepth") ? ["maxdepth="*opts["maxdepth"]] : String[])...,
    (haskey(opts,"patience") ? ["patience="*opts["patience"]] : String[])...])
w=copy(params0.orbit_weights);w[11]=parse(Float64,get(opts,"corew","100"))
params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=true,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
lib=G.build_library(action,a,spec);catalogs=P.chain_catalogues(action)
lib=merge_macros(lib,catalog_macros(catalogs,action,gens));index=build_index(lib);cats=orbit_cats(catalogs,gens)
println("setup ",round(time()-T0;digits=1)," s, library ",length(lib)," threads ",Threads.nthreads());flush(stdout)

elog=open(joinpath(out,"edges.tsv"),"w");println(elog,"id\tyear\tmonth\tmethod\thtm\tqtm\tseconds\tsource_sha256\tend_sha256")
done=0;slowest=0.0;stop=nothing;loop0=time()
for id in edges_before+2:length(plan)
    global state,done,slowest,stop
    cur=plan[edges_before+1+done]
    if done>=max_edges && !unsafe_stop(cur);stop="max_edges";break;end
    if !may_start_edge(time()-loop0,slowest,deadline) && !unsafe_stop(cur);stop="deadline";break;end
    target=goals[id];@assert (target.year,target.month)==plan[id] "goal order";t=time();before=digest(state)
    r=solve_edge(source,state,target,action,a,gens,lib,index,cats,params;finish_depth=parse(Int,get(opts,"finish_depth","3")),nsnap=parse(Int,get(opts,"nsnap","6")),tight=true,finish=true)
    word=r.word;method=r.method
    if isnothing(word)      # greedy fallback: valid but longer
        g=orbit_solve(P,source,state,target,action,catalogs)
        isnothing(g) && (stop="search_stalled";break)
        word=P.macro_normalize(g.word);method="greedy"
    else
        word=P.macro_normalize(word)
    end
    next=P.compose(state,P.macro_word_perm(word,gens))
    @assert P.compose(next,P.macro_word_perm(P.macro_inverse(word),gens))==state
    after=snapshot(next,id,target);m=P.chain_metrics(word,action)
    push!(rows,join(("edge",target.year,target.month,m.htm,m.qtm,m.rotations,m.rotation_qtm,before,after),'\t'))
    append!(rows,["move\t$g\t$q" for (g,q) in P.macro_moves(word)]);push!(rows,"end")
    state=next;done+=1;secs=time()-t;slowest=max(slowest,secs);dump(rows)
    println(elog,join((id,target.year,target.month,method,m.htm,m.qtm,round(secs;digits=1),before,after),'\t'));flush(elog)
    println("edge ",id," ",target.year,"-",lpad(target.month,2,'0')," ",method," HTM ",m.htm," QTM ",m.qtm," ",round(secs;digits=1)," s");flush(stdout)
end
close(elog)
produced=plan[1:edges_before+1+done];complete=length(produced)==length(plan)
write_months(joinpath(out,"months.tsv"),month_records(range_start,range_end,window_end,produced,complete ? nothing : something(stop,"deadline");claims))
open(joinpath(out,"PROGRESS.txt"),"w") do io
    println(io,"complete=",complete);println(io,"stop_reason=",complete ? "-" : something(stop,"deadline"))
    println(io,"edges_total=",edges_before+done);println(io,"edges_new=",done);println(io,"chain_end=",ym_str(produced[end]))
    println(io,"plan_end=",ym_str(plan[end]));println(io,"seconds=",round(time()-T0;digits=1))
end
println("RESULT complete=",complete," stop=",complete ? "-" : something(stop,"deadline")," edges_total=",edges_before+done," chain_end=",ym_str(produced[end])," seconds=",round(time()-T0;digits=1))
done==0 && !complete && exit(3)
