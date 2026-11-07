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
function set_strict()
    empty!(HALF);merge!(HALF,Dict('0'=>'0','6'=>'9','9'=>'6'))
end
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
        for t in 1:tries
            choice=shuffle(cands)[1:length(missing)]
            trial=copy(src)
            for (i,a) in zip(choice,missing);trial[i]=printed_as(src[i],a,k);end
            for i in cands;(i in choice) || (trial[i]=merge(src[i],(text="",ink="blank")));end
            bad=sum(unmatched_cells(trial,g.board,keys_) for g in goals)
            nchg=count(i->(trial[i].text,trial[i].ink,trial[i].up)!=(src[i].text,src[i].ink,src[i].up),ids)
            cost=bad*1000+nchg
            if cost<bestcost;bestcost=cost;best=trial;end
            bad==0 && t>=min(tries,50) && break
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
