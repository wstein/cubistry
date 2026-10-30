#!/usr/bin/env julia
# Independent single-piece geometry audit from the 24 proper cube rotations.
# This is not a multi-piece reachability checker or a physical SAT certificate.
const V3 = NTuple{3,Int}
const Rotation = Tuple{V3,V3}
const ROTATIONS = Rotation[]
for p1 in 1:3,p2 in 1:3,p3 in 1:3
    length(Set((p1,p2,p3)))==3 || continue
    p=(p1,p2,p3)
    inversions=sum(p[i]>p[j] for i in 1:3 for j in i+1:3)
    parity=iseven(inversions) ? 1 : -1
    for sx in (-1,1),sy in (-1,1),sz in (-1,1)
        parity*sx*sy*sz==1 && push!(ROTATIONS,(p,(sx,sy,sz)))
    end
end
@assert length(ROTATIONS)==24
rotate(v::V3,r::Rotation)::V3=ntuple(i->r[2][i]*v[r[1][i]],3)
bodykey(p::V3)=minimum(rotate(p,r) for r in ROTATIONS)
function surfacekey(p::V3,n::V3)
    # Transport the normal to the front, then choose a reference position there.
    possible=[rotate(p,r) for r in ROTATIONS if rotate(n,r)==(0,0,1)]
    @assert length(possible)==4
    minimum((q[1],q[2]) for q in possible)
end
function audit_geometry()
    bodies=Dict{V3,Vector{V3}}()
    surfaces=Dict{Tuple{Int,Int},Vector{Tuple{V3,V3}}}()
    coupling=Dict{V3,Vector{Tuple{Int,Int}}}()
    for x in -3:3,y in -3:3,z in -3:3
        p=(x,y,z)
        maximum(abs.(p))==3 || continue
        b=bodykey(p)
        push!(get!(bodies,b,V3[]),p)
        local_surfaces=Tuple{Int,Int}[]
        for axis in 1:3
            abs(p[axis])==3 || continue
            n=ntuple(i->i==axis ? sign(p[axis]) : 0,3)
            k=surfacekey(p,n)
            push!(get!(surfaces,k,Tuple{V3,V3}[]),(p,n))
            push!(local_surfaces,k)
            stabilizer=count(r->rotate(p,r)==p && rotate(n,r)==n,ROTATIONS)
            @assert stabilizer==(count(!iszero,p)==1 ? 4 : 1)
        end
        sorted=sort!(local_surfaces)
        if haskey(coupling,b)
            @assert coupling[b]==sorted
        else
            coupling[b]=sorted
        end
    end
    @assert sum(length,values(bodies))==218
    @assert sum(length,values(surfaces))==294
    @assert length(surfaces)==13
    println("body-orbit\tpieces\tstickers-per-piece\tsticker-orbits")
    for (b,pieces) in sort!(collect(bodies);by=first)
        cs=coupling[b]
        println(join([string(b),length(pieces),length(cs),join(string.(cs),";")],'\t'))
        for k in cs
            @assert length(surfaces[k])==(k==(0,0) ? 6 : 24)
        end
    end
    println("surface-orbit\tstickers\tfront-cells")
    for (k,items) in sort!(collect(surfaces);by=first)
        front=[(4-p[2],p[1]+4) for (p,n) in items if n==(0,0,1)]
        println(join([string(k),length(items),join(string.(sort!(front)),";")],'\t'))
    end
    println("PASS: 24 proper rotations, 218 visible cubies, 294 stickers, 13 sticker orbits.")
    println("UNKNOWN: no coupled inventory, complete-state membership, or legal replay is established here.")
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    audit_geometry()
end
