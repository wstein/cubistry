#!/usr/bin/env julia
# UNTRUSTED coupled redesign of the midge orbit (candidate generator only).
# Keeps the multiset of midge artwork classes of the input print (so the strict
# per-orbit supply is unchanged) and permutes which midge surface carries which class,
# by deterministic best-improvement swap search, until every scheme-A display has a
# cubie-level front matching in the midge orbit; among such prints it prefers fewer
# changed surfaces that still-valid PR #99 states show (protected displays first).
# Usage: redesign_midge.jl DAG IN_PRINT OUT_PRINT [protected display ids...]
include(joinpath(@__DIR__,"pure_common.jl"))
include(joinpath(@__DIR__,"design_lib.jl"))
function redesign(dag_path,in_print,out_print,protect)
    goals=stacked_goals(PURE_VARIANT);old=physical_targets("EN")
    src=[s for s in read_physical(in_print)];base=read_physical(PR99_PRINT)
    proof=replay_dag(dag_path)
    kept=[id for id in 1:91 if goals[id].board==old[id].board]
    shows=Dict{Int,Set{Int}}()
    for id in kept
        st=decode_physical(base,signed_perm(proof.registers,proof.targets[id]),proof.action)
        foreach(s->s.normal==FRONT_NORMAL && push!(get!(shows,s.id,Set{Int}()),id),st)
    end
    mid=bodykey((0,3,3));k=(-3,0)
    ids=[i for i in 1:294 if bodykey(src[i].home)==mid]
    cls=Dict(i=>surface_class(src[i])[2] for i in ids)
    bad(p)=sum(unmatched_cells(p,g.board,[mid]) for g in goals)
    function broken(p)
        b=Set{Int}()
        for i in 1:294
            (p[i].text,p[i].ink,p[i].up)==(base[i].text,base[i].ink,base[i].up) || union!(b,get(shows,i,Set{Int}()))
        end
        (length(intersect(b,protect)),length(b))
    end
    cost(p)=(bad(p),broken(p)...)
    cur=copy(src);c=cost(cur);println(stderr,"start cost ",c)
    while true
        best=nothing
        for x in 1:length(ids),y in x+1:length(ids)
            i,j=ids[x],ids[y];cls[i]==cls[j] && continue
            trial=copy(cur)
            trial[i]=printed_as(base[i],cls[j],k);trial[j]=printed_as(base[j],cls[i],k)
            # keep a surface's original frame when its class is unchanged from PR #99
            for (s,t) in ((i,cls[j]),(j,cls[i]))
                surface_class(base[s])[2]==t && (trial[s]=base[s])
            end
            tc=cost(trial)
            (tc<c && (isnothing(best) || tc<best[1])) && (best=(tc,trial,i,j))
        end
        isnothing(best) && break
        c,cur,i,j=best;cls[i],cls[j]=cls[j],cls[i]
        println(stderr,"swap ",i," ",j," cost ",c)
    end
    open(out_print,"w") do io
        println(io,"sticker\tpiece\thome\tnormal\tup\ttext\tink")
        for (i,s) in enumerate(cur);println(io,join([i,s.piece,join(s.home,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    end
    for i in ids
        (cur[i].text,cur[i].ink,cur[i].up)==(src[i].text,src[i].ink,src[i].up) && continue
        println(i,'\t',src[i].text,'/',src[i].ink,'\t',cur[i].text,'/',cur[i].ink,"\t(-3, 0)\tmidge-redesign")
    end
    println(stderr,"final cost ",c)
end
redesign(ARGS[1],ARGS[2],ARGS[3],[parse(Int,x) for x in ARGS[4:end]])
