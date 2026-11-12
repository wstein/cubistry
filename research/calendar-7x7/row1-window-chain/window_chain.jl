#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate producer (check.jl, the Flix checker and verify_chain.jl decide).
# Window chain with optimized edges: loops the beam edge of beam_edge.jl (global macro beam, greedy orbit solver
# as fallback) sequentially from the retained state over the chain months: the root month (the identity pose of the print),
# then the months of the month list S; a gap in S is one bridge edge. The library is built once per process. Months that are
# not chain months get a status record (months.tsv), not an edge.
#   julia --threads=4 window_chain.jl OUT PRINT [key=value ...]
# Run contract (the environment of the chain checkers, nothing is hard-wired here):
#   CAL7_WINDOW_MONTHS, CAL7_WINDOW_MONTHS_SHA256  month list S (file, pinned by SHA-256; 1900-01 .. 2100-01); required
#   CAL7_ROOT_MONTH                                 month the identity pose shows (default: first member of S); a root other than
#                                                   S[1] adds one root edge from the identity pose to S[1]
#   CAL7_WINDOW_PRINT_SHA                           SHA-256 of PRINT (checked here when set)
#   CAL7_WINDOW_LAYOUT, CAL7_WINDOW_LAYOUT_SHA256   layout file instead of row1-revision/layout.tsv; needs the pin (a wrong SHA-256 is an error). Default: the built-in
#                                                   layout. Its SHA-256 is written to PROGRESS.txt (layout_sha256) and segments.tsv.
# GENERATE_DEADLINE_S: no new edge starts when the slowest edge so far would not fit before this many seconds (default 3000,
# one segment of about an hour).
# Options: start=YYYY-MM end=YYYY-MM (range of months.tsv; default the chain range) prior=DIR (continue DIR/chain.moves.tsv
# with DIR/edges.tsv, and DIR/states) claims=FILE best_effort=FILE (declared best-effort months: the edge into such a month is written
# into a best-effort target, see below) best_effort_cell=7,1|7,7 (switch, default the cell of the best-effort file) max_edges=N
# library=L1|L4|L5 width lambda corew fanout maxdepth patience nsnap finish_depth.
# Best-effort edge (chain.v2): the target is the true board of the month with the digit 29 (red, the ink of the column) in the one wrong
# cell, (7,1); (7,7) only when best_effort_cell=7,7 is given (a file that names (7,7) without the switch is an error). The edge line is followed by `wrong r c` and
# `hall 7,1;7,7`, and the next edge starts from the state this edge ends in. Objective: the same solver as for an exact month
# (beam, greedy fallback) on that target, i.e. the fewest moves it finds from the retained state; ties are the beam's deterministic order.
# The wrong cells of the end state are recomputed (must be exactly the chosen cell), and so is the Hall deficiency (must be 1); a target
# that no solver reaches stops the run with the reason best_effort_unreachable (name best_effort_cell=7,7 to try the other corner).
# Output OUT: chain.moves.tsv (chain.v1; chain.v2 once an edge is a best-effort edge), states/state-NN.tsv, months.tsv, edges.tsv (cumulative with prior=, column method: beam,
# finishN or greedy), PROGRESS.txt (incl. greedy_edges).
# Exit: 0 chain complete or stopped cleanly (PROGRESS.txt says which), 3 no new edge was produced, otherwise error.
@assert length(ARGS)>=2 "usage: window_chain.jl OUT PRINT [key=value ...]"
@assert !isempty(get(ENV,"CAL7_WINDOW_MONTHS","")) "set CAL7_WINDOW_MONTHS and CAL7_WINDOW_MONTHS_SHA256 (month list S)"
@assert !haskey(ENV,"WINDOW_END") "the month list and WINDOW_END are exclusive"
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
include(joinpath(@__DIR__,"best_effort_edge.jl"))
const P=G.P

out,printpath=ARGS[1:2]
opts=Dict(String.(split(x,'='))[1]=>String.(split(x,'='))[2] for x in ARGS[3:end])
members=read_month_list(ENV["CAL7_WINDOW_MONTHS"],get(ENV,"CAL7_WINDOW_MONTHS_SHA256",""))
@assert members==window_month_list() "producer and checker readers disagree on the month list"
root=root_month(get(ENV,"CAL7_ROOT_MONTH",""),members);rooted=root!=members[1]
plan=chain_plan(members,root);flags=chain_flags(members,root)
range_start=isempty(get(opts,"start","")) ? min(plan[1],members[1]) : parse_ym(opts["start"]);range_end=isempty(get(opts,"end","")) ? plan[end] : parse_ym(opts["end"])
max_edges=parse(Int,get(opts,"max_edges","100000"));deadline=parse(Float64,get(ENV,"GENERATE_DEADLINE_S",string(DEFAULT_DEADLINE_S)))
claims=haskey(opts,"claims") ? read_claims(opts["claims"]) : Dict{Tuple{Int,Int},NTuple{4,String}}()
best=haskey(opts,"best_effort") ? read_best_effort(opts["best_effort"]) : Dict{Tuple{Int,Int},NTuple{3,String}}()
layout_path,layout_sha=layout_input(joinpath(CAL,"row1-revision/layout.tsv"))   # CAL7_WINDOW_LAYOUT + CAL7_WINDOW_LAYOUT_SHA256, default the built-in layout

