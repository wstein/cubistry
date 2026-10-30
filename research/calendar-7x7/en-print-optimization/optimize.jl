#!/usr/bin/env julia
# A minimum nonblank-sticker search in the coupled-front relaxation only.
include(joinpath(@__DIR__,"..","tight_wing_synthesis.jl"))
const OUT = @__DIR__

function minimum_nonblank(problem)
    [sum((maximum(count(==((side,id-1)),target) for target in problem.projected)
        for (id,art) in enumerate(cats) if !isempty(art[1]));init=0)
        for (side,cats) in enumerate(problem.categories)]
end

function minimum_print_constraints(problem)
    out=IOBuffer();write(out,problem.smt)
    width=maximum(max(1,ceil(Int,log2(length(cats)+1))) for cats in problem.categories)
    bv(n)="(_ bv$n $width)"
    for (side,classes) in enumerate(problem.categories)
        blank=findfirst(==(BLANK),classes)-1
        vars=length(problem.keys)==1 ? ["p_$(p)_$f" for p in 1:problem.pieces for f in 1:problem.faces] :
            ["p_$(p)_$side" for p in 1:problem.pieces]
        required_blank=length(vars)-minimum_nonblank(problem)[side]
        add_minimum_count(out,["(= $v $(bv(blank)))" for v in vars],required_blank,"opt_blank_$side")
        # Each required nonblank image must exist. Together with the maximal
        # blank count, this forces exactly one copy of each nonblank image.
        for label in 0:length(classes)-1
            label==blank && continue
            println(out,"(assert (or ",join(["(= $v $(bv(label)))" for v in vars]," "),"))")
        end
    end
    String(take!(out))
end

function read_baseline(problem,name)
    result=Dict{String,Int}()
    for line in readlines(joinpath(OUT,"baseline-coupled.tsv"))[2:end]
        component,p,f,g,q,ink=split(line,'\t';keepempty=true)
        component==name || continue
        face=parse(Int,f);side=length(problem.keys)==1 ? 1 : face
        label=findfirst(==((g,parse(Int,q),ink)),problem.categories[side])
        @assert !isnothing(label)
        result["p_$(p)_$f"]=label-1
    end
    result
end

function write_print(path,name,problem,printing)
    open(path,"w") do io
        println(io,"component\tpiece\tface\ttext\tquarter-turn\tink")
        for (p,faces) in enumerate(printing),(face,label) in enumerate(faces)
            side=length(problem.keys)==1 ? 1 : face
            g,q,ink=problem.categories[side][label+1]
            println(io,join([name,p,face,g,q,ink],'\t'))
        end
    end
end

function print_nonblank(problem,printing)
    sum(!isempty(problem.categories[length(problem.keys)==1 ? 1 : f][label+1][1])
        for faces in printing for (f,label) in enumerate(faces))
end

function report_inventory()
    targets=physical_targets("EN")
    allkeys=sort!(unique([orbit(r,c) for r in 1:7,c in 1:7]))
    rows=Any[]
    for key in allkeys
        cells=[(r,c) for r in 1:7,c in 1:7 if orbit(r,c)==key]
        classes=sort!(unique([isempty(t.board[r,c][1]) ? BLANK : artwork(t.board[r,c]...,r,c)
            for t in targets for (r,c) in cells]))
        peak=[maximum(count(cell->begin r,c=cell; g,ink=t.board[r,c];
            (isempty(g) ? BLANK : artwork(g,ink,r,c))==a end,cells) for t in targets) for a in classes]
        nonblank=sum((n for (a,n) in zip(classes,peak) if !isempty(a[1]));init=0)
        push!(rows,Dict("orbit"=>collect(key),"capacity"=>capacity(key),"minimum_nonblank"=>nonblank,
            "minimum_inventory"=>sum(peak),"minimum_blanks"=>sum((n for (a,n) in zip(classes,peak) if isempty(a[1]));init=0),
            "max_blank_if_no_extra_nonblank"=>capacity(key)-nonblank))
    end
    open(joinpath(OUT,"inventory-lower-bounds.json"),"w") do io;json(io,rows);println(io);end
    println("Required nonblank inventory lower bound: ",sum(r["minimum_nonblank"] for r in rows))
    for r in rows;println(r);end
end

function main_optimize()
    report_inventory()
    targets=physical_targets("EN"); reports=Any[]
    for (name,keys,pieces,faces) in [("corner",[(-3,-3)],8,3),("midge",[(-3,0)],12,2),
        ("wing2",[(-3,-2),(-3,2)],24,2)]
        problem=component_problem(targets,keys,pieces,faces)
        baseline=replay_component(problem,read_baseline(problem,name))
        lower=sum(minimum_nonblank(problem));before=print_nonblank(problem,baseline)
        println(name," baseline nonblank=",before,"; lower bound=",lower);flush(stdout)
        if before==lower
            printing=baseline;resultcode=1;seconds=0.0
        else
            smt=minimum_print_constraints(problem)
            write(joinpath(OUT,"$name-minimum.smt2"),smt*"(check-sat)\n")
            result=z3_solve(smt;timeout_ms=120000)
            printing=result.result==1 ? replay_component(problem,result.values) : nothing
            resultcode=result.result;seconds=result.elapsed
        end
        if !isnothing(printing)
            @assert print_nonblank(problem,printing)==lower
            write_print(joinpath(OUT,"$name-minimum-print.tsv"),name,problem,printing)
        end
        push!(reports,Dict("component"=>name,"baseline_nonblank"=>before,"lower_bound"=>lower,
            "minimum_model_found"=>resultcode==1,"solver_lbool"=>resultcode,"solver_seconds"=>seconds,
            "physical_feasibility"=>"UNKNOWN"))
        open(joinpath(OUT,"results.json"),"w") do io;json(io,reports);println(io);end
        println(name," minimum model found=",resultcode==1,"; seconds=",seconds);flush(stdout)
    end
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    main_optimize()
end
