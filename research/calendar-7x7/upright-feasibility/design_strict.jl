#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED strict-print designer (feasibility study; the checkers would decide).
# Starting from the pure-split A print it keeps every surface whose class the strict
# rule still needs and reprints only surplus surfaces (and spare blanks) with the
# missing classes. Per orbit it searches (random restarts) for an assignment under
# which every one of the 91 displays keeps a cubie-level front matching.
#   design_strict.jl PRINT OUT_PRINT [seed] [tries] > changes.tsv
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
include(joinpath(@__DIR__,"..","pure-split-states","design_lib.jl"))
using Random
include(joinpath(@__DIR__,"strict_rule.jl"))
apply_strict_rule!(Main)   # top level: redefinitions must be visible to the running code
set_strict()=nothing
# No aliasing: the class key text is the real glyph (design_lib.jl maps month 0 to O).
function printed_as(s,a,k)
    a[3]=="blank" && return merge(s,(text="",ink="blank"))
    cell=first((r,c) for r in 1:7,c in 1:7 if orbit(r,c)==k && (b=artwork(a[1],a[3],r,c);(b[1],string(b[2]),b[3]))==a)
    pos=(cell[2]-4,4-cell[1],3)
    rot=first(rr for rr in ROTATIONS if rotate(s.home,rr)==pos && rotate(s.normal,rr)==FRONT_NORMAL)
    merge(s,(text=a[1],ink=a[3],up=inverse_rotate(IMAGE_UPS[1],rot)))
end
swap01(t)=replace(t,'O'=>'0','0'=>'O','I'=>'1','1'=>'I')
function design(print_path,out,seed,tries)
    set_strict();Random.seed!(seed)
    goals=stacked_goals(PURE_VARIANT);src=[s for s in read_physical(print_path)];base=copy(src)
    req=pure_requirement(goals);cls=[surface_class(s) for s in src];changes=String[]
    for k in sort!(collect(keys(req)))
        ids=[i for i in 1:294 if cls[i][1]==k];assigned=Set{Int}()
        for (a,need) in sort!(collect(req[k]))
            a[3]=="blank" && continue
            pool=sort([i for i in ids if cls[i][2]==a && !(i in assigned)])
            for i in pool[1:min(need,end)];push!(assigned,i);end
        end
        missing=NTuple{3,String}[]
        for (a,need) in sort!(collect(req[k]))
            a[3]=="blank" && continue
            append!(missing,fill(a,max(0,need-count(i->i in assigned && cls[i][2]==a,ids))))
        end
        cands=sort([i for i in ids if !(i in assigned)])
        blank_need=get(req[k],("","0","blank"),0)
        println(stderr,"orbit ",k," missing ",length(missing)," candidates ",length(cands)," blank need ",blank_need)
        @assert length(cands)-length(missing)>=blank_need "orbit $k cannot keep $blank_need blanks"
        keys_=unique(bodykey(src[i].home) for i in ids)
        # Candidates that are already blank are preferred (no reprint of printed artwork).
        best=nothing;bestcost=typemax(Int)
        # trial 1: retext a surface whose text differs only by O/0 or I/1 (FR1 -> FRI)
        natchoice=zeros(Int,length(missing));pool=copy(cands)
        for (mi,a) in enumerate(missing)
            j=findfirst(i->swap01(src[i].text)==a[1] && src[i].ink==a[3],pool)
            isnothing(j) || (natchoice[mi]=pool[j];deleteat!(pool,j))
        end
        rest=shuffle(setdiff(cands,natchoice))
        for mi in eachindex(natchoice);natchoice[mi]==0 && (natchoice[mi]=popfirst!(rest));end
        for t in 1:tries
            choice=t==1 ? natchoice : shuffle(cands)[1:length(missing)]
            trial=copy(src)
            for (i,a) in zip(choice,missing);trial[i]=printed_as(src[i],a,k);end
            for i in cands;(i in choice) || (trial[i]=merge(src[i],(text="",ink="blank")));end
            bad=sum(unmatched_cells(trial,g.board,keys_) for g in goals)
            nchg=count(i->(trial[i].text,trial[i].ink,trial[i].up)!=(src[i].text,src[i].ink,src[i].up),ids)
            cost=bad*1000+nchg
            if cost<bestcost;bestcost=cost;best=trial;end
            # all tries run: the cost keeps the fewest changed surfaces among matching prints
        end
        trial=best
        changed=[i for i in ids if (trial[i].text,trial[i].ink,trial[i].up)!=(src[i].text,src[i].ink,src[i].up)]
        for i in changed
            push!(changes,"$i\t$(src[i].text)/$(src[i].ink)\t$(trial[i].text)/$(trial[i].ink)\t$(k)\tunmatchable-cells=$(bestcost÷1000)")
        end
        src=trial
    end
    open(out,"w") do io
        println(io,"sticker\tpiece\thome\tnormal\tup\ttext\tink")
        for (i,s) in enumerate(src);println(io,join([i,s.piece,join(s.home,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    end
    println("change-header\tsticker\told\tnew\torbit\tnote")
    foreach(l->println("change\t",l),changes)
    println("design-summary\tchanged=",length(changes),"\tprinted=",count(s->!isempty(s.text),src))
end
design(ARGS[1],ARGS[2],length(ARGS)>=3 ? parse(Int,ARGS[3]) : 1,length(ARGS)>=4 ? parse(Int,ARGS[4]) : 200)
