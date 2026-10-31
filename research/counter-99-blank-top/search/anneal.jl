# Simulated annealing over sticker labels, warm-started from the old counter print
# (title stickers read as blanks). Usage: julia anneal.jl SEED ITERS MODE(lz|nz) OUT
include(joinpath(@__DIR__, "engine.jl"))
using Random
score(r) = r[2] < 201 ? 1e9 * (201 - r[2]) : Float64(r[1])
function anneal(W, lab, seedst, iters, rngseed; beam=1500, T0=3000.0, T1=0.3, profile=:B, mode=:lz, log=stdout)
    rng = MersenneTwister(rngseed)
    af = M.atfacelet(seedst)
    fixed = Set(af[f+1] + 1 for f in (M.F_UL, M.F_UR, M.F_LL, M.F_LR))
    free = [s for s in 1:24 if !(s in fixed)]
    ev(l) = score(evaluate(W, l, profile; beam, seed=seedst, mode))
    cur = ev(lab); best = (cur, copy(lab)); println(log, "start $cur"); flush(log)
    for it in 1:iters
        T = T0 * (T1 / T0)^(it / iters)
        i, j = rand(rng, free, 2); lab[i] == lab[j] && continue
        lab[i], lab[j] = lab[j], lab[i]
        s = ev(lab)
        if s <= cur || rand(rng) < exp((cur - s) / T)
            cur = s; s < best[1] && (best = (s, copy(lab)); println(log, "it $it best $s lab $(join(lab, ','))"); flush(log))
        else
            lab[i], lab[j] = lab[j], lab[i]
        end
    end
    best
end
