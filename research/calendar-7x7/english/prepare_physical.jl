#!/usr/bin/env julia
# Embed one immutable print on actual cubies and generate exact front-pose goals.
# These goals alone are not a legal-move SAT witness.
include(joinpath(@__DIR__,"..","coupled_synthesis.jl"))
include(joinpath(@__DIR__,"..","en-physical-review","group_action_audit.jl"))

const FRONT_NORMAL=(0,0,1)
const IMAGE_UPS=[(0,1,0),(-1,0,0),(0,-1,0),(1,0,0)]
function inverse_rotate(v,r)
    ntuple(j->begin i=findfirst(==(j),r[1]);r[2][i]*v[i] end,3)
end
function image_normal(g,q,ink)
    isempty(g) && return BLANK
    g=replace(g,'O'=>'0','I'=>'1')
    g=="0" && return (g,0,ink)
    choices=[(g,mod(q,4),ink)]
    if all(c->haskey(HALF,c),g)
        push!(choices,(join(HALF[c] for c in reverse(collect(g))),mod(q+2,4),ink))
    end
    minimum(choices)
end
function all_homes()
    sort!([(x,y,z) for x in -3:3,y in -3:3,z in -3:3 if max(abs(x),abs(y),abs(z))==3])
end
function normal_faces(p)
    [ntuple(j->j==i ? sign(p[i]) : 0,3) for i in 1:3 if abs(p[i])==3]
end
function component_key(name)
    name=="corner" && return (-3,-3,-3)
    name=="midge" && return (-3,-3,0)
    name=="wing1" && return (-3,-3,-1)
    name=="wing2" && return (-3,-3,-2)
    name=="core" && return (-3,0,0)
    startswith(name,"center_") || error("Unknown component $name")
    vals=parse.(Int,split(name,'_')[2:3])
    # Surface reference (a,b) is represented by body (a,b,3).
    bodykey((vals[1],vals[2],3))
end

function load_physical_print(path)
    lines=readlines(path)
    @assert lines[1]=="component\tpiece\tface\torbit-x\torbit-y\ttext\tquarter-turn\tink"
    homes=all_homes();home_ids=Dict(p=>i for (i,p) in enumerate(homes))
    source=Dict{Tuple{V3,V3},Any}()
    for line in lines[2:end]
        fields=split(line,'\t';keepempty=true);@assert length(fields)==8
        name=String(fields[1]);piece=parse(Int,fields[2]);face=parse(Int,fields[3])
        k=(parse(Int,fields[4]),parse(Int,fields[5]));g=String(fields[6]);q=parse(Int,fields[7]);ink=String(fields[8])
        @assert 0<=q<=3
        candidates=filter(p->bodykey(p)==component_key(name),homes)
        @assert 1<=piece<=length(candidates)
        p=candidates[piece];ns=normal_faces(p)
        if startswith(name,"wing")
            ns=sort!(ns;by=n->surfacekey(p,n))
        end
        @assert 1<=face<=length(ns)
        n=ns[face];@assert surfacekey(p,n)==k
        rotations=filter(r->rotate(p,r)==(k[1],k[2],3) && rotate(n,r)==FRONT_NORMAL,ROTATIONS)
        @assert length(rotations)==(name=="core" ? 4 : 1)
        up=inverse_rotate(IMAGE_UPS[q+1],first(rotations))
        @assert sum(n.*up)==0 && sum(abs,up)==1
        key=(p,n);@assert !haskey(source,key)
        source[key]=(piece=home_ids[p],home=p,normal=n,up=up,text=g,ink=ink,component=name)
    end
    @assert length(source)==294
    result=[source[(p,n)] for p in homes for n in normal_faces(p)]
    @assert length(unique((s.home,s.normal) for s in result))==294
    @assert count(s->!isempty(s.text),result)==240
    result
end

