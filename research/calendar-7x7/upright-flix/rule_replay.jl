#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Replay of the 91 move words through the OLD research front checker (stacked_common
# front_failure + pure_chain direct_move, reading the print with read_physical) under the
# selected rule. This is the second Julia replay next to ../upright-moves/verify_moves.jl,
# which shares no code with the research checkers; here the research checkers themselves
# are used, so the selectable rule of check_pure.jl / pure_chain.jl is what is exercised.
#   CUBISTRY_RULE=strict julia --startup-file=no rule_replay.jl PRINT MOVES_TSV
#   (MOVES_TSV: id year month status htm word seconds). Exit code 1 unless all 91 are accepted.
include(joinpath(@__DIR__,"..","pure-split-states","pure_chain.jl"))   # includes pure_common and the rule hook
# HTM: merge adjacent equal generators (net quarter turns mod 4), whole-cube rotations free.
function merged_htm(word)
    groups=Tuple{Int,Int}[]
    for g in word
        a=abs(g);t=sign(g)
        if !isempty(groups) && first(last(groups))==a;t+=last(pop!(groups));end
        t=mod(t,4);t!=0 && push!(groups,(a,t))
    end
    count(x->x[1]%7!=0,groups)
end
function replay(print_path,moves_path)
    rule=cubistry_rule()
    source=read_physical(print_path)
    base=[(id=i,piece=s.piece,pos=s.home,normal=s.normal,up=s.up,text=s.text,ink=s.ink) for (i,s) in enumerate(source)]
    goals=Set(join(string.(g.board),"|") for g in stacked_goals(PURE_VARIANT))
    @assert length(goals)==91 "expected 91 distinct display boards"
    rows=[split(l,'\t') for l in readlines(moves_path)[2:end] if !isempty(l)]
    @assert length(rows)==91 "need one word per display (91)"
    seen=Set{String}();fails=0
    println("rule-replay-header\trule\tid\tyear\tmonth\tverdict\thtm\tfront")
    for f in rows
        id=parse(Int,f[1]);y=parse(Int,f[2]);m=parse(Int,f[3])
        board=stacked_board(y,m,PURE_VARIANT);key=join(string.(board),"|")
        @assert key in goals && !(key in seen) "display $id duplicates or is not one of the 91 boards"
        push!(seen,key)
        verdict="ACCEPT";h=-1;front="-"
        if f[4] in ("FOUND_GLOBAL","FOUND_ORBIT") || startswith(f[4],"FOUND_HYBRID")
            word=parse.(Int,split(f[6],','))
            state=base
            for g in word
                @assert g!=0 && 1<=abs(g)<=21 "generator outside 1..21 (no layer 0)"
                state=direct_move(state,abs(g),sign(g))
            end
            @assert length(unique((s.pos,s.normal) for s in state))==294
            h=merged_htm(word)
            h==parse(Int,f[5]) || (verdict="REJECT_HTM_MISMATCH")
            cell=front_failure(state,board,"strict")
            cell=="-\t-\t-\t-" || (verdict="REJECT_FRONT";front=replace(cell,'\t'=>' '))
        else
            verdict="REJECT_NO_WORD"
        end
        verdict=="ACCEPT" || (fails+=1)
        println("rule-check\t",rule,'\t',id,'\t',y,'\t',m,'\t',verdict,'\t',h,'\t',front)
    end
    @assert length(seen)==91
    println("move-verdict\t",rule,'\t',fails==0 ? "ACCEPT_ALL_91" : "REJECT",'\t',91-fails,'\t',fails)
    fails==0
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==2 "PRINT MOVES_TSV"
    replay(ARGS...) || exit(1)
end
