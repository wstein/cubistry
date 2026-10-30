#!/usr/bin/env julia
# Additional approved compact month: Ja | n, both prefix letters on one sticker.
include(joinpath(@__DIR__,"compact_month_screen.jl"))

function main_compact_prefix()
    candidates = [compact_month(last,lang,start;split=2)
        for last in [2026,2099] for lang in ["DE","EN"] for start in 1:6]
    result = Dict("format"=>"cubistry.calendar7.compact-prefix-screen.v1",
        "printed_year"=>false,"header"=>"Title-case two-letter prefix plus lowercase last letter on adjacent stickers",
        "font_profile"=>"Inherited orientation profile; mixed-case prefixes and lowercase last letters are indivisible, orientation-sensitive artwork.",
        "scope"=>"Necessary orbit inventory only; five blank top cells; overflow marks omitted. No physical witness.",
        "physical_feasibility"=>"UNKNOWN","candidates"=>candidates)
    open(joinpath(ROOT,"evidence","compact-prefix-screen.json"),"w") do io
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
    main_compact_prefix()
end