@assert !ispath(out) "Use a new scratch output directory";mkpath(joinpath(out,"states"))

labels=coupled_labels(read(layout_path,String))
goals=coupled_goals(labels,"names-band","window")      # the members of S
rooted && (goals=vcat([coupled_month_goal(labels,root...)],goals))   # the root month is not a member: its goal comes first
@assert [(g.year,g.month) for g in goals]==plan "goals follow the chain plan"
isempty(get(ENV,"CAL7_WINDOW_PRINT_SHA","")) || @assert bytes2hex(sha256(read(printpath)))==ENV["CAL7_WINDOW_PRINT_SHA"] "print SHA-256 differs from CAL7_WINDOW_PRINT_SHA"
source=window_read_print(printpath)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators];a=G.M.Algebra(action)
digest(st)=P.state_digest(P.decode_physical(source,st,action))
statepath(id)=joinpath(out,"states","state-"*lpad(string(id),2,'0')*".tsv")
function snapshot(state,id,g)
    actual=P.decode_physical(source,state,action);P.validate_front(actual,g)
    open(statepath(id),"w") do io
        println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
        for s in actual;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    end
    P.state_digest(actual)
end
# Start: identity (the root month) or a prior chain, replayed with the print; its rows and snapshots are copied verbatim.
if haskey(opts,"prior")
    ls=String.(split(chop(read(joinpath(opts["prior"],"chain.moves.tsv"),String);tail=1),'\n'))
    months,k=chain_progress(ls,plan);@assert months==plan[1:k+1] "prior chain months do not match the plan (month list or root changed)"
    state=P.identity_perm();lastend=String(split(ls[2],'\t')[5])
    for l in ls[3:end-1];global state,lastend;f=String.(split(l,'\t'))
        if f[1]=="edge";lastend=f[9]
        elseif f[1]=="move";g,q=parse(Int,f[2]),parse(Int,f[3]);for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end;end
    end
    @assert digest(state)==lastend "resume: replayed prior end state does not match its end digest"
    rows=ls[1:end-1];edges_before=k
    prior_best_edges=Set((parse(Int,split(ls[i],'\t')[2]),parse(Int,split(ls[i],'\t')[3])) for i in 3:length(ls)-1 if startswith(ls[i],"edge\t") && startswith(ls[i+1],"wrong\t"))   # best-effort edges of earlier segments
    prior_methods=read_edges(joinpath(opts["prior"],"edges.tsv"),k)   # the solver record of earlier segments is carried forward
    prior_segments=read_segments(joinpath(opts["prior"],"segments.tsv"))   # so are the inputs of earlier segments
    check_segments_layout(prior_segments,layout_sha)
    for i in 1:k+1;cp(joinpath(opts["prior"],"states","state-"*lpad(string(i),2,'0')*".tsv"),statepath(i));end
else
    state=P.identity_perm();h0=snapshot(state,1,goals[1])
    prior_segments=String[];prior_best_edges=Set{Tuple{Int,Int}}()
    rows=String["cubistry.calendar7.chain.v1","source\t$(root[2])\t$(root[1])\t$(root[2])\t$h0"];edges_before=0;prior_methods=String[]
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

elog=open(joinpath(out,"edges.tsv"),"w");println(elog,EDGES_HEADER)
if haskey(opts,"prior")   # cumulative edges.tsv: prior rows verbatim, then the new ones
    for l in split(chomp(read(joinpath(opts["prior"],"edges.tsv"),String)),'\n')[2:end];println(elog,l);end
