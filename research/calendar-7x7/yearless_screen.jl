#!/usr/bin/env julia
# Current design: no printed year. Prior year-bearing screens remain historical.
include(joinpath(@__DIR__, "orientation_screen.jl"))

function yearless_header(last, lang, cols)
    labels, blanks = oriented_base(last, lang)
    for i in 1:3, month in MONTHS[lang]
        c = cols[i]
        push!(labels[orbit(1,c)], artwork(string(collect(month)[i]), "month", 1,c))
    end
    for c in setdiff(1:7, collect(cols))
        k = orbit(1,c)
        blanks[k] = get(blanks,k,0) + 1
    end
    rows = [Dict("orbit"=>collect(k), "capacity"=>capacity(k),
        "nonblank_classes"=>length(v), "simultaneous_blanks"=>get(blanks,k,0),
        "lower_bound"=>length(v)+get(blanks,k,0))
        for (k,v) in sort!(collect(labels);by=first)]
    Dict("language"=>lang, "first_year"=>2026, "last_year"=>last,
        "printed_year"=>false, "month_columns"=>collect(cols),
        "contiguous_month"=>cols[2]==cols[1]+1 && cols[3]==cols[2]+1,
        "orbits"=>rows, "violations"=>filter(r->r["lower_bound"]>r["capacity"],rows),
        "physical_feasibility"=>"UNKNOWN")
end

function main_yearless()
    candidates = [yearless_header(last,lang,(i,j,k))
        for last in [2026,2099] for lang in ["DE","EN"]
        for i in 1:5 for j in i+1:6 for k in j+1:7]
    result = Dict("format"=>"cubistry.calendar7.yearless-screen.v1",
        "printed_year"=>false, "calendar_domain"=>"2026–2099; no printed year",
        "physical_feasibility"=>"UNKNOWN",
        "scope"=>"Necessary oriented-artwork inventory only; no coupled-cubie matching or legal-move witness. Overflow marks omitted as an optimistic relaxation.",
        "font_profile"=>"Same declared optimistic artwork profile as orientation_screen.jl.",
        "candidates"=>candidates)
    open(joinpath(ROOT,"evidence","yearless-screen.json"),"w") do io
        json(io,result);println(io)
    end
    for last in [2026,2099], lang in ["DE","EN"]
        group = filter(x->x["last_year"]==last && x["language"]==lang,candidates)
        passing = filter(x->isempty(x["violations"]),group)
        println(lang," 2026–",last,": ",length(passing),"/35 necessary screens pass; ",
            count(x->x["contiguous_month"],passing),"/5 contiguous; physical UNKNOWN")
        for x in passing
            println("  month columns ",x["month_columns"])
        end
    end
end

if abspath(PROGRAM_FILE) == (@__FILE__)
    main_yearless()
end
