#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Staged chains: calendar months, distinct consecutive configuration pairs, new pairs, February/Sunday/28 months per stage.
# Configuration = (month, weekday of the 1st, month length); Gregorian calendar; no month is skipped. Julia only (UNKNOWN as evidence).
# Usage: julia --startup-file=no stage_pairs.jl > stage-pairs.tsv
using Dates
ckey(y,m)=(m,Dates.dayofweek(Date(y,m,1)),Dates.daysinmonth(Date(y,m,1)))
const FEB=(2,7,28)
const STAGES=[("1",(1980,1),(2050,1)),("2",(1950,1),(1980,1)),("3",(1900,1),(1950,1)),("4",(2050,1),(2100,1))]
months(a,b)=[(y,m) for y in a[1]:b[1] for m in 1:12 if a<=(y,m)<=b]
function stage_table()
    io=IOBuffer();seen=Set{Tuple{Tuple,Tuple}}();cm=0
    println(io,"stage\tfrom\tto\tmonths\tpairs\tnew_pairs\tfeb_sun28_months\tpairs_with_feb_sun28\tcumulative_months\tcumulative_pairs")
    allp=Set{Tuple{Tuple,Tuple}}()
    for (nm,a,b) in STAGES
        ms=months(a,b);ps=Set((ckey(ms[i]...),ckey(ms[i+1]...)) for i in 1:length(ms)-1)
        new=setdiff(ps,seen);union!(seen,ps);cm+=length(ms)
        println(io,join((nm,string(a[1],'-',lpad(a[2],2,'0')),string(b[1],'-',lpad(b[2],2,'0')),length(ms),length(ps),length(new),
            count(ym->ckey(ym...)==FEB,ms),count(p->FEB in p,ps),cm,length(seen)),'\t'))
    end
    println(io,"all\t1900-01\t2100-01\t",length(months((1900,1),(2100,1))),'\t',length(Set((ckey(a...),ckey(b...)) for (a,b) in zip(months((1900,1),(2100,1))[1:end-1],months((1900,1),(2100,1))[2:end]))),"\t\t",
        count(ym->ckey(ym...)==FEB,months((1900,1),(2100,1))),'\t',count(p->FEB in p,seen),'\t',cm,'\t',length(seen))
    String(take!(io))
end
abspath(PROGRAM_FILE)==(@__FILE__) && print(stage_table())
