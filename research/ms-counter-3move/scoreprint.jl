# Per-letter score of 24-label prints (generator side only): minimum mean
# number of 4-HTM edges and HTM per 60-edge cycle (exact inverse decrements).
# usage: julia scoreprint.jl PRINT24 [PRINT24 ...]
include("fullvi.jl")
for p in ARGS
    sh = showtable(mkprint(collect(p)))
    out = String[]
    for L in "MS"
        f, mins, _ = valueiter(buildfull(sh, L), 12)
        w = (mins[12] - mins[8]) / 4
        push!(out, "$L: $(Int(w ÷ 1000))@4 total $(round(w % 1000, digits = 2))")
    end
    println("\"$p\"  ", join(out, "  "))
end
