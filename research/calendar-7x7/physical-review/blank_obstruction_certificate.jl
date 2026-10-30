#!/usr/bin/env julia
# Exact finite certificate for a necessary DE wing-pair obstruction.
# No SAT solver, Python proof authority, or imported root target generator.
using SHA
include(joinpath(@__DIR__,"peak_hall_audit.jl"))

function concrete_counts(profile,y,m)
    front=target_front("DE",y,m)
    counts=[zeros(Int,length(c)) for c in profile.classes]
    for r in 1:7,c in 1:7
        k=surfacekey((c-4,4-r,3),(0,0,1))
        side=findfirst(==(k),((-3,-1),(-3,1)))
        isnothing(side) && continue
        g,ink=front[r,c]
        id=profile.ids[side][canonical_glyph(g,ink,r,c)]
        counts[side][id]+=1
    end
    counts
end

function derive_blank_obstruction(;last=2099)
    p=projected_inventory("DE";last)
    blankA=only(findall(==(("",0,"blank")),p.classes[1]))
    bb=only(findall(==(("",0,"blank")),p.classes[2]))
    @assert sum.(p.peaks)==[24,24]
    @assert p.peaks[1][blankA]==2 && p.peaks[2][bb]==2
    @assert all(n==1 for (i,n) in enumerate(p.peaks[1]) if i!=blankA)
    @assert all(n==1 for (i,n) in enumerate(p.peaks[2]) if i!=bb)
    witnesses=Dict{Int,Tuple{Int,Int}}()
    for y in 2026:last,m in 1:12
        counts=concrete_counts(p,y,m)
        counts[2][bb]==2 || continue
        for id in eachindex(p.classes[1])
            counts[1][id]==p.peaks[1][id] && get!(witnesses,id,(y,m))
        end
    end
    allowed=[id for id in eachindex(p.classes[1]) if !haskey(witnesses,id)]
    @assert Set(p.classes[1][allowed])==Set([("1",0,"red"),("27",3,"dark"),("6",2,"dark")])
    # All opposite A-stickers that could share a cubie with B-blank are needed
    # simultaneously, yet B-blank is also needed. No cubie can fill both slots.
    obstruction=concrete_counts(p,2026,11)
    @assert obstruction[2][bb]==1
    @assert all(obstruction[1][id]==p.peaks[1][id] for id in allowed)
    io=IOBuffer()
    println(io,"cubistry.calendar7.blank-obstruction.v1")
    println(io,"scope\tDE\t2026\t",last,"\t555555555111\tmarked-overflow\tno-year")
    println(io,"coupling\tA\t-3\t-1\tB\t-3\t1\t24")
    for side in 1:2
        tag=side==1 ? "A" : "B"
        println(io,"inventory\t",tag,"\t",sum(p.peaks[side]),"\t",length(p.classes[side]))
        for (id,(g,q,ink)) in enumerate(p.classes[side])
            println(io,join(["class",tag,id,g,q,ink,p.peaks[side][id]],'\t'))
        end
    end
    for id in eachindex(p.classes[1])
        if haskey(witnesses,id)
            y,m=witnesses[id]
            println(io,join(["excluded-partner",id,y,m,p.peaks[1][id],2],'\t'))
        else
            println(io,"allowed-partner\t",id)
        end
    end
    println(io,"obstruction\t2026\t11\t",bb,"\t",obstruction[2][bb])
    front=target_front("DE",2026,11)
    for r in 1:7,c in 1:7
        k=surfacekey((c-4,4-r,3),(0,0,1))
        side=findfirst(==(k),((-3,-1),(-3,1)))
        isnothing(side) && continue
        g,ink=front[r,c]
        id=p.ids[side][canonical_glyph(g,ink,r,c)]
        println(io,join(["obstruction-cell",side==1 ? "A" : "B",r,c,id,g,ink],'\t'))
    end
    String(take!(io))
end

function check_blank_obstruction(path)
    raw=read(path,String)
    expected=derive_blank_obstruction()
    @assert raw==expected "certificate differs from independently regenerated canonical data"
    println("PASS Julia native blank obstruction: exact24/24 wing inventories, all peak-exclusion witnesses, and November2026 conflict verified.")
    println("Certificate SHA256: ",bytes2hex(sha256(codeunits(raw))))
    println("Research-local necessary obstruction; canonical proof-checker profile confirmation is not implied.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    if length(ARGS)==2 && ARGS[1]=="check"
        check_blank_obstruction(ARGS[2])
    elseif isempty(ARGS)
        path=joinpath(@__DIR__,"DE-blank-obstruction.tsv")
        write(path,derive_blank_obstruction())
        check_blank_obstruction(path)
        small=projected_inventory("DE";last=2026)
        println("2026-only minimum inventory totals: ",sum.(small.peaks),"; full-range certificate remains primary.")
    else
        error("usage: blank_obstruction_certificate.jl [check PATH]")
    end
end
