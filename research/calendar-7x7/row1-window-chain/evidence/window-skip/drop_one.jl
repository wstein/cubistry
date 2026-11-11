#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# drop_one.jl LAYOUT GAPMONTH[,..] : S=all valid months 2026-01..2050-01 except the listed gaps.
# For each gap month m and each single month x in S: corner demand and lemma of (S minus x) plus m.
# Necessary condition only: lemma-not-UNSAT does NOT mean a print exists. Julia only.
include(joinpath(@__DIR__,"months.jl"))
function run(layout,gaps)
    labels=coupled_labels(read(layout,String))
    allm=[(2026+(i-1)÷12,(i-1)%12+1) for i in 1:289]
    corner(y,m)=begin b=stacked_board(y,m,PURE_VARIANT);for c in 1:7;t=labels[m][c];b[1,c]=(t,isempty(t) ? "band" : "month");end
        [coupled_art(b[r,c]...,r,c) for (r,c) in COUPLED_CELLS] end
    per=Dict(ym=>corner(ym...) for ym in allm)
    function dem(ms)
        xs=[per[ym] for ym in ms];cl=sort!(unique(vcat(xs...)))
        pk=Dict(a=>maximum(count(==(a),x) for x in xs) for a in cl);req=sum(values(pk))
        an=[a for a in cl if pk[a]==1 && all(count(==(a),x)==1 for x in xs)]
        (req,any(corner_anchor_contradiction(req,8,3,pk[a],count(x->a in x,xs),length(xs)) for a in an))
    end
    S=[ym for ym in allm if !(ym in gaps)]
    println("S_valid\t",length(S),"\tdemand_lemma\t",dem(S))
    for g in gaps
        r0=dem(vcat(S,[g]));println("gap\t",g,"\tS+gap\t",r0)
        ok=[]
        for x in S;r=dem(vcat([y for y in S if y!=x],[g]));(r[1]<=23 && !r[2]) && push!(ok,x);end
        println("gap\t",g,"\tsingle_drops_with_demand<=23\t",length(ok),"\t",join([string(y,'-',lpad(m,2,'0')) for (y,m) in ok]," "))
    end
end
parse_ym(s)=((y,m)=parse.(Int,split(s,'-'));(y,m))
run(ARGS[1],[parse_ym(s) for s in split(ARGS[2],',')])
