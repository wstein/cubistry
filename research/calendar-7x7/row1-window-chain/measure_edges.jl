#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Measurement of streaming inside an edge (README, "Re-root measurement"). Read-only with respect to the producer: the production
# solver solve_edge is called unchanged; the hook BEAMLOG of upright-beam/beam2.jl (default nothing) only reads the beam.
# Per edge of a stored chain:
#   1. the unconstrained solve (the stored edge is reproduced: same_moves, same_end) with a log of every beam iteration: A = common
#      prefix of all beam nodes, B = node 1, C = common prefix of beam nodes, incumbent and all snapshots (columns of summary.tsv);
#   2. with reroot=1: re-root solves. The commit events are the growth of A that extends the committed prefix; the commit points are
#      the first event with HTM >= each threshold (commits=1,10,30,60) and the last event. For each commit point P the edge is solved
#      again from the state after P (solve_edge, same parameters). The streamed route is P followed by that solve; its length against
#      the unconstrained length is the length cost (reroot.tsv).
#   julia --threads=4 measure_edges.jl OUTDIR PRINT CHAIN ID[,ID...] [key=value ...]
#   keys: width lambda library corew finish_depth nsnap (as the producer), reroot (1), commits (1,10,30,60), deadline_s (no re-root solve
#   starts after this many seconds since the start of the script; default none)
@assert length(ARGS)>=4 "usage: measure_edges.jl OUTDIR PRINT CHAIN ID[,ID...] [key=value ...]"
isempty(get(ENV,"CAL7_WINDOW_MONTHS","")) && error("set CAL7_WINDOW_MONTHS")
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(@__DIR__,"window_chain_lib.jl"));using .WindowChainLib
include(joinpath(@__DIR__,"reroot_measure_lib.jl"));using .RerootMeasure
include(joinpath(CAL,"row1-window-print/common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
include(joinpath(CAL,"pure-split-states","orbit_solve.jl"))
const G=GlobalSearch
apply_strict_rule!(G.P,G.M.V)
Core.eval(G.P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
include(joinpath(CAL,"upright-beam","beam2.jl"))
const P=G.P
const RM=RerootMeasure

out,printpath,chainpath=ARGS[1:3]
ids=RM.parse_ids(ARGS[4])
opts=Dict(String.(split(x,'='))[1]=>String.(split(x,'='))[2] for x in ARGS[5:end])
const DO_REROOT=get(opts,"reroot","1")=="1"
const THRESHOLDS=RM.parse_thresholds(get(opts,"commits","1,10,30,60"))
const DEADLINE=parse(Float64,get(opts,"deadline_s","Inf"))
mkpath(out)
layout_path,layout_sha=layout_input(joinpath(CAL,"row1-revision/layout.tsv"))
labels=coupled_labels(read(layout_path,String))
goals=coupled_goals(labels,"names-band","window")
source=window_read_print(printpath)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators];a=G.M.Algebra(action)
digest(st)=P.state_digest(P.decode_physical(source,st,action))
T0=time()
params0,spec,_=G.parse_options(String["lambda="*get(opts,"lambda","3"),"width="*get(opts,"width","40"),"library="*get(opts,"library","L5")])
w=copy(params0.orbit_weights);w[11]=parse(Float64,get(opts,"corew","100"))
params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=true,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
lib=G.build_library(action,a,spec);catalogs=P.chain_catalogues(action)
lib=merge_macros(lib,catalog_macros(catalogs,action,gens));index=build_index(lib);cats=orbit_cats(catalogs,gens)
println("setup ",round(time()-T0;digits=1)," s, library ",length(lib)," threads ",Threads.nthreads()," width ",params.width," lambda ",params.lambda," reroot ",DO_REROOT," commits ",THRESHOLDS);flush(stdout)

const lcp=RM.lcp;const lcp_all=RM.lcp_all
htm(w)=G.M.htm(w)
qtm(w)=sum((q==2 ? 2 : 1 for (g,q) in P.macro_moves(w) if g%7!=0);init=0)
solve(st,g)=solve_edge(source,st,g,action,a,gens,lib,index,cats,params;finish_depth=parse(Int,get(opts,"finish_depth","3")),nsnap=parse(Int,get(opts,"nsnap","6")),tight=true,finish=true)
advance(state,moves)=(for (gg,q) in moves;for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[gg]);end;end;state)

edges=RM.read_chain_edges(read(chainpath,String))
byid=Dict(e.id=>e for e in edges)
for id in ids;haskey(byid,id) || error("edge $id is not in the chain");isempty(byid[id].wrong) || error("edge $id is a best-effort edge (wrong cells); solve_edge does not produce it");end
summary=open(joinpath(out,"summary.tsv"),"w")
println(summary,join(("id","month","stored_htm","stored_method","new_htm","new_method","same_moves","same_end","solve_s","beam_s","iters","word0_htm","first_commit_iter","first_commit_s","iter_p_ge_10","t_p_ge_10","iter_p_ge_half","t_p_ge_half","A_final_htm","A_last_htm","A_viol","B_retract_iters","B_retract_sum_htm","B_retract_max_htm","B_retract_vs_final_htm","C_last_htm","C_viol","qtm_final"),'\t'));flush(summary)
reroot=open(joinpath(out,"reroot.tsv"),"w")
println(reroot,join(RM.REROOT_COLUMNS,'\t'));flush(reroot)

state=P.identity_perm()
for e in edges
    global state
    id=e.id
    if id in ids
        f=e.fields;ym=(e.year,e.month);g=goals[id];@assert (g.year,g.month)==ym
        mon="$(ym[1])-$(lpad(ym[2],2,'0'))"
        stored_moves=e.moves
        recs=NamedTuple[];tsolve=time();tbeam=Ref(0.0);w0=Ref(Int[])
        BEAMLOG[]=function(kind,x,nodes,best,snaps)
            t=time()-tsolve
            if kind==:iter
                ws=[n.word for n in nodes]
                A=lcp_all(ws);Aw=ws[1][1:A]
                allw=copy(ws);isnothing(best) || push!(allw,best.word);append!(allw,[n.word for n in values(snaps)])
                C=lcp_all(allw)
                push!(recs,(t=t,depth=x,beam=length(nodes),A=Aw,B=copy(ws[1]),Cn=C,Cw=ws[1][1:C],best=isnothing(best) ? -1 : best.cost,cost1=nodes[1].cost))
            else
                tbeam[]=t;w0[]=copy(x)
            end
        end
        r=try solve(state,g) finally BEAMLOG[]=nothing end
        solve_s=time()-tsolve
        word=P.macro_normalize(r.word);nxt=P.compose(state,P.macro_word_perm(word,gens))
        same_moves=P.macro_moves(word)==stored_moves;same_end=digest(nxt)==f[9]
        m=P.chain_metrics(word,action)
        fin=r.word   # the word as improve_word returns it (before macro_normalize)
        h0=htm(w0[]);n=length(recs)
        open(joinpath(out,"iter-$(id)-$(mon).tsv"),"w") do io
            println(io,"depth\tt_s\tbeam\tA_len\tA_htm\tA_qtm\tA_prefix_of_final\tB_len\tB_htm\tB_retract_htm\tC_htm\tbest_cost\tcost1")
            prevB=Int[]
            for rc in recs
                ap=lcp(rc.A,fin)==length(rc.A)
                rt=isempty(prevB) ? 0 : htm(prevB)-htm(prevB[1:lcp(prevB,rc.B)])
                println(io,join((rc.depth,round(rc.t;digits=2),rc.beam,length(rc.A),htm(rc.A),qtm(rc.A),ap,length(rc.B),htm(rc.B),rt,htm(rc.Cw),rc.best,rc.cost1),'\t'))
                prevB=rc.B
            end
        end
        Ah=[htm(rc.A) for rc in recs];Ch=[htm(rc.Cw) for rc in recs]
        viol=count(rc->lcp(rc.A,fin)<length(rc.A),recs);violC=count(rc->lcp(rc.Cw,fin)<length(rc.Cw),recs)
        fc=findfirst(>(0),Ah);p10=findfirst(>=(10),Ah);ph=findfirst(>=(m.htm/2),Ah)
        rts=Int[];for k in 2:n;push!(rts,htm(recs[k-1].B)-htm(recs[k-1].B[1:lcp(recs[k-1].B,recs[k].B)]));end
        Bfin=n>0 ? htm(recs[n].B)-htm(recs[n].B[1:lcp(recs[n].B,fin)]) : 0
        tt(k)=isnothing(k) ? "-" : string(round(recs[k].t;digits=1))
        println(summary,join((id,mon,f[4],"?",m.htm,r.method,same_moves,same_end,round(solve_s;digits=1),round(tbeam[];digits=1),n,h0,something(fc,"-"),tt(fc),something(p10,"-"),tt(p10),something(ph,"-"),tt(ph),
            n>0 ? htm(fin[1:lcp(recs[n].A,fin)]) : 0,n>0 ? Ah[n] : 0,viol,count(>(0),rts),sum(rts;init=0),maximum(rts;init=0),Bfin,n>0 ? Ch[n] : 0,violC,m.qtm),'\t'));flush(summary)
        println("edge ",id," ",ym," stored HTM ",f[4]," new HTM ",m.htm," method ",r.method," same_moves=",same_moves," same_end=",same_end," solve ",round(solve_s;digits=1)," s beam ",round(tbeam[];digits=1)," s iters ",n);flush(stdout)
        if DO_REROOT
            ev=RM.commit_events([rc.A for rc in recs],htm);cps=RM.commit_points(ev,THRESHOLDS)
            println("edge ",id," commit events ",length(ev)," commit points ",[(c.iter,c.htm) for c in cps]);flush(stdout)
            for (k,c) in enumerate(cps)
                Pw=c.prefix;t0=time()
                row(;rest_htm=-1,streamed=-1,merged=-1,seam=0,method="none",status)=RM.reroot_row(;id,month=mon,k,iter=c.iter,t_s=recs[c.iter].t,p_htm=htm(Pw),free_htm=r.htm,rest_htm,streamed,merged,seam,method,resolve_s=time()-t0,status)
                if time()-T0>DEADLINE
                    println(reroot,row(;status="deadline"));flush(reroot);continue
                end
                st2=P.compose(state,P.macro_word_perm(Pw,gens))
                r2=solve(st2,g)
                if r2.word===nothing
                    println(reroot,row(;status="none"))
                else
                    full=vcat(Pw,r2.word)
                    # the streamed route must reach the goal from the edge start: check the whole route, not only the rest
                    stf=P.compose(state,P.macro_word_perm(full,gens))
                    ok=try P.validate_front(P.decode_physical(source,stf,action),g);true catch;false end
                    cst=RM.reroot_cost(Pw,r2.word,r.htm,htm;norm=P.macro_normalize)
                    merged=htm(P.macro_normalize(full))
                    println(reroot,row(;rest_htm=cst.rest_htm,streamed=cst.streamed,merged,seam=cst.seam,method=r2.method,status=ok ? "ok" : "invalid"))
                    println("edge ",id," commit ",k," P ",cst.p_htm," HTM, rest ",cst.rest_htm,", streamed ",cst.streamed," vs free ",r.htm," (cost ",cst.cost,", share ",round(cst.share;digits=3),") ",r2.method," ",ok ? "ok" : "INVALID");flush(stdout)
                end
                flush(reroot)
            end
        end
    end
    state=advance(state,e.moves)
    id>=maximum(ids) && break
end
close(summary);close(reroot)
