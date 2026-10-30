#!/usr/bin/env julia
# Assemble a fixed complete print and check the coupled-front relaxation.
# This is not a legal whole-cube replay or a full SAT certificate.
include(joinpath(@__DIR__,"optimize.jl"))
const PrintRow = Tuple{String,Int,Int,Tuple{Int,Int},Tuple{String,Int,String}}
const COMPONENTS = [("corner",[(-3,-3)],8,3),("midge",[(-3,0)],12,2),
    ("wing1",[(-3,-1),(-3,1)],24,2),("wing2",[(-3,-2),(-3,2)],24,2)]

function assemble_minimum(;baseline=false)
    targets=physical_targets("EN");rows=PrintRow[]
    for (name,keys,pieces,faces) in COMPONENTS
        if name=="wing1"
            for line in readlines(joinpath(OUT,"..","physical-review","wing-pairing-candidate.tsv"))[2:end]
                language,p,ga,qa,ia,gb,qb,ib=split(line,'\t';keepempty=true)
                language=="EN" || continue
                push!(rows,(name,parse(Int,p),1,keys[1],(ga,parse(Int,qa),ia)))
                push!(rows,(name,parse(Int,p),2,keys[2],(gb,parse(Int,qb),ib)))
            end
        else
            source=baseline ? "baseline-coupled.tsv" : "$name-minimum-print.tsv"
            for line in readlines(joinpath(OUT,source))[2:end]
                component,p,f,g,q,ink=split(line,'\t';keepempty=true)
                component==name || continue
                face=parse(Int,f);key=length(keys)==1 ? keys[1] : keys[face]
                push!(rows,(component,parse(Int,p),face,key,(g,parse(Int,q),ink)))
            end
        end
    end
    centerkeys=[(-2,-2),(-2,-1),(-2,0),(-2,1),(-1,-1),(-1,0),(0,0)]
    for key in centerkeys
        cells=[(r,c) for r in 1:7,c in 1:7 if orbit(r,c)==key]
        arts=sort!(unique([artwork(t.board[r,c]...,r,c) for t in targets for (r,c) in cells if !isempty(t.board[r,c][1])]))
        name=key==(0,0) ? "core" : "center_$(key[1])_$(key[2])"
        inventory=vcat(arts,fill(BLANK,capacity(key)-length(arts)))
        for (piece,art) in enumerate(inventory)
            push!(rows,(name,piece,1,key,art))
        end
    end
    path=joinpath(OUT,baseline ? "baseline-print.tsv" : "minimum-print.tsv")
    open(path,"w") do io
        println(io,"component\tpiece\tface\torbit-x\torbit-y\ttext\tquarter-turn\tink")
        for (name,piece,face,key,art) in rows
            println(io,join([name,piece,face,key...,art...],'\t'))
        end
    end
    path
end

function read_minimum(path)
    lines=readlines(path)
    @assert lines[1]=="component\tpiece\tface\torbit-x\torbit-y\ttext\tquarter-turn\tink"
    rows=PrintRow[]
    for line in lines[2:end]
        name,p,f,x,y,g,q,ink=split(line,'\t';keepempty=true)
        push!(rows,(name,parse(Int,p),parse(Int,f),(parse(Int,x),parse(Int,y)),(g,parse(Int,q),ink)))
    end
    @assert length(rows)==294
    @assert length(Set((name,p,f) for (name,p,f,_,_) in rows))==294
    rows
end

function check_minimum(path;require_minimum=true)
    rows=read_minimum(path);targets=physical_targets("EN")
    for (name,keys,pieces,faces) in COMPONENTS
        problem=component_problem(targets,keys,pieces,faces);values=Dict{String,Int}()
        selected=filter(r->r[1]==name,rows)
        @assert length(selected)==pieces*faces
        for (_,p,f,key,art) in selected
            @assert 1<=p<=pieces && 1<=f<=faces
            side=length(keys)==1 ? 1 : f
            @assert key==keys[side]
            label=findfirst(==(art),problem.categories[side]);@assert !isnothing(label)
            values["p_$(p)_$f"]=label-1
        end
        replay_component(problem,values)
    end
    keys=sort!(unique([orbit(r,c) for r in 1:7,c in 1:7]))
    coupledkeys=Set(k for (_,ks,_,_) in COMPONENTS for k in ks)
    total_lower=0
    for key in keys
        if !(key in coupledkeys)
            name=key==(0,0) ? "core" : "center_$(key[1])_$(key[2])"
            selected=filter(r->r[4]==key,rows)
            @assert all(r->r[1]==name && r[3]==1 && 1<=r[2]<=capacity(key),selected)
        end
        inventory=[art for (_,_,_,k,art) in rows if k==key]
        @assert length(inventory)==capacity(key)
        cells=[(r,c) for r in 1:7,c in 1:7 if orbit(r,c)==key]
        allclasses=unique([isempty(t.board[r,c][1]) ? BLANK : artwork(t.board[r,c]...,r,c)
            for t in targets for (r,c) in cells])
        lower=0
        for art in allclasses
            required=maximum(count(cell->begin r,c=cell;g,ink=t.board[r,c];
                (isempty(g) ? BLANK : artwork(g,ink,r,c))==art end,cells) for t in targets)
            actual=count(==(art),inventory)
            @assert actual>=required
            if !isempty(art[1])
                lower+=required
                require_minimum && @assert actual==required "Extra nonblank print defeats claimed minimum"
            end
        end
        @assert all(a->a in allclasses || a==BLANK,inventory)
        require_minimum && @assert count(a->!isempty(a[1]),inventory)==lower
        total_lower+=lower
    end
    nonblank=count(r->!isempty(r[5][1]),rows)
    @assert total_lower==240
    require_minimum && @assert nonblank==240
    println("PASS native Julia: 294 fixed sticker rows; ",nonblank," nonblank / ",294-nonblank,
        " blank; required-inventory lower bound240",nonblank==240 ? " attained." : " not attained.")
    println("PASS: all coupled corner/midge/wing target fronts have injective piece matchings; every center inventory covers its target demand.")
    println("SHA256: ",bytes2hex(sha256(read(path))))
    println("UNKNOWN full physical feasibility: no legal whole-cube move replay or canonical proof profile is claimed.")
    nonblank
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    baseline=ARGS==["--assemble-baseline"]
    path=isempty(ARGS) || baseline ? assemble_minimum(;baseline) : only(ARGS)
    check_minimum(path;require_minimum=!baseline)
end
