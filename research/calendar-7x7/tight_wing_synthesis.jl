#!/usr/bin/env julia
# Tight-inventory symmetry reduction. All findings remain front-matching only.
include(joinpath(@__DIR__,"coupled_synthesis.jl"))

function add_minimum_count(out,xs,k,prefix)
    k<=0 && return
    if k==1
        println(out,"(assert (or ",join(xs," "),"))");return
    end
    for i in eachindex(xs),j in 1:min(i,k)
        current="$(prefix)_$(i)_$j"
        prev=i>j ? "$(prefix)_$(i-1)_$j" : "false"
        lower=j==1 ? "true" : "$(prefix)_$(i-1)_$(j-1)"
        println(out,"(declare-const $current Bool)")
        println(out,"(assert (= $current (or $prev (and ",xs[i]," $lower))))")
    end
    println(out,"(assert $(prefix)_$(length(xs))_$k)")
end

function tighten_wing(problem;extra=0)
    quotas=[[maximum(count(==((side,k-1)),t) for t in problem.projected)
        for k in eachindex(problem.categories[side])] for side in 1:2]
    @assert sum(quotas[2])==24
    @assert sum(quotas[1]) in (23,24)
    sum(quotas[1])==23 && (quotas[1][extra+1]+=1)
    inventory=vcat([fill(k-1,n) for (k,n) in enumerate(quotas[1])]...)
    width=maximum(max(1,ceil(Int,log2(length(cats)+1))) for cats in problem.categories)
    bv(n)="(_ bv$n $width)"
    out=IOBuffer();write(out,problem.smt)
    for (p,label) in enumerate(inventory)
        println(out,"(assert (= p_$(p)_1 ",bv(label),"))")
    end
    for (k,n) in enumerate(quotas[2])
        xs=["(= p_$(p)_2 $(bv(k-1)))" for p in 1:24]
        add_minimum_count(out,xs,n,"quota_b_$k")
        n==1 && at_most_one(out,xs,"unique_b_$k")
    end
    String(take!(out))
end

function main_tight()
    dir=joinpath(ROOT,"evidence","coupled","tight");mkpath(dir)
    reports=Any[]
    for lang in ["DE","EN"]
        p=component_problem(physical_targets(lang),[(-3,-1),(-3,1)],24,2)
        extras=lang=="DE" ? [0] : collect(0:length(p.categories[1])-1)
        for extra in extras
            smt=tighten_wing(p;extra)
            path=joinpath(dir,"$lang-wing1-extra$extra.smt2");write(path,smt*"(check-sat)\n")
            r=z3_solve(smt;timeout_ms=30000)
            assignment=r.result==1 ? replay_component(p,r.values) : nothing
            report=Dict("language"=>lang,"extra_left_category"=>extra,"solver_lbool"=>r.result,
                "seconds"=>r.elapsed,"reason"=>r.reason,"printing"=>assignment,
                "categories"=>[[collect(x) for x in cats] for cats in p.categories],
                "smt_sha256"=>bytes2hex(sha256(read(path))),"physical_feasibility"=>"UNKNOWN")
            push!(reports,report)
            open(joinpath(dir,"results.json"),"w") do io;json(io,reports);println(io);end
            println(lang," extra=",extra," status=",r.result," elapsed=",round(r.elapsed;digits=3));flush(stdout)
            r.result==1 && break
        end
    end
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    main_tight()
end
