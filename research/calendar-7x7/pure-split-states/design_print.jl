#!/usr/bin/env julia
# UNTRUSTED print designer (the checkers decide). Starting from the PR #99 print it
# reprints, orbit by orbit, the surfaces whose artwork scheme A no longer needs (and
# spare blanks) with the missing classes. Among all assignments it keeps one under
# which every scheme-A display still has a cubie-level front matching (two stickers on
# one cubie cannot serve two cells at once), breaking as few still-valid PR #99 states
# as possible, protected displays first.
# Usage: design_print.jl DAG OUT_PRINT [protected display ids...] > changes.tsv
include(joinpath(@__DIR__,"pure_common.jl"))

include(joinpath(@__DIR__,"design_lib.jl"))
function design(dag_path,out,protect=Int[])
    goals=stacked_goals(PURE_VARIANT);old=physical_targets("EN");src=[s for s in read_physical(PR99_PRINT)]
    proof=replay_dag(dag_path)
    kept=[id for id in 1:91 if goals[id].board==old[id].board]
    shows=Dict{Int,Set{Int}}()
    for id in kept
        st=decode_physical(src,signed_perm(proof.registers,proof.targets[id]),proof.action)
        foreach(s->s.normal==FRONT_NORMAL && push!(get!(shows,s.id,Set{Int}()),id),st)
    end
    req=pure_requirement(goals);cls=[surface_class(s) for s in src];changes=String[]
    for k in sort!(collect(keys(req)))
        ids=[i for i in 1:294 if cls[i][1]==k];assigned=Set{Int}()
        for (a,need) in sort!(collect(req[k]))
            a[3]=="blank" && continue
            pool=sort([i for i in ids if cls[i][2]==a && !(i in assigned)];
                by=i->(isempty(intersect(get(shows,i,Set{Int}()),protect)),!haskey(shows,i),i))
            for i in pool[1:min(need,end)];push!(assigned,i);end
        end
        missing=NTuple{3,String}[]
        for (a,need) in sort!(collect(req[k]))
            a[3]=="blank" && continue
            append!(missing,fill(a,max(0,need-count(i->i in assigned && cls[i][2]==a,ids))))
        end
        cands=sort([i for i in ids if !(i in assigned)])
        blank_need=get(req[k],("","0","blank"),0)
        @assert length(cands)-length(missing)>=blank_need "orbit $k cannot keep $blank_need blanks"
        keys_=unique(bodykey(src[i].home) for i in ids)
        best=nothing
        for choice in injections(cands,length(missing))
            trial=copy(src)
            for (i,a) in zip(choice,missing);trial[i]=printed_as(src[i],a,k);end
            for i in cands;(i in choice) || (trial[i]=merge(src[i],(text="",ink="blank")));end
            changed=[i for i in ids if (trial[i].text,trial[i].ink,trial[i].up)!=(src[i].text,src[i].ink,src[i].up)]
            brokeset=union(Set{Int}(),(get(shows,i,Set{Int}()) for i in changed)...)
            bad=sum(unmatched_cells(trial,g.board,keys_) for g in goals)
            cost=(bad,length(intersect(brokeset,protect)),length(brokeset),choice)
            (isnothing(best) || cost<best[1]) && (best=(cost,trial,changed))
        end
        cost,trial,changed=best
        for i in changed
            push!(changes,"$i\t$(src[i].text)/$(src[i].ink)\t$(trial[i].text)/$(trial[i].ink)\t$(k)\tunmatchable-cells=$(cost[1])")
        end
        src=trial
    end
    open(out,"w") do io
        println(io,"sticker\tpiece\thome\tnormal\tup\ttext\tink")
        for (i,s) in enumerate(src);println(io,join([i,s.piece,join(s.home,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    end
    foreach(println,changes)
    base=read_physical(PR99_PRINT)
    final=union(Set{Int}(),(get(shows,i,Set{Int}()) for i in 1:294 if (src[i].text,src[i].ink,src[i].up)!=(base[i].text,base[i].ink,base[i].up))...)
    println(stderr,"printed ",count(s->!isempty(s.text),src)," changes ",length(changes)," kept displays broken: ",join(sort!(collect(final)),","))
end
design(ARGS[1],ARGS[2],[parse(Int,x) for x in ARGS[3:end]])
