#!/usr/bin/env julia
# Descriptive check, not a proof (Julia only): for every scheme-A display, is there a
# cubie-level front matching under the given print? Two stickers on one cubie cannot
# serve two front cells at once; a display without a matching has no legal state.
include(joinpath(@__DIR__,"pure_common.jl"))
function unmatched(source,board)
    byhome=Dict(h=>filter(s->s.home==h,source) for h in all_homes());bad=Tuple{Int,Int}[]
    for key in unique(bodykey(h) for h in all_homes())
        hs=sort!([h for h in keys(byhome) if bodykey(h)==key])
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
        for i in eachindex(cells);aug(i,falses(length(hs))) || push!(bad,cells[i]);end
    end
    bad
end
goals=stacked_goals(PURE_VARIANT)
for p in ARGS
    src=read_physical(p);n=0
    for (id,g) in enumerate(goals)
        u=unmatched(src,g.board);isempty(u) && continue
        n+=1;println(basename(p),"\t",id,"\t",g.year,"-",g.month,"\t",join(["$(r),$(c)" for (r,c) in u]," "))
    end
    println(basename(p),"\tunmatchable displays: ",n)
end
