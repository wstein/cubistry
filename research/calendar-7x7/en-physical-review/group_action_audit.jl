#!/usr/bin/env julia
# Independent cubie-pose permutation action for a 7x7 cube.
# Exports legal generators for group experiments; not a SAT certificate.
include(joinpath(@__DIR__,"..","physical-review","geometry_audit.jl"))

const Pose = Tuple{V3,V3,V3}
pose_rotate(t::Pose,r::Rotation)::Pose=tuple((rotate(v,r) for v in t)...)
quarter(v::V3,axis)=axis==1 ? (v[1],-v[3],v[2]) : axis==2 ? (v[3],v[2],-v[1]) : (-v[2],v[1],v[3])
function quarterpose(t::Pose,axis)::Pose
    tuple((quarter(v,axis) for v in t)...)
end

function pose_action()
    bodies=Set{V3}()
    for x in -3:3,y in -3:3,z in -3:3
        p=(x,y,z)
        maximum(abs.(p))==3 && push!(bodies,bodykey(p))
    end
    keys=sort!(collect(bodies));@assert length(keys)==11
    points=Pose[];which=Int[];localpoints=Vector{Pose}[]
    for (k,p) in enumerate(keys)
        axis=first(i for i in 1:3 if abs(p[i])==3)
        n=ntuple(i->i==axis ? sign(p[axis]) : 0,3)
        u=ntuple(i->i==first(j for j in 1:3 if j!=axis) ? 1 : 0,3)
        poses=sort!(unique([pose_rotate((p,n,u),r) for r in ROTATIONS]))
        @assert length(poses)==24
        append!(points,poses);append!(which,fill(k,24));push!(localpoints,poses)
    end
    @assert length(points)==264 && length(unique(points))==264
    index=Dict(p=>i for (i,p) in enumerate(points))
    generators=Vector{Int}[];moves=Tuple{Int,Int}[]
    for axis in 1:3,layer in (-3,-2,-1,1,2,3,99)
        images=[index[layer==99 || p[1][axis]==layer ? quarterpose(p,axis) : p] for p in points]
        @assert sort(images)==collect(1:264)
        @assert all(which[i]==which[images[i]] for i in 1:264)
        @assert all(images[images[images[images[i]]]]==i for i in 1:264)
        push!(generators,images);push!(moves,(axis,layer))
    end
    (;keys,points,localpoints,generators,moves)
end

function export_action()
    a=pose_action()
    path=joinpath(@__DIR__,"action.g")
    open(path,"w") do io
        println(io,"gens := [")
        for (i,g) in enumerate(a.generators)
            println(io,"PermList([",join(g,','),"])",i<length(a.generators) ? "," : "")
        end
        println(io,"];;")
        println(io,"G := Group(gens);;")
    end
    open(joinpath(@__DIR__,"pose-points.tsv"),"w") do io
        println(io,"point\torbit\tbody\tnormal\tup")
        for (i,(p,n,u)) in enumerate(a.points)
            println(io,join([i,cld(i,24),join(p,','),join(n,','),join(u,',')],'\t'))
        end
    end
    open(joinpath(@__DIR__,"moves.tsv"),"w") do io
        println(io,"generator\taxis\tlayer\tquarter_turn")
        for (i,(axis,layer)) in enumerate(a.moves)
            println(io,join([i,axis,layer==99 ? "all" : string(layer),1],'\t'))
        end
    end
    front=[findfirst(t->t[1]==(c-4,4-r,3),a.points) for r in 1:7 for c in 1:7]
    @assert length(front)==49 && all(!isnothing,front)
    open(joinpath(@__DIR__,"front-base.tsv"),"w") do io
        println(io,"row\tcolumn\tpoint")
        for (i,t) in enumerate(front)
            println(io,join([cld(i,7),mod(i-1,7)+1,t],'\t'))
        end
    end
    open(joinpath(@__DIR__,"front_base.g"),"w") do io
        println(io,"T := [",join(front,','),"];;")
        println(io,"fullbase := Concatenation(T,Difference([1..264],T));;")
    end
    println("PASS: 11 physical pose orbits,264points,21 legal layer/global generators, each order4.")
    println("UNKNOWN: group membership and target reachability are not asserted.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    export_action()
end
