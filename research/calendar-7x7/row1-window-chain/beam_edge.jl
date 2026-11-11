#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate producer (check.jl, the Flix checker and verify_chain.jl decide).
# Pilot: one month edge of the stored window chain, re-solved either by the greedy orbit solver
# (mode=greedy, as generate.jl) or by the global macro beam (mode=beam; logic of
# ../global-search/search.jl and ../upright-beam/beam2.jl: core weight, orbit catalogs, exact last
# mile). The chain prefix up to the source month is copied verbatim, so the output is a complete
# window chain ending at TARGET and runs through the unchanged checkers with WINDOW_END=TARGET.
#   julia --threads=4 beam_edge.jl OUT PRINT CHAIN STATES YEAR MONTH [key=value ...]
# Options: mode=beam|greedy library=L1|L4|L5 width lambda fanout maxdepth patience corew nsnap
#          finish_depth. Env WINDOW_END must be the window of PRINT (default 2029-12).
@assert length(ARGS)>=6 "usage: beam_edge.jl OUT PRINT CHAIN STATES YEAR MONTH [key=value ...]"
ENV["WINDOW_END"]=get(ENV,"WINDOW_END","2029-12")
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(CAL,"row1-window-print/common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
include(joinpath(CAL,"pure-split-states","orbit_solve.jl"))
const G=GlobalSearch
apply_strict_rule!(G.P,G.M.V)
Core.eval(G.P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
include(joinpath(CAL,"upright-beam","beam2.jl"))
const P=G.P

out,printpath,chainpath,statesdir=ARGS[1:4]
tyear,tmonth=parse(Int,ARGS[5]),parse(Int,ARGS[6])
opts=Dict(String.(split(x,'='))[1]=>String.(split(x,'='))[2] for x in ARGS[7:end])
mode=get(opts,"mode","beam");@assert mode in ("beam","greedy")
@assert !ispath(out) "Use a new scratch output directory";mkpath(out)

labels=coupled_labels(read(joinpath(CAL,"row1-revision/layout.tsv"),String))
goals=coupled_goals(labels,"names-band","window")
source=window_read_print(printpath)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators];a=G.M.Algebra(action)
digest(st)=P.state_digest(P.decode_physical(source,st,action))

# Replay the stored chain up to (not including) the edge into YEAR-MONTH; copy its rows verbatim.
ls=String.(split(chop(read(chainpath,String);tail=1),'\n'));@assert ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish"
function replay_prefix(ls)
state=P.identity_perm();prefix_rows=String[ls[1],ls[2]];stored_htm=-1;stored_qtm=-1;k=0;i=3;lastend=String(split(ls[2],'\t')[5])
while i<length(ls)
    f=String.(split(ls[i],'\t'));@assert f[1]=="edge"
    j=i;while ls[j]!="end";j+=1;end
    if (parse(Int,f[2]),parse(Int,f[3]))==(tyear,tmonth)
        stored_htm,stored_qtm=parse(Int,f[4]),parse(Int,f[5]);break
    end
    for l in ls[i+1:j-1];m=split(l,'\t');g,q=parse(Int,m[2]),parse(Int,m[3]);for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end;end
    append!(prefix_rows,ls[i:j]);lastend=String(f[9]);k+=1;i=j+1
end
(;state,prefix_rows,stored_htm,stored_qtm,k,lastend)
end
(;state,prefix_rows,stored_htm,stored_qtm,k,lastend)=replay_prefix(ls)
# stored_htm stays -1 when the edge is not in CHAIN: CHAIN is then a candidate chain and the edge extends it (the target-month assert below fixes the month).
if stored_htm<0;println("edge $tyear-$tmonth not in CHAIN: extending the chain by ",k," replayed edges");end
@assert digest(state)==lastend "replayed state does not match the stored digest"
first_id=k+1;id=k+2;target=goals[id];@assert (target.year,target.month)==(tyear,tmonth)
for n in 1:first_id;cp(joinpath(statesdir,"state-"*lpad(string(n),2,'0')*".tsv"),joinpath(out,"state-"*lpad(string(n),2,'0')*".tsv"));end
before=digest(state)
println("source state ",first_id," digest ",before[1:16]," stored greedy edge HTM ",stored_htm," QTM ",stored_qtm," threads ",Threads.nthreads());flush(stdout)

t0=time();word=nothing;method=mode
if mode=="greedy"
    catalogs=P.chain_catalogues(action)
    r=orbit_solve(P,source,state,target,action,catalogs)
    @assert !isnothing(r) "greedy orbit solver stalled"
    word=P.macro_normalize(r.word)
else
    params0,spec,_=G.parse_options(String["lambda="*get(opts,"lambda","3"),"width="*get(opts,"width","40"),"library="*get(opts,"library","L4"),
        (haskey(opts,"fanout") ? ["fanout="*opts["fanout"]] : String[])...,(haskey(opts,"maxdepth") ? ["maxdepth="*opts["maxdepth"]] : String[])...,
        (haskey(opts,"patience") ? ["patience="*opts["patience"]] : String[])...])
    w=copy(params0.orbit_weights);w[11]=parse(Float64,get(opts,"corew","100"))
    params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=true,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
    lib=G.build_library(action,a,spec);catalogs=P.chain_catalogues(action)
    lib=merge_macros(lib,catalog_macros(catalogs,action,gens));index=build_index(lib);cats=orbit_cats(catalogs,gens)
    println("setup ",round(time()-t0;digits=1)," s, library ",length(lib));flush(stdout)
    r=solve_edge(source,state,target,action,a,gens,lib,index,cats,params;finish_depth=parse(Int,get(opts,"finish_depth","3")),nsnap=parse(Int,get(opts,"nsnap","6")),tight=true,finish=true)
    println("beam status ",r.status," method ",r.method);flush(stdout)
    @assert !isnothing(r.word) "beam found no word ($(r.status))"
    word=P.macro_normalize(r.word);method=r.method
end
secs=time()-t0
next=P.compose(state,P.macro_word_perm(word,gens))
@assert P.compose(next,P.macro_word_perm(P.macro_inverse(word),gens))==state
P.validate_front(P.decode_physical(source,next,action),target)
actual=P.decode_physical(source,next,action)
open(joinpath(out,"state-"*lpad(string(id),2,'0')*".tsv"),"w") do io
    println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
    for s in actual;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
end
m=P.chain_metrics(word,action)
rows=copy(prefix_rows)
push!(rows,join(("edge",tyear,tmonth,m.htm,m.qtm,m.rotations,m.rotation_qtm,before,digest(next)),'\t'))
append!(rows,["move\t$g\t$q" for (g,q) in P.macro_moves(word)]);push!(rows,"end","finish")
write(joinpath(out,"candidate.moves.tsv"),join(rows,'\n')*"\n")
println("RESULT mode=",mode," method=",method," edge ",tyear,"-",tmonth," HTM=",m.htm," QTM=",m.qtm," rot=",m.rotations," seconds=",round(secs;digits=1)," stored_greedy_HTM=",stored_htm," stored_QTM=",stored_qtm)
