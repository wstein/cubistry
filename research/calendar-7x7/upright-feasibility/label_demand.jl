#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Q1 at label level: every (text, ink) shown by the 91 pure-split-A displays, how many
# displays need it, its peak simultaneous count, and how many surfaces of the print carry
# exactly that artwork (any orientation). 9 may be served by a 6 sticker turned.
#   label_demand.jl PRINT
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
function main(path)
    source=read_physical(path);goals=stacked_goals(PURE_VARIANT)
    peak=Dict{Tuple{String,String},Int}();disp=Dict{Tuple{String,String},Int}()
    for g in goals
        cnt=Dict{Tuple{String,String},Int}()
        for r in 1:7,c in 1:7
            t,ink=g.board[r,c];isempty(t) && continue
            cnt[(t,ink)]=get(cnt,(t,ink),0)+1
        end
        for (k,n) in cnt;peak[k]=max(get(peak,k,0),n);disp[k]=get(disp,k,0)+1;end
    end
    have=Dict{Tuple{String,String},Int}()
    for s in source;isempty(s.text) && continue;have[(s.text,s.ink)]=get(have,(s.text,s.ink),0)+1;end
    println("label-header\ttext\tink\tdisplays\tpeak\tsurfaces_with_exact_artwork\tnote")
    for k in sort!(collect(keys(peak));by=k->(k[2],something(tryparse(Int,k[1]),0),k[1]))
        h=get(have,k,0);note=""
        if k[1]=="9";note=h==0 ? "no sticker: served by a turned 6 (owner rule)" : "";end
        h==0 && k[1]!="9" && (note="NO STICKER IN PRINT")
        println("label\t",k[1],'\t',k[2],'\t',disp[k],'\t',peak[k],'\t',h,'\t',note)
    end
end
main(ARGS[1])
