# Usage: julia verify_witness.jl WITNESS.json padded|unpadded   (prints a report that the Flix checker reproduces byte for byte)
include(joinpath(@__DIR__, "load.jl"))
using SHA
function main(path, mode)
    padded = mode == "padded"
    w = load_witness(path)
    pats = date_patterns()
    got = [(t["weekday"], t["day"], t["month"]) for t in w.targets]
    io = IOBuffer()
    println(io, "PRINT stickers=$(length(w.stk)) centers=", join([w.image[i] == "" ? "_" : w.image[i] for i in eachindex(w.stk) if count(!iszero, w.stk[i].p) == 1], ""))
    println(io, "PATTERNS expected=$(length(pats)) listed=$(length(got)) sameSet=$(sort(got) == sort(pats))")
    bad = 0; minh = typemax(Int); maxh = 0; sumh = 0; maxr = 0
    for t in w.targets
        ok, why, toks = check_target(w, t; padded)
        if !ok; bad += 1; println(io, "FAIL $(t["weekday"]) $(t["day"]) $(t["month"]): $why"); continue; end
        o, r, _ = count_moves(toks)
        println(io, report_line(t, toks, padded))
        minh = min(minh, o); maxh = max(maxh, o); sumh += o; maxr = max(maxr, r)
    end
    println(io, "SUMMARY mode=$mode targets=$(length(w.targets)) failed=$bad outerMin=$minh outerMax=$maxh outerSum=$sumh maxRotationsPerTarget=$maxr")
    s = String(take!(io)); print(s)
    println("REPORT-SHA256 ", bytes2hex(sha256(s)))
    exit(bad == 0 && sort(got) == sort(pats) ? 0 : 1)
end
main(ARGS[1], ARGS[2])