function piece_options(stickers,home,pos,wanted)
    choices=Rotation[]
    target=image_normal(wanted[1],0,wanted[2])
    for r in ROTATIONS
        rotate(home,r)==pos || continue
        face=only(filter(s->rotate(s.normal,r)==FRONT_NORMAL,stickers))
        up=rotate(face.up,r);angle=findfirst(==(up),IMAGE_UPS)
        @assert !isnothing(angle)
        image_normal(face.text,angle-1,face.ink)==target && push!(choices,r)
    end
    choices
end

function match_front(source,target,action)
    byhome=Dict(p=>filter(s->s.home==p,source) for p in all_homes())
    assignment=Dict{V3,Tuple{V3,Rotation}}()
    for key in action.keys
        homes=sort!([p for p in keys(byhome) if bodykey(p)==key])
        slots=[(r,c,(c-4,4-r,3)) for r in 1:7,c in 1:7 if bodykey((c-4,4-r,3))==key]
        options=[[piece_options(byhome[h],h,pos,target.board[r,c]) for h in homes] for (r,c,pos) in slots]
        occupied=zeros(Int,length(homes))
        function augment(slot,seen)
            for h in eachindex(homes)
                seen[h] && continue
                isempty(options[slot][h]) && continue
                seen[h]=true
                if occupied[h]==0 || augment(occupied[h],seen)
                    occupied[h]=slot;return true
                end
            end
            false
        end
        @assert all(augment(s,falses(length(homes))) for s in eachindex(slots)) "No physical front match for component $key"
        for h in eachindex(homes)
            occupied[h]==0 && continue
            slot=occupied[h];assignment[slots[slot][3]]=(homes[h],first(options[slot][h]))
        end
    end
    @assert length(assignment)==49
    assignment
end

function main_prepare(path)
    dir=joinpath(@__DIR__,"evidence");mkpath(dir)
    source=load_physical_print(path);action=pose_action();targets=physical_targets("EN")
    index=Dict(p=>i for (i,p) in enumerate(action.points))
    target_points=[findfirst(p->p[1]==(c-4,4-r,3),action.points) for r in 1:7 for c in 1:7]
    @assert length(unique(target_points))==49
    open(joinpath(dir,"physical-print.tsv"),"w") do io
        println(io,"sticker\tpiece\thome\tnormal\tup\ttext\tink")
        for (id,s) in enumerate(source)
            println(io,join([id,s.piece,join(s.home,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'))
        end
    end
    all_sources=Vector{Int}[]
    open(joinpath(dir,"front-matches.tsv"),"w") do io
        println(io,"target\tyear\tmonth\trow\tcolumn\tsource-piece\ttarget-point\tsource-point")
        for (id,t) in enumerate(targets)
            assignment=match_front(source,t,action)
            sources=Int[]
            for r in 1:7,c in 1:7
                p=(c-4,4-r,3);home,rot=assignment[p]
                point=target_points[(r-1)*7+c]
                goal=action.points[point]
                src=tuple((inverse_rotate(v,rot) for v in goal)...)
                @assert src[1]==home
                sp=index[src];push!(sources,sp)
                println(io,join([id,t.year,t.month,r,c,findfirst(==(home),all_homes()),point,sp],'\t'))
            end
            @assert length(unique(sources))==49
            push!(all_sources,sources)
        end
    end
    open(joinpath(dir,"front-goals.g"),"w") do io
        println(io,"frontT := [",join(target_points,','),"];;")
        println(io,"frontS := [")
        for (i,s) in enumerate(all_sources)
            println(io,"[",join(s,','),"]",i<length(all_sources) ? "," : "")
        end
        println(io,"];;")
    end
    open(joinpath(dir,"targets.tsv"),"w") do io
        println(io,"target\tyear\tmonth")
        for (id,t) in enumerate(targets);println(io,join([id,t.year,t.month],'\t'));end
    end
    println("PASS: one physical 294-sticker print,240nonblank/54blank; all ",length(targets)," fronts have exact whole-piece matches.")
    println("UNKNOWN: generated pose goals are not legal-reachability certificates until a legal-word replay succeeds.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    main_prepare(isempty(ARGS) ? joinpath(@__DIR__,"..","en-print-optimization","minimum-print.tsv") : ARGS[1])
end
