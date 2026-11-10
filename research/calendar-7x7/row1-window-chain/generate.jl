#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED bounded chronological word trial; native independent replay required.
@assert 1<=length(ARGS)<=2 "generate.jl OUT [PRINT] (unique scratch directory; optional print for WINDOW_END)"
# Window end: env WINDOW_END (YYYY-MM, default 2028-01); a longer window needs its own print as PRINT.
# Env GENERATE_DEADLINE_S (default 240) stops starting new targets after that many seconds.
const DEADLINE=parse(Float64,get(ENV,"GENERATE_DEADLINE_S","240"))
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(CAL,"row1-window-print/common.jl"))
module WindowPlanner
include(joinpath(Main.CAL,"continuous/solver_chain.jl"))
end
const P=WindowPlanner
apply_strict_rule!(P)
# Candidate-only profile extension. No frozen file or legacy checker is edited.
Core.eval(P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
@assert P.image_normal("",0,"band")!=P.image_normal("",1,"band")
@assert P.image_normal("",0,"band")!=P.image_normal("",0,"blank")
@assert P.image_normal("O",0,"month")!=P.image_normal("0",0,"month")
@assert P.image_normal("FRI",0,"weekday")!=P.image_normal("FR1",0,"weekday")
include(joinpath(CAL,"pure-split-states/orbit_solve.jl"))
labels=coupled_labels(read(joinpath(CAL,"row1-revision/layout.tsv"),String))
goals=coupled_goals(labels,"names-band","window")
@assert length(ARGS)==2 || haskey(ENV,"SEAM_CHAIN") || get(ENV,"WINDOW_END","2028-01")=="2028-01" "a window end after 2028-01 needs its own print or the stored chain as SEAM_CHAIN"
source=window_read_print(length(ARGS)==2 ? ARGS[2] : joinpath(CAL,"row1-window-print/evidence/printing.tsv"))
action=P.pose_action();gens=[UInt16.(g) for g in action.generators]
out=ARGS[1];@assert !ispath(out) "Use a new scratch output directory";mkpath(out)
function dump_candidate(rows,out)
    tmp=joinpath(out,"candidate.moves.tsv.tmp")
    write(tmp,join(vcat(rows,["finish"]),'\n')*"\n")
    mv(tmp,joinpath(out,"candidate.moves.tsv");force=true)
end
function snapshot(source,state,id,g,out)
    actual=P.decode_physical(source,state,action)
    P.validate_front(actual,g)
    path=joinpath(out,"state-"*lpad(string(id),2,'0')*".tsv")
    open(path,"w") do io
        println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
        for s in actual;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    end
    P.state_digest(actual)
end
# Seam mode: SEAM_CHAIN=<stored moves.tsv> SEAM_STATES=<its states directory>. The stored chain is
# replayed with the print and copied verbatim; new months start from its end state. The join is
# checked here (end digest of the last stored edge) and again by check_seam.jl and the chain checkers.
function replay_seam(path,statesdir)
    ls=String.(split(chop(read(path,String);tail=1),'\n'));@assert ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish"
    rows=ls[1:end-1];state=P.identity_perm();k=0;lastend=String(split(ls[2],'\t')[5])
    for l in rows[3:end]
        f=String.(split(l,'\t'))
        if f[1]=="edge";k+=1;lastend=f[9]
        elseif f[1]=="move";g,q=parse(Int,f[2]),parse(Int,f[3]);for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end
        end
    end
    @assert k+1<=length(goals) "stored chain is longer than the requested window"
    @assert P.state_digest(P.decode_physical(source,state,action))==lastend "seam: replayed stored end state does not match its end digest"
    for i in 1:k+1;cp(joinpath(statesdir,"state-"*lpad(string(i),2,'0')*".tsv"),joinpath(out,"state-"*lpad(string(i),2,'0')*".tsv"));end
    String.(rows),state,k+1
end
function trial()
    started=time()
    if haskey(ENV,"SEAM_CHAIN")
        rows,state,first_id=replay_seam(ENV["SEAM_CHAIN"],ENV["SEAM_STATES"])
    else
        state=P.identity_perm();first_id=1
        hash0=snapshot(source,state,1,goals[1],out)
        rows=String["cubistry.calendar7.chain.v1","source\t5\t2026\t5\t$hash0"]
    end
    dump_candidate(rows,out)
    catalogs=P.chain_catalogues(action)
    open(joinpath(out,"attempts.tsv"),"w") do log
        println(log,"target\tyear\tmonth\tstatus\thtm\tseconds\tsource-sha256\tend-sha256\treason")
        first_id==1 ? println(log,"1\t2026\t5\tUNCHECKED_IDENTITY\t0\t0\t$hash0\t$hash0\tnative replay required") : println(log,"$first_id\t-\t-\tUNCHECKED_SEAM_JOIN\t0\t0\t-\t-\tstored chain replayed; join digest matched");flush(log)
        for id in first_id+1:length(goals)
            if time()-started>DEADLINE;println(log,"$id\t$(goals[id].year)\t$(goals[id].month)\tUNKNOWN\t-\t-\t-\t-\tbounded trial deadline");break;end
            target=goals[id];before=P.state_digest(P.decode_physical(source,state,action));t=time()
            r=orbit_solve(P,source,state,target,action,catalogs)
            if isnothing(r)
                println(log,"$id\t$(target.year)\t$(target.month)\tUNKNOWN\t-\t$(time()-t)\t$before\t-\tmacro search stalled");flush(log);break
            end
            word=P.macro_normalize(r.word)
            next=P.compose(state,P.macro_word_perm(word,gens))
            @assert next==r.state
            @assert P.compose(next,P.macro_word_perm(P.macro_inverse(word),gens))==state
            after=snapshot(source,next,id,target,out)
            metrics=P.chain_metrics(word,action)
            push!(rows,join(("edge",target.year,target.month,metrics.htm,metrics.qtm,metrics.rotations,metrics.rotation_qtm,before,after),'\t'))
            append!(rows,["move\t$g\t$q" for (g,q) in P.macro_moves(word)]);push!(rows,"end")
            state=next;dump_candidate(rows,out)
            println(log,join((id,target.year,target.month,"UNCHECKED_WORD",metrics.htm,time()-t,before,after,"native independent replay required"),'\t'));flush(log)
            println("candidate state ",id," ",target.year,"-",target.month," HTM ",metrics.htm," in ",round(time()-t;digits=2),"s");flush(stdout)
        end
    end
end
trial()
