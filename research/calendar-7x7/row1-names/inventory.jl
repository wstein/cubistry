#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Necessary oriented face-tile inventory only; no print or legal-state claim.
include(joinpath(@__DIR__, "..", "pure-split-states", "pure_common.jl"))
include(joinpath(@__DIR__, "..", "upright-feasibility", "strict_rule.jl"))
apply_strict_rule!(Main)
function inventory(path, layout)
    raw=read(path,String)
    @assert endswith(raw,"\n") && !occursin('\r',raw) "canonical LF input"
    rows=split(chop(raw;tail=1),'\n');@assert length(rows)==13
    @assert rows[1]=="month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7"
    labels=Vector{Vector{String}}()
    for (m,line) in enumerate(rows[2:end])
        f=String.(split(line,'\t';keepempty=true))
        @assert length(f)==8 && f[1]==string(m) "one ordered row per month"
        @assert all(s->isempty(s)||occursin(r"^[A-Z]+$",s),f[2:8]) "uppercase labels only"
        @assert !isempty(f[2]) && all(isempty,f[5:8]) "names only in columns 1..3"
        push!(labels,f[2:8])
    end
    @assert layout in ("scheme-a","names")
    # Geometry and optical regressions prevent a text-only inventory quotient.
    @assert artwork("29","red",7,1)!=artwork("29","red",7,7)
    @assert artwork("O","month",1,1)!=artwork("0","month",1,1)
    @assert artwork("N","month",1,1)!=artwork("N","month",7,7)
    @assert artwork("O","month",1,1)!=artwork("O","month",7,7)
    @assert artwork("OC","month",1,1)!=artwork("OC","month",7,7)
    goals=stacked_goals(PURE_VARIANT)
    shapes=Set((g.month,offset(g.year,g.month,"EN"),daysinmonth(Date(g.year,g.month,1))) for g in goals)
    @assert length(shapes)==91
    @assert all((m,offset(y,m,"EN"),daysinmonth(Date(y,m,1))) in shapes for y in 1900:2099 for m in 1:12) "2400 months covered by the 91 display shapes"
    if layout=="names"
        goals=[(year=g.year,month=g.month,board=copy(g.board)) for g in goals]
        for g in goals,c in 1:7
            t=labels[g.month][c];g.board[1,c]=(t,isempty(t) ? "blank" : "month")
        end
    end
    @assert length(goals)==91 && length(unique(join(string.(g.board),"|") for g in goals))==91
    println("input\t",bytes2hex(sha256(codeunits(raw))),"\t",layout,"\tstrict\t91\t1900-01\t2099-12\t2400")
    over=0
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        peak=Dict{Tuple{String,Int,String},Int}()
        for g in goals
            counts=Dict{Tuple{String,Int,String},Int}()
            for r in 1:7,c in 1:7
                orbit(r,c)==k || continue
                text,ink=g.board[r,c]
                a=isempty(text) ? ("",0,"blank") : artwork(text,ink,r,c)
                counts[a]=get(counts,a,0)+1
            end
            for (a,n) in counts;peak[a]=max(get(peak,a,0),n);end
        end
        blank=get(peak,("",0,"blank"),0)
        printed=sum(n for (a,n) in peak if a[1]!="";init=0)
        cap=capacity(k);reserve=cap-printed-blank;over+=reserve<0
        println("orbit\t",k[1],'\t',k[2],'\t',printed,'\t',blank,'\t',cap,'\t',reserve)
        for a in sort!(collect(keys(peak)))
            println("class\t",k[1],'\t',k[2],'\t',join(a,'\t'),'\t',peak[a])
        end
    end
    println("inventory\t",over==0 ? "NOT_OBSTRUCTED" : "OBSTRUCTED",'\t',over,"\tphysical=UNKNOWN")
end
try
    @assert length(ARGS)==2 "inventory.jl LAYOUT_TSV scheme-a|names"
    inventory(ARGS...)
catch e
    println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
end
