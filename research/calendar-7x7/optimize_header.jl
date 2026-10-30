#!/usr/bin/env julia
# Exhaustive necessary-condition screening. Passing is UNKNOWN, not SAT.
include(joinpath(@__DIR__,"analyze.jl"))

function screen_header(base,lang,last,cols,year_start,year_ink; prefix=true)
    occupied=Set([cols...,year_start,year_start+1])
    free=setdiff(Set(1:7),occupied)
    quote_col=year_start-1
    prefix && !(quote_col in free) && return nothing
    prefix && delete!(free,quote_col)
    allrows=Any[]
    inventories=Dict(Tuple(r["orbit"])=>Set(Tuple(t) for t in r["labels"]) for r in base)
    blanks=Dict(Tuple(r["orbit"])=>r["simultaneous_blanks"] for r in base)
    for i in 1:3, month in MONTHS[lang]
        k=orbit(1,cols[i]);push!(inventories[k],(string(collect(month)[i]),"month"))
    end
    for y in 2026:last, (c,digit) in [(year_start,div(y%100,10)),(year_start+1,y%10)]
        push!(inventories[orbit(1,c)],token(string(digit),year_ink))
    end
    for c in free; k=orbit(1,c);blanks[k]=get(blanks,k,0)+1;end
    prefix && push!(inventories[orbit(1,quote_col)],("'","prefix"))
    for k in sort!(collect(keys(inventories)))
        b=get(blanks,k,0);n=length(inventories[k])
        push!(allrows,Dict("orbit"=>collect(k),"capacity"=>capacity(k),"lower_bound"=>n+b,
            "nonblank_classes"=>n,"simultaneous_blanks"=>b))
    end
    any(r->r["lower_bound"]>r["capacity"],allrows) && return nothing
    Dict("language"=>lang,"first_year"=>2026,"last_year"=>last,"month_columns"=>collect(cols),
        "year_columns"=>[year_start,year_start+1],"year_ink"=>year_ink,"prefix"=>prefix,
        "orbits"=>allrows,"physical_feasibility"=>"UNKNOWN")
end

function optimize()
    results=Any[];best=Dict{String,Any}();tested=0
    for last in 2026:2099,lang in ["DE","EN"]
        base=demands(2026,last,lang,nothing)
        wins=Any[]
        for i in 1:5,j in i+1:6,k in j+1:7,year_start in 1:6,ink in ["dark","red","year"],prefix in [true,false]
            cols=(i,j,k)
            (year_start in cols || year_start+1 in cols) && continue
            tested+=1
            candidate=screen_header(base,lang,last,cols,year_start,ink;prefix)
            isnothing(candidate) || push!(wins,candidate)
        end
        push!(results,Dict("language"=>lang,"last_year"=>last,"passing_relaxations"=>length(wins)))
        if !isempty(wins)
            best[lang]=wins
        end
    end
    output=Dict("format"=>"cubistry.calendar7.header-screen.v1","first_year"=>2026,
        "candidate_evaluations"=>tested,"scope"=>"Exhaustive surface-inventory relaxation only; no cubie coupling or legal-move witness.",
        "glyph_reuse"=>"Only 6/9 numeric artwork merged optimistically; other labels exact.",
        "physical_feasibility"=>"UNKNOWN","prefix_results"=>results,"largest_passing_prefixes"=>best)
    open(joinpath(ROOT,"evidence","header-screen.json"),"w") do io;json(io,output);println(io);end
    println("Header relaxation evaluations: ",tested)
    for lang in ["DE","EN"]
        if haskey(best,lang)
            wins=best[lang];println(lang,": last passing prefix end ",wins[1]["last_year"],
                "; ",length(wins)," header/palette relaxations; UNKNOWN physical feasibility")
            for x in wins[1:min(end,3)]
                println("  month columns ",x["month_columns"],", year ",x["year_columns"],
                    ", ink ",x["year_ink"],", apostrophe ",x["prefix"])
            end
        else
            println(lang,": no header passes the necessary relaxation, even in 2026")
        end
    end
end
optimize()
