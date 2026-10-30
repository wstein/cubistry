#!/usr/bin/env julia
# Independent necessary wing-pair bound. No solver and no borrowed SAT encoding.
using Dates
include(joinpath(@__DIR__,"geometry_audit.jl"))
const Glyph = Tuple{String,Int,String}
const HALFTURN=Dict('0'=>'0','1'=>'1','2'=>'2','5'=>'5','6'=>'9','9'=>'6','8'=>'8',
    'H'=>'H','N'=>'N','S'=>'S','X'=>'X','Z'=>'Z')
const MONTHWORDS=Dict("DE"=>["JAN","FEB","MÄR","APR","MAI","JUN","JUL","AUG","SEP","OKT","NOV","DEZ"],
    "EN"=>["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"])
const DOWWORDS=Dict("DE"=>["MON","DIE","MIT","DON","FRE","SAM","SON"],
    "EN"=>["SUN","MON","TUE","WED","THU","FRI","SAT"])
function canonical_glyph(g,ink,row,col)::Glyph
    isempty(g) && return ("",0,"blank")
    p=(col-4,4-row,3);normal=(0,0,1);up=(0,1,0)
    k=surfacekey(p,normal)
    r=only([r for r in ROTATIONS if rotate(normal,r)==normal && rotate(p,r)==(k[1],k[2],3)])
    u=rotate(up,r)
    angle=findfirst(==(u),[(0,1,0),(-1,0,0),(0,-1,0),(1,0,0)])-1
    g=replace(g,'O'=>'0','I'=>'1')
    g=="0" && return (g,0,ink)
    candidates=[(g,angle,ink)]
    if all(c->haskey(HALFTURN,c),g)
        h=join(HALFTURN[c] for c in reverse(g))
        push!(candidates,(h,mod(angle+2,4),ink))
    end
    minimum(candidates)
end

function target_front(lang,y,m)
    weekend(c)=lang=="DE" ? c>=6 : c==1 || c==7
    front=fill(("","blank"),7,7)
    for c in 1:7
        front[2,c]=(DOWWORDS[lang][c],weekend(c) ? "red" : "weekday")
    end
    start=m<=9 ? 5 : 1
    for (i,g) in enumerate(MONTHWORDS[lang][m])
        front[1,start+i-1]=(string(g),"month")
    end
    monday=dayofweek(Date(y,m,1))-1
    offset=lang=="DE" ? monday : mod(monday+1,7)
    for day in 1:daysinmonth(Date(y,m,1))
        cell=offset+day-1;week=div(cell,7);col=mod(cell,7)+1
        row=week==5 ? 3 : week+3
        @assert isempty(front[row,col][1])
        front[row,col]=(string(day)*(week==5 ? "↶" : ""),weekend(col) ? "red" : "dark")
    end
    front
end

function projected_inventory(lang;last=2099)
    keys=((-3,-1),(-3,1))
    classes=[Glyph[] for _ in keys]
    raw=[]
    for y in 2026:last,m in 1:12
        front=target_front(lang,y,m)
        counts=[Dict{Glyph,Int}() for _ in keys]
        for r in 1:7,c in 1:7
            k=surfacekey((c-4,4-r,3),(0,0,1));i=findfirst(==(k),keys)
            isnothing(i) && continue
            g,ink=front[r,c];a=canonical_glyph(g,ink,r,c)
            counts[i][a]=get(counts[i],a,0)+1
            push!(classes[i],a)
        end
        push!(raw,counts)
    end
    classes=[sort!(unique(a)) for a in classes]
    ids=[Dict(a=>j for (j,a) in enumerate(cs)) for cs in classes]
    targets=unique([[ [get(counts[i],a,0) for a in classes[i]] for i in 1:2] for counts in raw])
    peaks=[[maximum(t[i][a] for t in targets) for a in eachindex(classes[i])] for i in 1:2]
    (;classes,ids,targets,peaks)
end

function maximum_pair_matching(left,right,forbidden)
    matched=zeros(Int,length(right))
    function augment(i,seen)
        for j in eachindex(right)
            seen[j] && continue
            forbidden[left[i],right[j]] && continue
            seen[j]=true
            if matched[j]==0 || augment(matched[j],seen)
                matched[j]=i;return true
            end
        end
        false
    end
    successes=count(i->augment(i,falses(length(right))),eachindex(left))
    reached_left=falses(length(left));reached_right=falses(length(right))
    matched_left=Set(filter(!iszero,matched))
    queue=[i for i in eachindex(left) if !(i in matched_left)]
    reached_left[queue].=true
    while !isempty(queue)
        i=popfirst!(queue)
        for j in eachindex(right)
            reached_right[j] && continue
            forbidden[left[i],right[j]] && continue
            reached_right[j]=true
            partner=matched[j]
            if partner!=0 && !reached_left[partner]
                reached_left[partner]=true;push!(queue,partner)
            end
        end
    end
    U=findall(reached_left);N=findall(reached_right)
    if successes<length(left)
        @assert length(U)>length(N)
        @assert all(forbidden[left[i],right[j]] for i in U for j in eachindex(right) if !(j in N))
    end
    (;successes,U,N,matched)
end

function hall_audit()
    for lang in ["DE","EN"]
        p=projected_inventory(lang)
        println("INVENTORY\t",lang,"\t",join(sum.(p.peaks),','),"\t",join(length.(p.classes),','))
        # This native certificate currently enumerates one extra left replica,
        # the actual EN slack; any larger slack must stay UNKNOWN.
        slack=24 .- sum.(p.peaks)
        @assert slack[2]==0 && slack[1] in (0,1)
        for extra in (slack[1]==0 ? [0] : collect(eachindex(p.classes[1])))
            inventory=deepcopy(p.peaks)
            extra!=0 && (inventory[1][extra]+=1)
            forbidden=falses(length(p.classes[1]),length(p.classes[2]))
            for t in p.targets,a in eachindex(p.classes[1]),b in eachindex(p.classes[2])
                if t[1][a]==inventory[1][a] && t[2][b]==inventory[2][b]
                    forbidden[a,b]=true
                end
            end
            left=vcat([fill(a,n) for (a,n) in enumerate(inventory[1])]...)
            right=vcat([fill(a,n) for (a,n) in enumerate(inventory[2])]...)
            result=maximum_pair_matching(left,right,forbidden)
            println("BRANCH\t",lang,"\t",extra,"\t",result.successes,"\t",
                join(result.U,','),"\t",join(result.N,','))
        end
    end
    println("UNKNOWN physical feasibility: a perfect compatibility matching is not SAT; deficiencies need independent certificate validation.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    hall_audit()
end
