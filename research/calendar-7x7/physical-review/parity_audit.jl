#!/usr/bin/env julia
# Necessary parity relations, derived from exact noncentral layer generators.
# Their satisfaction is NOT claimed sufficient for reachability.
include(joinpath(@__DIR__,"geometry_audit.jl"))

turn(p::V3,axis::Int)::V3=axis==1 ? (p[1],-p[3],p[2]) :
    axis==2 ? (p[3],p[2],-p[1]) : (-p[2],p[1],p[3])
function permutation_signbit(images)
    visited=falses(length(images));cycles=0
    for start in eachindex(images)
        visited[start] && continue
        cycles+=1;j=start
        while !visited[j]
            visited[j]=true;j=images[j]
        end
    end
    mod(length(images)-cycles,2)
end

function parity_audit()
    orbits=Dict{V3,Vector{V3}}()
    for x in -3:3,y in -3:3,z in -3:3
        p=(x,y,z)
        maximum(abs.(p))==3 || continue
        push!(get!(orbits,bodykey(p),V3[]),p)
    end
    orbitkeys=sort!(collect(keys(orbits)))
    # One of the six fixed centers is omitted from sign equations because
    # positions remain fixed in these generators; its in-plane spin is separate.
    println("axis\tlayer\t",join(string.(orbitkeys),'\t'))
    for axis in 1:3,layer in (-3,-2,-1,1,2,3)
        signs=Dict{V3,Int}()
        for k in orbitkeys
            positions=sort!(copy(orbits[k]));index=Dict(p=>i for (i,p) in enumerate(positions))
            images=[index[p[axis]==layer ? turn(p,axis) : p] for p in positions]
            @assert length(unique(images))==length(images)
            signs[k]=permutation_signbit(images)
        end
        corner=signs[(-3,-3,-3)]
        w1=signs[(-3,-3,-1)];w2=signs[(-3,-3,-2)]
        @assert signs[(-3,-3,0)]==corner
        @assert signs[(-3,-1,-1)]==corner
        @assert signs[(-3,-2,-2)]==corner
        @assert signs[(-3,-1,0)]==xor(corner,w1)
        @assert signs[(-3,-2,0)]==xor(corner,w2)
        @assert signs[(-3,-2,-1)]==xor(xor(corner,w1),w2)
        @assert signs[(-3,-2,1)]==xor(xor(corner,w1),w2)
        println(axis,'\t',layer,'\t',join([signs[k] for k in orbitkeys],'\t'))
    end
    println("PASS: seven parity equations hold for all 18 noncentral quarter-layer generators.")
    println("UNKNOWN: completeness of these invariants and full-state legal reachability are not established.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    parity_audit()
end
