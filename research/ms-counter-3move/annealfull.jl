# Simulated annealing over unrestricted 24-sticker prints scored in the full
# model (M weight + S weight per cycle; 1000 per 4-HTM edge + HTM).
# Generator side only.
include("fullvi.jl")

function fullscore(lab; K = 10)
    validlab(lab) || return 10^9
    sh = showtable(mkprint(lab))
    sc = 0
    for L in "MS"
        G = buildfull(sh, L)
        any(isempty, G.layers) && return 10^9
        f, mins, _ = valueiter(G, K)
        (length(mins) < K || mins[end] >= INF) && return 10^9
        sc += (mins[K] - mins[K-4]) ÷ 4
    end
    sc
end

function annealfull(seed, iters, init; T0 = 1500.0, log = stdout)
    rng = MersenneTwister(seed)
    lab = copy(init)
    sc = fullscore(lab); best = (sc, copy(lab))
    println(log, "seed=$seed init=$sc lab=\"$(String(lab))\""); flush(log)
    for it in 1:iters
        T = T0 * (1 - it / iters) + 5
        q = mutatelab(lab, rng)
        s2 = fullscore(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            lab, sc = q, s2
            if sc < best[1]
                best = (sc, copy(lab))
                println(log, "seed=$seed it=$it best=$sc lab=\"$(String(lab))\""); flush(log)
            end
        end
        it % 100 == 0 && (println(log, "seed=$seed it=$it cur=$sc best=$(best[1])"); flush(log))
    end
    best
end

if abspath(PROGRAM_FILE) == @__FILE__
    seed = parse(Int, ARGS[1]); iters = parse(Int, ARGS[2])
    init = length(ARGS[3]) == 18 ? poollab(collect(ARGS[3])) : collect(ARGS[3])
    annealfull(seed, iters, init)
end
