# Adjacent-month fill for the English 7x7 calendar (research only, static capacity).
# Display sets: leading cells blank or filled with the previous month's last days,
# trailing cells blank or filled with the next month's first days, and six-week
# months either with the PR #99 overflow marks or as two displays (early: weeks 1-5,
# late: weeks 2-6). Reuses the stacked study (PR #145) and the PR #99 artwork rules.
include(joinpath(@__DIR__,"..","dual-stacked","stacked_common.jl"))

const ADJ_KEYS=("lead","trail","six")
const ADJ_CHOICES=Dict("lead"=>("blank","prev"),"trail"=>("blank","next"),"six"=>("overflow","earlylate"))
const ADJ_BASELINE="lead=blank,trail=blank,six=overflow"
function parse_adjacent(spec)
    parts=split(spec,',')
    @assert length(parts)==3 "display set needs lead=..,trail=..,six=.."
    out=Dict{String,String}()
    for (i,part) in enumerate(parts)
        kv=split(part,'=')
        @assert length(kv)==2 && kv[1]==ADJ_KEYS[i] "unknown or misplaced display-set key '$(kv[1])'"
        @assert kv[2] in ADJ_CHOICES[kv[1]] "unknown choice '$(kv[2])' for $(kv[1])"
        out[String(kv[1])]=String(kv[2])
    end
    @assert !(out["lead"]=="prev" && out["six"]=="overflow") "incoherent: overflow marks need empty row-3 cells, so they cannot be combined with lead=prev"
    out
end
all_adjacent()=["lead=$a,trail=$b,six=$c" for a in ADJ_CHOICES["lead"] for b in ADJ_CHOICES["trail"] for c in ADJ_CHOICES["six"]]
coherent(spec)=!(occursin("lead=prev",spec) && occursin("six=overflow",spec))
prev_length(y,m)=m==1 ? 31 : daysinmonth(Date(y,m-1,1))

# One display: rows 1-2 as PR #99; rows 3-7 from a continuous day sequence starting
# at week `first_week` (0 = week 1). Day k<1 is the previous month's (prev+k), day
# k>n is the next month's (k-n); either may be left blank.
function adjacent_board(y,m,spec,phase)
    o=parse_adjacent(spec);a=wrapped_board(y,m)
    off=offset(y,m,"EN");n=daysinmonth(Date(y,m,1));six=div(off+n-1,7)+1==6
    six && o["six"]=="overflow" && return a
    first_week=phase==:late ? 1 : 0
    for idx in 0:34
        r=3+div(idx,7);c=mod(idx,7)+1;k=7*first_week+idx-off+1;ink=red_column(c) ? "red" : "dark"
        a[r,c]=1<=k<=n ? (string(k),ink) :
               k<1 ? (o["lead"]=="prev" ? (string(prev_length(y,m)+k),ink) : ("","blank")) :
                     (o["trail"]=="next" ? (string(k-n),ink) : ("","blank"))
    end
    a
end
function adjacent_displays(spec)
    o=parse_adjacent(spec);seen=Dict{String,Int}();boards=Any[];months=0;extra=0
    for y in 2026:2099,m in 1:12
        months+=1
        off=offset(y,m,"EN");n=daysinmonth(Date(y,m,1));six=div(off+n-1,7)+1==6
        phases=six && o["six"]=="earlylate" ? (:early,:late) : (:single,)
        length(phases)==2 && (extra+=1)
        for ph in phases
            b=adjacent_board(y,m,spec,ph);key=join(string.(b),"|")
            haskey(seen,key) || (seen[key]=length(boards)+1;push!(boards,b))
        end
    end
    @assert months==888
    old=Set(join(string.(t.board),"|") for t in physical_targets("EN"))
    unchanged=count(b->join(string.(b),"|") in old,boards)
    (;boards,unchanged,extra)
end
function adjacent_orbits(boards)
    res=Dict{Tuple{Int,Int},Any}()
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        peak=Dict{Tuple{String,Int,String},Int}();blanks=0
        for b in boards
            counts=Dict{Tuple{String,Int,String},Int}();z=0
            for r in 1:7,c in 1:7
                orbit(r,c)==k || continue
                g,ink=b[r,c]
                if isempty(g);z+=1;continue;end
                a=artwork(g,ink,r,c);counts[a]=get(counts,a,0)+1
            end
            for (a,v) in counts;peak[a]=max(get(peak,a,0),v);end
            blanks=max(blanks,z)
        end
        res[k]=(peak=peak,blanks=blanks)
    end
    res
end
function adjacent_inventory(spec;base=nothing)
    d=adjacent_displays(spec);res=adjacent_orbits(d.boards)
    base=something(base,adjacent_orbits(adjacent_displays(ADJ_BASELINE).boards))
    println("adjacent-displays\t",spec,'\t',length(d.boards),'\t',d.unchanged,'\t',length(d.boards)-d.unchanged,'\t',d.extra)
    total=0;over=String[]
    for k in sort!(collect(keys(res)))
        need=sum(values(res[k].peak);init=0);slack=capacity(k)-need-res[k].blanks;total+=need
        slack<0 && push!(over,"($(k[1]),$(k[2]))")
        println("adjacent-orbit\t",spec,'\t',k[1],'\t',k[2],'\t',need,'\t',res[k].blanks,'\t',capacity(k),'\t',slack)
        for a in sort!(collect(keys(res[k].peak)))
            haskey(base[k].peak,a) && continue
            println("adjacent-newclass\t",spec,'\t',k[1],'\t',k[2],'\t',a[1],'\t',a[2],'\t',a[3],'\t',res[k].peak[a])
        end
        for a in sort!(collect(keys(base[k].peak)))
            haskey(res[k].peak,a) && continue
            println("adjacent-goneclass\t",spec,'\t',k[1],'\t',k[2],'\t',a[1],'\t',a[2],'\t',a[3])
        end
    end
    println("adjacent-inventory\t",spec,'\t',total,'\t',isempty(over) ? "NOT_OBSTRUCTED" : "OBSTRUCTED",'\t',length(over),'\t',isempty(over) ? "-" : join(over," "))
end
function adjacent_matrix()
    base=adjacent_orbits(adjacent_displays(ADJ_BASELINE).boards)
    for spec in all_adjacent()
        coherent(spec) || (println("adjacent-incoherent\t",spec,"\toverflow marks need empty row-3 cells");continue)
        adjacent_inventory(spec;base)
    end
end
