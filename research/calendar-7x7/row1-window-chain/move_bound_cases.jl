#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Chains around the move-count bound MAX_CHAIN_MOVES (1000000) of the three window-chain checkers; written for check_move_bound.sh.
# Input: the stored 20-edge chain evidence/moves.tsv (chain.v1). Output directory OUT gets:
#   start-accept.tsv   chain.v3, free start of 100001 moves (the old limit + 1) that net to the identity pose, the stored edges unchanged
#   total-accept.tsv   chain.v1, 100001 edge moves in total (the old limit + 1): edge 1 carries net-identity padding, its HTM and QTM are raised to match
#   start-reject.tsv   chain.v3, start block declaring 1000001 moves (the new limit + 1)
#   total-reject.tsv   chain.v1, 1000001 edge moves in total (edges 1 and 2 padded; metrics are not adjusted, the bound fires first)
# Padding words: (1,1),(1,-1) and (1,1),(1,1),(1,2) both net to the identity.
function main(src,out)
    L=readlines(src);@assert L[1]=="cubistry.calendar7.chain.v1" && L[end]=="finish"
    nmoves=count(l->startswith(l,"move\t"),L)
    function pad(n)
        @assert n>=0 && n!=1 "padding length"
        w=String[]
        if isodd(n);append!(w,["move\t1\t1","move\t1\t1","move\t1\t2"]);n-=3;end
        for _ in 1:div(n,2);append!(w,["move\t1\t1","move\t1\t-1"]);end
        w
    end
    mkpath(out)
    put(name,lines)=write(joinpath(out,name),join(lines,'\n')*"\n")
    v3(start)=vcat(["cubistry.calendar7.chain.v3",L[2],"start\t$(length(start))"],start,L[3:end])
    # padded edge i: n extra moves inserted before its "end" line; with adjust, HTM and QTM of the record grow by the padding (all padding moves are HTM-1 slice moves; the exponent 2 counts 2 QTM)
    function padded(extra,adjust)    # extra: Dict edge number => n
        res=String[];k=0;i=1
        while i<=length(L)
            l=L[i]
            if startswith(l,"edge\t");k+=1
                n=get(extra,k,0);f=split(l,'\t')
                if n>0;wd=pad(n);if adjust;f[4]=string(parse(Int,f[4])+n);f[5]=string(parse(Int,f[5])+sum(abs(parse(Int,split(m,'\t')[3])) for m in wd));l=join(f,'\t');end;ins=wd;else ins=String[];end
                push!(res,l);j=i+1
                while L[j]!="end";push!(res,L[j]);j+=1;end
                append!(res,ins);i=j;continue
            end
            push!(res,l);i+=1
        end;res
    end
    put("start-accept.tsv",v3(pad(100001)))
    put("start-reject.tsv",["cubistry.calendar7.chain.v3",L[2],"start\t1000001","finish"])
    put("total-accept.tsv",padded(Dict(1=>100001-nmoves),true))
    half=div(1000001-nmoves,2)
    put("total-reject.tsv",padded(Dict(1=>half,2=>1000001-nmoves-half),false))
end
main(ARGS[1],ARGS[2])
