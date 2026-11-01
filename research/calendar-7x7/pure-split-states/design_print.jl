#!/usr/bin/env julia
# UNTRUSTED print designer (the checkers decide). Starting from the PR #99 print it
# reprints, orbit by orbit, the surfaces whose artwork scheme A no longer needs (and
# spare blanks) with the missing classes. Among all assignments it keeps one under
# which every scheme-A display still has a cubie-level front matching (two stickers on
# one cubie cannot serve two cells at once), breaking as few still-valid PR #99 states
# as possible, protected displays first.
# Usage: design_print.jl DAG OUT_PRINT [protected display ids...] > changes.tsv
include(joinpath(@__DIR__,"pure_common.jl"))

function unmatched_cells(source,board,keys_)
    byhome=Dict(h=>filter(s->s.home==h,source) for h in all_homes());bad=0
    for key in keys_
        hs=sort!([h for h in all_homes() if bodykey(h)==key])
        cells=[(r,c) for r in 1:7,c in 1:7 if bodykey((c-4,4-r,3))==key]
        opts=[[!isempty(piece_options(byhome[h],h,(c-4,4-r,3),board[r,c])) for h in hs] for (r,c) in cells]
        occ=zeros(Int,length(hs))
        function aug(i,seen)
            for j in eachindex(hs)
                (seen[j] || !opts[i][j]) && continue
                seen[j]=true
                if occ[j]==0 || aug(occ[j],seen);occ[j]=i;return true;end
            end
            false
        end
        for i in eachindex(cells);aug(i,falses(length(hs))) || (bad+=1);end
    end
    bad
end
function printed_as(s,a,k)
    a[3]=="blank" && return merge(s,(text="",ink="blank"))
    cell=first((r,c) for r in 1:7,c in 1:7 if orbit(r,c)==k && (b=artwork(a[1],a[3],r,c);(b[1],string(b[2]),b[3]))==a)
    pos=(cell[2]-4,4-cell[1],3)
    rot=first(rr for rr in ROTATIONS if rotate(s.home,rr)==pos && rotate(s.normal,rr)==FRONT_NORMAL)
    glyph=a[3]=="month" && a[1]=="0" ? "O" : a[1]   # the class key uses the O/0 alias
    merge(s,(text=glyph,ink=a[3],up=inverse_rotate(IMAGE_UPS[1],rot)))
end
function injections(cands,m)
    m==0 && return [Int[]]
    out=Vector{Int}[]
    for (i,c) in enumerate(cands),rest in injections(cands[[j for j in eachindex(cands) if j!=i]],m-1)
        push!(out,vcat(c,rest))
    end
    out
end
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
