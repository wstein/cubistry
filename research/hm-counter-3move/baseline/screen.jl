# Screening (candidate producer only): for each print, the best of the given
# H/S/M up routes (any source letter of the same range) per mode, checked for
# display correctness and exact period closure in the generator model.
include(joinpath(@__DIR__, "..", "periodic.jl"))
enable5!()
routes = readroutes(ARGS[1])
for pf in ARGS[2:end]
    pr = readprinttxt(pf); sh = showtable(pr)
    row = String[basename(pf)]
    for (L, r) in MODES
        best = nothing
        for src in "SHM"
            haskey(routes, (src, r)) || continue
            setup, P, Q, words = routes[(src, r)]
            s = applyword(IDSTATE, setup)
            shows(s, sh, target(L, 0, true)) || continue
            q = routequality(s, words, P, Q, L, r, sh)
            q === nothing && continue
            per = words[P+1:end]
            cand = (maximum(length.(per)), sum(length.(per)), length(per), src)
            (best === nothing || (cand[1], cand[2] / cand[3]) < (best[1], best[2] / best[3])) && (best = cand)
        end
        push!(row, best === nothing ? "$L$r:none" : "$L$r:max$(best[1]),$(best[2])/$(best[3]),src$(best[4])")
    end
    println(join(row, "\t")); flush(stdout)
end
