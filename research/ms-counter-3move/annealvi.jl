# Simulated annealing over pool prints scored by the minimum mean weight per
# 60-edge cycle (1000 per 4-HTM edge + HTM). Generator side only.
include("vi.jl")

function viscore(pool; K = 10)
    validpool(pool) || return 10^9
    sh = showtable(mkprint(poollab(pool)))
    G = buildlayered(sh, 'M')
    any(isempty, G.layers) && return 10^9
    f, mins, _ = valueiter(G, K)
    (length(mins) < K || mins[end] >= INF) && return 10^9
    (mins[K] - mins[K-4]) ÷ 4
end

function annealvi(seed, iters; T0 = 800.0, init = nothing, log = stdout)
    rng = MersenneTwister(seed)
    pool = init === nothing ? vcat(shuffle(rng, collect('a':'f')), shuffle(rng, vcat(collect('0':'9'), [rand(rng, PALPH), rand(rng, PALPH)]))) : collect(init)
    sc = viscore(pool); best = (sc, copy(pool))
    println(log, "seed=$seed init=$sc pool=\"$(String(pool))\""); flush(log)
    for it in 1:iters
        T = T0 * (1 - it / iters) + 5
        q = copy(pool)
        while true
            q = copy(pool)
            r = rand(rng)
            if r < 0.6
                i, j = rand(rng, 1:18, 2); q[i], q[j] = q[j], q[i]
            elseif r < 0.8
                c1, c2 = rand(rng, 0:5, 2)   # swap two whole corners' rotation
                i = 3c1 .+ (1:3); q[i] = q[circshift(collect(i), 1)]
            else
                q[rand(rng, 1:18)] = rand(rng, PALPH)
            end
            q != pool && validpool(q) && break
        end
        s2 = viscore(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pool, sc = q, s2
            if sc < best[1]
                best = (sc, copy(pool))
                println(log, "seed=$seed it=$it best=$sc pool=\"$(String(pool))\""); flush(log)
            end
        end
        it % 500 == 0 && (println(log, "seed=$seed it=$it cur=$sc best=$(best[1])"); flush(log))
    end
    best
end

if abspath(PROGRAM_FILE) == @__FILE__
    seed = parse(Int, ARGS[1]); iters = parse(Int, ARGS[2])
    init = length(ARGS) >= 3 ? ARGS[3] : nothing
    annealvi(seed, iters; init = init)
end
