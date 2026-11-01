#!/usr/bin/env julia
# Descriptive search, not a proof (Julia only): month-letter placements in row 1 for
# the pure split (row 18: F31=bfold,S30=bfold,S31=bfold) under the strict reading.
# The three letters of each month stay in three adjacent columns (start 1..5).
# Candidates found here are re-checked by both checkers' `inventory` command.
include(joinpath(@__DIR__,"stacked_common.jl"))
const PURE="F31=bfold,S30=bfold,S31=bfold"
const GOALS=stacked_goals(PURE)
const ROW1=sort!(unique(orbit(1,c) for c in 1:7))
function demand_with(starts)
    res=Dict{Tuple{Int,Int},Tuple{Int,Int}}()
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        peak=Dict{Tuple{String,Int,String},Int}();blanks=0
        for t in GOALS
            counts=Dict{Tuple{String,Int,String},Int}();z=0
            s=starts[t.month]
            for r in 1:7,c in 1:7
                orbit(r,c)==k || continue
                g,ink=r==1 ? (s<=c<=s+2 ? (string(MONTHS["EN"][t.month][c-s+1]),"month") : ("","blank")) : t.board[r,c]
                if isempty(g);z+=1;continue;end
                a=artwork(g,ink,r,c);counts[a]=get(counts,a,0)+1
            end
            for (a,v) in counts;peak[a]=max(get(peak,a,0),v);end
            blanks=max(blanks,z)
        end
        res[k]=(sum(values(peak);init=0),blanks)
    end
    res
end
slack(res)=Dict(k=>capacity(k)-v[1]-v[2] for (k,v) in res)
feasible(res)=all(v>=0 for v in values(slack(res)))
total(res)=sum(v[1] for v in values(res))
hstring(starts)="H="*join(starts)
function report(label,schemes)
    found=0;best=nothing
    for st in schemes
        r=demand_with(st)
        if feasible(r)
            found+=1
            sl=slack(r)
            (isnothing(best) || total(r)<best[2]) && (best=(st,total(r)))
            found<=40 && println("feasible\t",label,'\t',hstring(st),"\tbound=",total(r),"\t",join(["$(k):$(sl[k])" for k in ROW1],' '))
        end
    end
    println("summary\t",label,"\tschemes=",length(schemes),"\tfeasible=",found,isnothing(best) ? "" : "\tbest-bound=$(best[2])")
end
println("# descriptive search, not a proof; Julia only; row-1 orbits ",ROW1)
let r=demand_with([m<=9 ? 5 : 1 for m in 1:12]);println("pr99-placement\tbound=",total(r),"\tfeasible=",feasible(r));end
report("uniform",[fill(s,12) for s in 1:5])
report("two-blocks(Jan-Sep,Oct-Dec)",[vcat(fill(a,9),fill(b,3)) for a in 1:5 for b in 1:5])
report("half-years",[vcat(fill(a,6),fill(b,6)) for a in 1:5 for b in 1:5])
report("quarters",[vcat(fill(a,3),fill(b,3),fill(c,3),fill(d,3)) for a in 1:5 for b in 1:5 for c in 1:5 for d in 1:5])
report("month-pairs",[vcat([fill(x,2) for x in t]...) for t in Iterators.product(ntuple(_->1:5,6)...)])
# Lowest bounds among month-pair schemes (pairs Jan/Feb, Mar/Apr, ...), all listed.
let rows=Any[]
    for t in Iterators.product(ntuple(_->1:5,6)...)
        st=vcat([fill(x,2) for x in t]...);r=demand_with(st)
        feasible(r) && push!(rows,(total(r),hstring(st),slack(r)))
    end
    sort!(rows;by=x->(x[1],x[2]))
    for (b,h,sl) in rows
        b<=239 || break
        println("lowest\tmonth-pairs\t",h,"\tbound=",b,"\t",join(["$(k):$(sl[k])" for k in sort!(collect(keys(sl)))],' '))
    end
end
# Per-month local search (coordinate descent from every feasible quarter scheme and
# the PR #99 placement): a search result, not a proven optimum.
let best=Dict{String,Int}()
    starts=vcat([[m<=9 ? 5 : 1 for m in 1:12]],[vcat(fill(a,3),fill(b,3),fill(c,3),fill(d,3)) for a in 1:5 for b in 1:5 for c in 1:5 for d in 1:5])
    score(st)=(r=demand_with(st);feasible(r) ? total(r) : 10_000+sum(max(0,-v) for v in values(slack(r))))
    for st0 in starts
        st=copy(st0);cur=score(st);improved=true
        while improved
            improved=false
            for m in 1:12,s in 1:5
                s==st[m] && continue
                t=copy(st);t[m]=s;v=score(t)
                if v<cur;st=t;cur=v;improved=true;end
            end
        end
        cur<10_000 && (best[hstring(st)]=cur)
    end
    lo=minimum(values(best))
    for (h,v) in sort!(collect(best);by=x->(x[2],x[1]))
        v<=lo+1 && println("localsearch\t",h,"\tbound=",v)
    end
    println("localsearch-summary\tdistinct-local-optima=",length(best),"\tbest-bound=",lo)
end
