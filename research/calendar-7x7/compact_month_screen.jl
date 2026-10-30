#!/usr/bin/env julia
# Approved compact month: J | an, with both lowercase letters on one sticker.
include(joinpath(@__DIR__, "orientation_screen.jl"))

function compact_month(last, lang, start; split=1)
    split in (1,2) || throw(ArgumentError("Month split must be 1 or 2"))
    labels, blanks = oriented_base(last,lang)
    cols = (start,start+1)
    fragments = Any[]
    for month in MONTHS[lang]
        chars = collect(month)
        title = [string(chars[1]),lowercase(string(chars[2])),lowercase(string(chars[3]))]
        parts = (join(title[1:split]), join(title[split+1:3]))
        push!(fragments,collect(parts))
        for (c,g) in zip(cols,parts)
            push!(labels[orbit(1,c)],artwork(g,"month",1,c))
        end
    end
    for c in setdiff(1:7,collect(cols))
        k = orbit(1,c)
        blanks[k] = get(blanks,k,0)+1
    end
    rows = [Dict("orbit"=>collect(k),"capacity"=>capacity(k),
        "nonblank_classes"=>length(v),"simultaneous_blanks"=>get(blanks,k,0),
        "lower_bound"=>length(v)+get(blanks,k,0))
        for (k,v) in sort!(collect(labels);by=first)]
    Dict("language"=>lang,"first_year"=>2026,"last_year"=>last,
        "month_columns"=>collect(cols),"requested_placement"=>start==1,
        "month_fragments"=>fragments,"orbits"=>rows,
        "violations"=>filter(r->r["lower_bound"]>r["capacity"],rows),
        "physical_feasibility"=>"UNKNOWN")
end

function main_compact()
    candidates = [compact_month(last,lang,start)
        for last in [2026,2099] for lang in ["DE","EN"] for start in 1:6]
    result = Dict("format"=>"cubistry.calendar7.compact-month-screen.v1",
        "printed_year"=>false,"header"=>"Uppercase initial plus lowercase two-letter suffix on adjacent stickers",
        "font_profile"=>"Inherited orientation profile; lowercase suffixes are indivisible, orientation-sensitive artwork.",
        "scope"=>"Necessary orbit inventory only; five blank top cells; overflow marks omitted. No physical witness.",
        "physical_feasibility"=>"UNKNOWN","candidates"=>candidates)
    open(joinpath(ROOT,"evidence","compact-month-screen.json"),"w") do io
        json(io,result);println(io)
    end
    for x in candidates
        println(x["language"]," 2026–",x["last_year"]," columns ",x["month_columns"],
            ": ",length(x["violations"])," overloaded orbits; physical UNKNOWN")
        for v in x["violations"]
            println("  ",v["orbit"],": ",v["lower_bound"]," > ",v["capacity"])
        end
    end
end

if abspath(PROGRAM_FILE) == (@__FILE__)
    main_compact()
end
