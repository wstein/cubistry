#!/usr/bin/env julia
# Candidate synthesis only. A solver model is NOT a legal-reachability proof.
include(joinpath(@__DIR__,"moving_month_screen.jl"))
const Z3LIB = "/lib/x86_64-linux-gnu/libz3.so.4"
const BLANK = ("",0,"blank")

# Sinz sequential at-most-one encoding using only ordinary Boolean clauses.
function at_most_one(out,xs,prefix)
    n=length(xs);n<=1 && return
    ss=["$(prefix)_$i" for i in 1:n-1]
    for s in ss;println(out,"(declare-const $s Bool)");end
    println(out,"(assert (or (not ",xs[1],") ",ss[1],"))")
    for i in 2:n-1
        println(out,"(assert (or (not ",xs[i],") ",ss[i],"))")
        println(out,"(assert (or (not ",ss[i-1],") ",ss[i],"))")
        println(out,"(assert (or (not ",xs[i],") (not ",ss[i-1],")))")
    end
    println(out,"(assert (or (not ",xs[n],") (not ",ss[n-1],")))")
end

function physical_targets(lang)
    seen=Set{String}();targets=Any[]
    for y in 2026:2099,m in 1:12
        a=board(y,m,lang;merge_six_nine=false)
        start=m<=9 ? 5 : 1
        for c in 1:7
            a[1,c]=start<=c<=start+2 ? (string(collect(MONTHS[lang][m])[c-start+1]),"month") : ("","blank")
        end
        # Explicit overflow artwork, not an unmarked relaxed calendar.
        for c in 1:7
            g,ink=a[3,c]
            !isempty(g) && parse(Int,g)>7 && (a[3,c]=(g*"↶",ink))
        end
        key=join([string(t) for t in a],"|")
        if !(key in seen)
            push!(seen,key)
            push!(targets,(year=y,month=m,board=a))
        end
    end
    targets
end

