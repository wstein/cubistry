#!/usr/bin/env julia
# Descriptive listing, not a proof. Layout B, context reading, candidate print-B:
# the full date rows (3-7) shown by each PR #99 legal state in which a stacked
# sticker stands for a single date, every such cell, and the months per display.
# Usage: context_use.jl DAG > evidence/context-use.tsv
include(joinpath(@__DIR__,"stacked_common.jl"))
const WEEKDAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
function context_listing(dag_path)
    goals=stacked_goals("B");cand=read_stacked_print(joinpath(@__DIR__,"evidence","print-B.tsv"),"B")
    proof=replay_dag(dag_path);old=physical_targets("EN")
    index=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(old))
    months=Dict(i=>String[] for i in 1:91)
    for y in 2026:2099,m in 1:12;push!(months[index[join(string.(wrapped_board(y,m)),"|")]],"$y-$(lpad(m,2,'0'))");end
    # Reading as seen on the front: a half turn reads a half-turn-symmetric label
    # reversed through the glyph table (printed "12" at angle 2 reads "21").
    function seen(s)
        isempty(s.text) && return "."
        q=findfirst(==(s.up),IMAGE_UPS)-1;t=s.text
        if q==2 && all(ch->haskey(HALF,ch),t);t=join(HALF[ch] for ch in reverse(collect(t)))
        elseif q!=0;t="$(t)@$(q)";end
        "$(t) $(s.ink)"
    end
    label(s)=seen(s)
    println("# descriptive listing, not a proof; cells show the label as read on the front (printed text turned by the actual angle; half-turn symmetric labels read reversed through the PR #99 glyph table) and ink; '.' is blank; @q marks any other quarter turn")
    total=0
    for id in 1:91
        g=goals[id];state=decode_physical(cand.source,signed_perm(proof.registers,proof.targets[id]),proof.action)
        front=Dict((r,c)=>only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state)) for r in 3:7,c in 1:7)
        uses=[(r,c) for r in 3:7,c in 1:7 if !isnothing(parse_stacked(front[(r,c)].text)) && front[(r,c)].text!=g.board[r,c][1]]
        isempty(uses) && continue
        off=offset(g.year,g.month,"EN");n=daysinmonth(Date(g.year,g.month,1));total+=length(months[id])
        println("target\t",id,'\t',g.year,'\t',g.month,'\t',WEEKDAY[off+1],'\t',n,'\t',length(months[id]),'\t',length(uses))
        for r in 3:7;println("row\t",id,'\t',r,'\t',join([label(front[(r,c)]) for c in 1:7],'\t'));end
        for (r,c) in sort(uses)
            s=front[(r,c)];angle=findfirst(==(s.up),IMAGE_UPS)-1
            println("use\t",id,'\t',r,',',c,'\t',s.id,'\t',label(s),'\t',angle,'\t',g.board[r,c][1],' ',g.board[r,c][2])
        end
        println("months\t",id,'\t',join(months[id],','))
    end
    println("total-months\t",total)
end
context_listing(only(ARGS))
