#!/usr/bin/env julia
# Three separate adjacent letters; one deterministic start column per month.
include(joinpath(@__DIR__,"orientation_screen.jl"))

function prepare_moving(lang; last=2099)
    base,_ = oriented_base(last,lang)
    ks = sort!(collect(keys(base)))
    index = Dict(k=>i for (i,k) in enumerate(ks))
    nb = [length(base[k]) for k in ks]
    caps = [capacity(k) for k in ks]
    monthly_blanks = zeros(Int,12,length(ks))
    for m in 1:12,y in 2026:last
        a = board(y,m,lang;merge_six_nine=false)
        counts = zeros(Int,length(ks))
        for r in 2:7,c in 1:7
            isempty(a[r,c][1]) && (counts[index[orbit(r,c)]]+=1)
        end
        monthly_blanks[m,:] = max.(monthly_blanks[m,:],counts)
    end
    ids = [Dict{Tuple{String,Int,String},Int}() for _ in ks]
    masks = zeros(UInt128,12,5,length(ks))
    blanks = zeros(Int,12,5,length(ks))
    for m in 1:12,s in 1:5
        blanks[m,s,:] = monthly_blanks[m,:]
        letters = collect(MONTHS[lang][m])
        for c in 1:7
            i = index[orbit(1,c)]
            if s<=c<=s+2
                a = artwork(string(letters[c-s+1]),"month",1,c)
                id = get!(ids[i],a,length(ids[i]))
                @assert id<128
                masks[m,s,i] |= UInt128(1)<<id
            else
                blanks[m,s,i]+=1
            end
        end
    end
    (;lang,last,ks,nb,caps,masks,blanks)
end

function evaluate_moving(p,starts; detailed=false)
    masks = zeros(UInt128,length(p.ks))
    blanks = zeros(Int,length(p.ks))
    for m in 1:12,i in eachindex(p.ks)
        masks[i] |= p.masks[m,starts[m],i]
        blanks[i] = max(blanks[i],p.blanks[m,starts[m],i])
    end
    demand = [p.nb[i]+count_ones(masks[i])+blanks[i] for i in eachindex(p.ks)]
    passes = all(demand.<=p.caps)
    if !detailed
        return passes
    end
    rows = [Dict("orbit"=>collect(p.ks[i]),"base_nonblank_classes"=>p.nb[i],
        "month_classes"=>count_ones(masks[i]),"simultaneous_blanks"=>blanks[i],
        "lower_bound"=>demand[i],"capacity"=>p.caps[i]) for i in eachindex(p.ks)]
    Dict("language"=>p.lang,"first_year"=>2026,"last_year"=>p.last,
        "starts"=>collect(starts),"passes_necessary_bound"=>passes,
        "orbits"=>rows,"physical_feasibility"=>"UNKNOWN")
end

function schedule_score(starts)
    (count(s->!(s in (1,3,5)),starts),length(unique(starts)),
        count(m->starts[m]!=starts[m-1],2:12),sum(starts))
end

function search_groups(p,groupsize)
    groups = div(12,groupsize)
    tested=0; passed=0; best=Vector{Int}[]
    for groupstarts in Iterators.product(ntuple(_->1:5,groups)...)
        starts = [groupstarts[cld(m,groupsize)] for m in 1:12]
        tested+=1
        if evaluate_moving(p,starts)
            passed+=1
            push!(best,starts)
            sort!(best;by=schedule_score)
            length(best)>20 && pop!(best)
        end
    end
    Dict("months_per_group"=>groupsize,"tested"=>tested,"passing"=>passed,
        "best_candidates"=>[evaluate_moving(p,s;detailed=true) for s in best])
end

function main_moving()
    result=Any[]
    named = ["pairs_forward_wrap"=>repeat([1,2,3,4,5,1];inner=2),
        "pairs_forward_reflect"=>repeat([1,2,3,4,5,4];inner=2),
        "pairs_left_middle_right"=>repeat([1,3,5,1,3,5];inner=2),
        "quarters_left_middle_right_left"=>repeat([1,3,5,1];inner=3),
        "halfyear_left_right"=>repeat([1,5];inner=6)]
    for lang in ["DE","EN"]
        p=prepare_moving(lang)
        explicit=[merge(Dict("name"=>name),evaluate_moving(p,s;detailed=true)) for (name,s) in named]
        families=[search_groups(p,g) for g in [6,3,2]]
        push!(result,Dict("language"=>lang,"named_schemes"=>explicit,"families"=>families))
        for x in explicit
            println(lang," ",x["name"],": ",x["passes_necessary_bound"]," ",x["starts"])
        end
        for f in families
            println(lang," group ",f["months_per_group"],": ",f["passing"],"/",f["tested"]," pass")
            for b in first(f["best_candidates"],min(3,length(f["best_candidates"])))
                println("  ",b["starts"])
            end
        end
    end
    open(joinpath(ROOT,"evidence","moving-month-screen.json"),"w") do io
        json(io,Dict("format"=>"cubistry.calendar7.moving-month-screen.v1",
            "scope"=>"Month-dependent contiguous three-uppercase-letter header; one fixed start per month; native necessary inventory only; month-conditioned simultaneous blanks.",
            "printed_year"=>false,"physical_feasibility"=>"UNKNOWN","results"=>result));println(io)
    end
end

if abspath(PROGRAM_FILE) == (@__FILE__)
    main_moving()
end
