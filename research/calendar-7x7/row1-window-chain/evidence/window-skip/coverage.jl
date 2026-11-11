#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# coverage.jl MONTHS_TXT STATUS_TSV : recompute runs and gaps from the month list alone.
# MONTHS_TXT: comma or newline separated YYYY-MM (valid months). STATUS_TSV: month<TAB>status<TAB>evidence
# for gap months (a gap without a row is reported as unknown). Range: 2026-01 .. 2050-01.
const FIRST=(2026,1);const LAST=(2050,1);const ROOT=(2026,5)
idx(y,m)=(y-2026)*12+m               # 2026-01 -> 1
ym(i)=(2026+(i-1)÷12,(i-1)%12+1)
fmt(i)=(t=ym(i);string(t[1],'-',lpad(t[2],2,'0')))
function parse_list(s)
    xs=Int[];for t in split(s,r"[,\s]+";keepempty=false)
        m=match(r"^(\d{4})-(\d{2})\z",t);@assert !isnothing(m) "month is YYYY-MM"
        y,mo=parse.(Int,m.captures);i=idx(y,mo);@assert 1<=mo<=12 && 1<=i<=idx(LAST...) "month in range"
        push!(xs,i)
    end
    @assert length(unique(xs))==length(xs) "distinct months";sort!(xs)
end
# The chain root is the identity pose, May 2026: months before it are not chain members. Runs and
# gaps are computed on 2026-05 .. 2050-01 only; earlier months are reported as `before_root`.
function runs_and_gaps(valid)
    r0=idx(ROOT...);chain=[i for i in valid if i>=r0]
    runs=Tuple{Int,Int}[];s=nothing;p=nothing
    for i in chain
        if p===nothing || i!=p+1;s!==nothing && push!(runs,(s,p));s=i;end
        p=i
    end
    s!==nothing && push!(runs,(s,p))
    all=Set(chain);gaps=[i for i in r0:idx(LAST...) if !(i in all)]
    runs,gaps
end
before_root(valid)=[(i,i in Set(valid)) for i in 1:idx(ROOT...)-1]
function headline(runs)
    r=[x for x in runs if x[1]<=idx(ROOT...)<=x[2]]
    isempty(r) ? "gapless: none (root month 2026-05 not valid)" : string("gapless: ",fmt(r[1][1])," .. ",fmt(r[1][2])," (",r[1][2]-r[1][1]+1," months)")
end
function report(io,valid,status)
    runs,gaps=runs_and_gaps(valid);chain=[i for i in valid if i>=idx(ROOT...)]
    println(io,headline(runs))
    println(io,"chain_members\t",length(chain),"\tgaps\t",length(gaps),"\truns\t",length(runs),"\tbefore_root_front_matching\t",count(last,before_root(valid)))
    println(io,"kind\tfrom\tto\tcount\tstatus\tevidence")
    for (a,b) in runs;println(io,"run\t",fmt(a),'\t',fmt(b),'\t',b-a+1,"\t\t");end
    for g in gaps
        st,ev=get(status,fmt(g),("unknown (not tested)",""))
        println(io,"gap\t",fmt(g),'\t',fmt(g),"\t1\t",st,'\t',ev)
    end
    for (i,ok) in before_root(valid)
        st,ev=get(status,fmt(i),("",""))
        println(io,"before_root\t",fmt(i),'\t',fmt(i),"\t1\tnot a chain member (front_match=",ok ? "yes" : "no",")",isempty(st) ? "" : "; "*st,'\t',ev)
    end
    println(io,"chain_members_per_year\t",join([string(y,'=',count(i->ym(i)[1]==y,chain)) for y in 2026:2050]," "))
end
function read_status(path)
    d=Dict{String,Tuple{String,String}}()
    for l in readlines(path)[2:end];f=split(l,'\t');d[f[1]]=(f[2],length(f)>=3 ? f[3] : "");end
    d
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    valid=parse_list(read(ARGS[1],String));report(stdout,valid,length(ARGS)>=2 ? read_status(ARGS[2]) : Dict{String,Tuple{String,String}}())
end