function z3_solve(smt;timeout_ms=60000)
    cfg=ccall((:Z3_mk_config,Z3LIB),Ptr{Cvoid},())
    ctx=ccall((:Z3_mk_context,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),cfg)
    ccall((:Z3_del_config,Z3LIB),Cvoid,(Ptr{Cvoid},),cfg)
    solver=ccall((:Z3_mk_solver,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),ctx)
    ccall((:Z3_solver_inc_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    pars=ccall((:Z3_mk_params,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),ctx)
    ccall((:Z3_params_inc_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,pars)
    sym=ccall((:Z3_mk_string_symbol,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Cstring),ctx,"timeout")
    ccall((:Z3_params_set_uint,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid},Cuint),ctx,pars,sym,timeout_ms)
    ccall((:Z3_solver_set_params,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid}),ctx,solver,pars)
    ccall((:Z3_solver_from_string,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Cstring),ctx,solver,smt)
    @assert ccall((:Z3_get_error_code,Z3LIB),Cuint,(Ptr{Cvoid},),ctx)==0 "Z3 parser error"
    t=time_ns()
    result=ccall((:Z3_solver_check,Z3LIB),Cint,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    elapsed=(time_ns()-t)/1e9
    values=Dict{String,Int}();reason=""
    if result==1
        model=ccall((:Z3_solver_get_model,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
        ccall((:Z3_model_inc_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
        n=ccall((:Z3_model_get_num_consts,Z3LIB),Cuint,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
        for i in 0:Int(n)-1
            decl=ccall((:Z3_model_get_const_decl,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid},Cuint),ctx,model,i)
            name_sym=ccall((:Z3_get_decl_name,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid}),ctx,decl)
            name=unsafe_string(ccall((:Z3_get_symbol_string,Z3LIB),Cstring,(Ptr{Cvoid},Ptr{Cvoid}),ctx,name_sym))
            startswith(name,"p_") || continue
            ast=ccall((:Z3_model_get_const_interp,Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid}),ctx,model,decl)
            value=Ref{UInt64}(0)
            ok=ccall((:Z3_get_numeral_uint64,Z3LIB),Bool,(Ptr{Cvoid},Ptr{Cvoid},Ref{UInt64}),ctx,ast,value)
            @assert ok
            values[name]=Int(value[])
        end
        ccall((:Z3_model_dec_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
    elseif result==0
        reason=unsafe_string(ccall((:Z3_solver_get_reason_unknown,Z3LIB),Cstring,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver))
    end
    ccall((:Z3_params_dec_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,pars)
    ccall((:Z3_solver_dec_ref,Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    ccall((:Z3_del_context,Z3LIB),Cvoid,(Ptr{Cvoid},),ctx)
    (;result,elapsed,values,reason)
end

function component_problem(targets,keys,pieces,faces)
    cells=[(r,c,findfirst(==(orbit(r,c)),keys)) for r in 1:7,c in 1:7 if orbit(r,c) in keys]
    categories=[sort!(unique([isempty(t.board[r,c][1]) ? BLANK : artwork(t.board[r,c]...,r,c)
        for t in targets for (r,c,k) in cells if k==i])) for i in eachindex(keys)]
    ids=[Dict(a=>i-1 for (i,a) in enumerate(classes)) for classes in categories]
    projected=unique([[ (k,ids[k][isempty(t.board[r,c][1]) ? BLANK : artwork(t.board[r,c]...,r,c)])
        for (r,c,k) in cells] for t in targets])
    width=maximum(max(1,ceil(Int,log2(length(cats)+1))) for cats in categories)
    bv(n)="(_ bv$n $width)"
    out=IOBuffer();println(out,"(set-logic QF_BV)")
    for p in 1:pieces,f in 1:faces
        k=length(keys)==1 ? 1 : f
        println(out,"(declare-const p_$(p)_$f (_ BitVec $width))")
        println(out,"(assert (bvult p_$(p)_$f ",bv(length(categories[k])),"))")
    end
    # Piece identities are freely chosen when synthesizing a fresh printing.
    for p in 1:pieces-1
        println(out,"(assert (bvule p_$(p)_1 p_$(p+1)_1))")
    end
    if length(keys)==1
        for p in 1:pieces,f in 1:faces-1
            println(out,"(assert (bvule p_$(p)_$f p_$(p)_$(f+1)))")
        end
    end
    for (t,slots) in enumerate(projected)
        bypiece=[String[] for _ in 1:pieces]
        for (s,(k,label)) in enumerate(slots)
            xs=String[]
            for p in 1:pieces,f in (length(keys)==1 ? (1:faces) : (k:k))
                x="x_$(t)_$(s)_$(p)_$f"
                println(out,"(declare-const $x Bool)")
                println(out,"(assert (=> $x (= p_$(p)_$f ",bv(label),")))")
                push!(xs,x);push!(bypiece[p],x)
            end
            println(out,"(assert (or ",join(xs," "),"))")
            at_most_one(out,xs,"aux_slot_$(t)_$s")
        end
        for (p,xs) in enumerate(bypiece)
            at_most_one(out,xs,"aux_piece_$(t)_$p")
        end
    end
    (;smt=String(take!(out)),keys,pieces,faces,categories,projected,cells)
end

# Separate from solver assignment variables: independently find an injective
# piece-to-front-slot matching for the extracted immutable printing.
function replay_component(problem,values)
    assigned=[[values["p_$(p)_$f"] for f in 1:problem.faces] for p in 1:problem.pieces]
    for slots in problem.projected
        occupied=zeros(Int,problem.pieces)
        function augment(s,seen)
            k,label=slots[s]
            for p in 1:problem.pieces
                seen[p] && continue
                matching=length(problem.keys)==1 ? label in assigned[p] : assigned[p][k]==label
                matching || continue
                seen[p]=true
                if occupied[p]==0 || augment(occupied[p],seen)
                    occupied[p]=s;return true
                end
            end
            false
        end
        @assert all(augment(s,falses(problem.pieces)) for s in eachindex(slots))
    end
    assigned
end

function main_coupled()
    dir=joinpath(ROOT,"evidence","coupled");mkpath(dir)
    reports=Any[]
    version=unsafe_string(ccall((:Z3_get_full_version,Z3LIB),Cstring,()))
    components=[("corner",[(-3,-3)],8,3),("midge",[(-3,0)],12,2),
        ("wing1",[(-3,-1),(-3,1)],24,2),("wing2",[(-3,-2),(-3,2)],24,2)]
    for lang in ["DE","EN"]
        targets=physical_targets(lang)
        println(lang," distinct complete target fronts: ",length(targets));flush(stdout)
        for (name,keys,pieces,faces) in components
            problem=component_problem(targets,keys,pieces,faces)
            path=joinpath(dir,"$lang-$name.smt2")
            write(path,problem.smt*"(check-sat)\n")
            result=z3_solve(problem.smt)
            assignment=result.result==1 ? replay_component(problem,result.values) : nothing
            report=Dict("language"=>lang,"component"=>name,"solver_result"=>result.result==1 ? "sat" : result.result== -1 ? "unsat" : "unknown",
                "solver_seconds"=>result.elapsed,"reason"=>result.reason,
                "distinct_fronts"=>length(targets),"projected_fronts"=>length(problem.projected),
                "category_counts"=>length.(problem.categories),"categories"=>[[collect(x) for x in cats] for cats in problem.categories],
                "printing"=>assignment,"smt_sha256"=>bytes2hex(sha256(read(path))),
                "scope"=>"Coupled front matching relaxation, not legal full-cube reachability.","physical_feasibility"=>"UNKNOWN")
            push!(reports,report)
            open(joinpath(dir,"results.json"),"w") do io
                json(io,Dict("z3_version"=>version,"z3_library_sha256"=>bytes2hex(sha256(read(Z3LIB))),
                    "physical_feasibility"=>"UNKNOWN","results"=>reports));println(io)
            end
            println(lang," ",name,": ",report["solver_result"]," ",round(result.elapsed;digits=3),"s; classes ",report["category_counts"]);flush(stdout)
        end
    end
end

if abspath(PROGRAM_FILE) == (@__FILE__)
    main_coupled()
end
