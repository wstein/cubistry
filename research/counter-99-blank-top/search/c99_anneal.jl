# Simulated annealing over sticker labels (label swaps; the four stickers shown at the
# seed state stay fixed so the seed keeps displaying value 0). Objective: sum over modes
# of the relaxed layered-DP cost (1, 2, 3 per edge; 1000 per 4-move edge; 1e6 per 5).
# Usage: julia anneal.jl ITERS RNGSEED MODES(lz | lz,nz) INIT_LABELS SEEDSTATE [T0]
include(joinpath(@__DIR__, "engine.jl"))
using Random
score(r) = r[2] < 201 ? 1e9 * (201 - r[2]) : Float64(r[1])
function anneal(W, lab, seedst, iters, rngseed, modes; beam=1500, T0=1500.0, T1=0.3, log=stdout)
    rng = MersenneTwister(rngseed)
    af = M.atfacelet(seedst)
    fixed = Set(af[f+1] + 1 for f in (M.F_UL, M.F_UR, M.F_LL, M.F_LR))
    free = [s for s in 1:24 if !(s in fixed)]
    ev(l) = sum(score(evaluate(W, l, :B; beam, seed=seedst, mode)) for mode in modes)
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
if abspath(PROGRAM_FILE) == @__FILE__
    iters = parse(Int, ARGS[1]); rs = parse(Int, ARGS[2]); modes = Symbol.(split(ARGS[3], ","))
    lab = parse.(Int, split(ARGS[4], ",")); seed = parse(UInt64, ARGS[5])
    T0 = length(ARGS) >= 6 ? parse(Float64, ARGS[6]) : 1500.0
    W = buildwords(5)
    b = anneal(W, lab, seed, iters, rs, modes; T0)
    println("final ", b[1], " ", join(b[2], ','), " seed ", seed)
end