end;flush(elog)
new_methods=String[];best_edges=Set{Tuple{Int,Int}}()
done=0;slowest=0.0;stop=nothing;loop0=time()
for id in edges_before+2:length(plan)
    global state,done,slowest,stop
    stop=stop_reason(done,max_edges,time()-loop0,slowest,deadline,plan[edges_before+1+done])
    stop===nothing || break
    true_goal=goals[id];@assert (true_goal.year,true_goal.month)==plan[id] "goal order";t=time();before=digest(state)
    wrong=nothing;target=true_goal
    if haskey(best,plan[id])      # declared best-effort month: write the edge into the target with the digit 29 in the wrong cell
        wrong=best_effort_cell(best[plan[id]][2],get(opts,"best_effort_cell",""))
        hd=hall_deficiency(source,true_goal.board,best_effort_hall());hd==1 || error("Hall set of $(ym_str(plan[id])) has deficiency $hd, not 1: no one-wrong-cell edge")
        target=(year=true_goal.year,month=true_goal.month,board=best_effort_board(true_goal.board,wrong))
        println("best-effort month ",ym_str(plan[id]),": wrong cell ",wrong," shows ",best_effort_art(wrong)[1]," (art stickers ",art_stickers(source,best_effort_art(wrong)),")")
    end
    r=solve_edge(source,state,target,action,a,gens,lib,index,cats,params;finish_depth=parse(Int,get(opts,"finish_depth","3")),nsnap=parse(Int,get(opts,"nsnap","6")),tight=true,finish=true)
    word=r.word;method=r.method
    if isnothing(word)      # greedy fallback: valid but longer
        g=orbit_solve(P,source,state,target,action,catalogs)
        isnothing(g) && (stop=stop_for_unreached(wrong);break)
        word=P.macro_normalize(g.word);method="greedy"
    else
        word=P.macro_normalize(word)
    end
    next=P.compose(state,P.macro_word_perm(word,gens))
    @assert P.compose(next,P.macro_word_perm(P.macro_inverse(word),gens))==state
    after=snapshot(next,id,target);m=P.chain_metrics(word,action)
    if !isnothing(wrong)      # own re-check of the rule: exactly the chosen wrong cell differs from the true board, and it shows the art
        act=P.decode_physical(source,next,action)
        @assert front_mismatches(act,true_goal.board)==[wrong] "best-effort end state must differ from the board exactly in $wrong"
        @assert shows_art(front_sticker(act,wrong),best_effort_art(wrong)) "the wrong cell must show $(best_effort_art(wrong))"
        rows[1]=chain_header(true);push!(best_edges,plan[id])
    end
    push!(rows,join(("edge",target.year,target.month,m.htm,m.qtm,m.rotations,m.rotation_qtm,before,after),'\t'))
    isnothing(wrong) || append!(rows,best_effort_edge_lines(wrong))
    append!(rows,["move\t$g\t$q" for (g,q) in P.macro_moves(word)]);push!(rows,"end")
    state=next;done+=1;push!(new_methods,method);secs=time()-t;slowest=max(slowest,secs);dump(rows)
    println(elog,join((id,target.year,target.month,method,m.htm,m.qtm,round(secs;digits=1),before,after),'\t'));flush(elog)
    println("edge ",id," ",target.year,"-",lpad(target.month,2,'0')," ",method," HTM ",m.htm," QTM ",m.qtm," ",round(secs;digits=1)," s");flush(stdout)
end
close(elog)
produced=plan[1:edges_before+1+done];complete=length(produced)==length(plan)
write_months(joinpath(out,"months.tsv"),month_records(range_start,range_end,plan,produced,complete ? nothing : something(stop,"deadline");claims,best,rooted,best_edges=union(best_edges,prior_best_edges),methods=vcat(prior_methods,new_methods)))
# Provenance of this segment next to those of the earlier ones (run id and research commit come from the workflow; library, beam width
# and lambda are the options of this run).
open(joinpath(out,"segments.tsv"),"w") do io
    println(io,SEGMENTS_HEADER);foreach(r->println(io,r),prior_segments)
    println(io,segment_row(run_id=get(opts,"run_id","local"),research_ref=get(opts,"research_ref","local"),library=get(opts,"library","L5"),width=get(opts,"width","40"),lambda=get(opts,"lambda","3"),
        print_sha=bytes2hex(sha256(read(printpath))),months_sha=ENV["CAL7_WINDOW_MONTHS_SHA256"],root=ym_str(root),edges_from=edges_before,edges_to=edges_before+done,layout_sha=layout_sha))
end
open(joinpath(out,"PROGRESS.txt"),"w") do io
    println(io,"complete=",complete);println(io,"stop_reason=",complete ? "-" : something(stop,"deadline"))
    println(io,"edges_total=",edges_before+done);println(io,"edges_new=",done);println(io,"chain_end=",ym_str(produced[end]))
    println(io,"greedy_edges=",greedy_count(vcat(prior_methods,new_methods)))
    println(io,"plan_end=",ym_str(plan[end]));println(io,"root_month=",ym_str(root));println(io,"rooted=",rooted);println(io,"bridge_edges=",count(==("BRIDGE"),flags))
println(io,"layout_sha256=",layout_sha);println(io,"best_effort_edges=",length(best_edges)+length(prior_best_edges));println(io,"seconds=",round(time()-T0;digits=1))
end
println("RESULT complete=",complete," greedy=",greedy_count(vcat(prior_methods,new_methods))," stop=",complete ? "-" : something(stop,"deadline")," edges_total=",edges_before+done," chain_end=",ym_str(produced[end])," seconds=",round(time()-T0;digits=1))
done==0 && !complete && exit(3)
