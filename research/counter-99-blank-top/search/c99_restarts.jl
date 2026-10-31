# Reheating driver for c99_reach.jl: each round restarts annealing from the best print so far.
# Usage: julia c99_restarts.jl SECONDS MODES K MINBLANKS FIRSTSEED INIT
include(joinpath(@__DIR__, "c99_reach.jl"))
function main()
    secs = parse(Float64, ARGS[1]); modes = Symbol.(split(ARGS[2], ",")); K = parse(Int, ARGS[3]); minb = parse(Int, ARGS[4])
    seed = parse(Int, ARGS[5]); W = buildwords(K); t0 = time(); best = (0.0, parse.(Int, split(ARGS[6], ",")))
    while time() - t0 < secs
        rng = MersenneTwister(seed)
        lab = length(ARGS) >= 6 && seed == parse(Int, ARGS[5]) ? parse.(Int, split(ARGS[6], ",")) :
              copy(best[2])
        b = run(W, lab, 3000, seed, modes, K, minb; T0=4.0, T1=0.05)
        println("restart seed $seed result $(b[1]) lab $(join(b[2], ','))"); flush(stdout)
        b[1] > best[1] && (best = b)
        best[1] >= 201length(modes) && break
        seed += 1
    end
    println("final ", best[1], " ", join(best[2], ','))
end
main()
