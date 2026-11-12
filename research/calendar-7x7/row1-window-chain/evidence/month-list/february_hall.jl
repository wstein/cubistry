#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# february_hall.jl LAYOUT PRINT YYYY-MM ... : per month the smallest number of wrong front cells over all states of the print
# (cells minus the maximum whole-body matching per body class) with the Hall witness: for each deficient class the alternating-path
# set X (cells) with its neighbor bodies N(X), |X|-|N(X)| = deficiency. A month may be given as YYYY-MM@R,C: for a class of deficiency 1 the wrong
# cell is then R,C (it must be inside X) instead of the cell the matching leaves open; chain_hall_check verifies the table row either way. Output is chain format (wrong / hall lines) plus a summary
# row; the witness is checked by chain_hall_check of check.jl (Julia only; no Flix check of these rows, so the numbers are UNKNOWN
# as proofs until the Flix and independent checkers have read them from a chain).
include(joinpath(@__DIR__,"..","..","check.jl"))
layout,printp=ARGS[1:2];labels=coupled_labels(read(layout,String));source=window_read_print(printp)
homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
println("month\tclass\tdeficiency\twrong_cells\thall_cells\tneighbor_bodies")
for t0 in ARGS[3:end]
    t,pref=occursin('@',t0) ? String.(split(t0,'@')) : (t0,"");prefc=isempty(pref) ? nothing : Tuple(parse.(Int,split(pref,',')))
    y,m=parse.(Int,split(t,'-'));g=coupled_month_goal(labels,y,m);gb=g.board
    wrong=Tuple{Int,Int}[];halls=Vector{Tuple{Int,Int}}[];rows=String[]
    for key in sort!(unique(bodykey(h) for h in homes))
        hs=[h for h in homes if bodykey(h)==key];cells=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==key]
        isempty(cells) && continue
        opt=[[!isempty(window_piece_options(byhome[h],h,(c-4,4-r,3),gb[r,c])) for h in hs] for (r,c) in cells]
        owner=zeros(Int,length(hs));matchof=zeros(Int,length(cells))
        function aug(i,seen)
            for j in eachindex(hs)
                (seen[j] || !opt[i][j]) && continue;seen[j]=true
                if owner[j]==0 || aug(owner[j],seen);owner[j]=i;return true;end
            end
            false
        end
        for i in eachindex(cells);aug(i,falses(length(hs)));end
        matched=Set(owner[j] for j in eachindex(hs) if owner[j]!=0)
        un=[i for i in eachindex(cells) if !(i in matched)];isempty(un) && continue
        xs=Set(un);ns=Set{Int}();todo=copy(un)
        while !isempty(todo)
            i=pop!(todo)
            for j in eachindex(hs);opt[i][j] || continue;push!(ns,j)
                if owner[j]!=0 && !(owner[j] in xs);push!(xs,owner[j]);push!(todo,owner[j]);end
            end
        end
        X=sort([cells[i] for i in xs],by=rc->rc[1]*7+rc[2]);W=sort([cells[i] for i in un],by=rc->rc[1]*7+rc[2])
        if !isnothing(prefc)
            (length(W)==1 && prefc in X) || error("preferred wrong cell $prefc needs a class of deficiency 1 whose Hall set contains it")
            W=[prefc]
        end
        append!(wrong,W);push!(halls,X)
        println(t,'\t',join(key,','),'\t',length(un),'\t',join(["$r,$c" for (r,c) in W],';'),'\t',join(["$r,$c" for (r,c) in X],';'),'\t',length(ns))
    end
    sort!(wrong,by=rc->rc[1]*7+rc[2])
    isempty(wrong) ? println(t,"\t-\t0\t\t\t0") : chain_hall_check(source,gb,wrong,halls)
    println("#total\t",t,'\t',length(wrong))
end
