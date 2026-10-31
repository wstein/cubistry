# Annealing on the EXACT max-K reach: for a print, enumerate all legal full states showing
# value 0 and propagate with words <= K HTM (no beam) for two laps (200 displays).
# Score = layers survived (+ small bonus for slack). 201 means two full laps survive.
# Usage: julia c99_reach.jl ITERS RNGSEED MODES(lz | lz,nz) INIT_LABELS K MINBLANKS
include(joinpath(@__DIR__, "exact.jl"))
using Random
function reach(W, lab, mode, K)
    layer = allstates(lab, 0, mode); out = Tuple{UInt64,Int32}[]; slack = 0.0
    for i in 1:200
        nxt = Set{UInt64}()
        for st in layer
            succ!(out, W, lab, st, i % 100, :B, K, mode)
            for (ns, _) in out; push!(nxt, ns); end
        end
        isempty(nxt) && return i + slack / 1000i
        slack += log(length(nxt)); layer = nxt
    end
    201.0
end
valid(lab, minb) = count(==(BLANK), lab) >= minb && all(d -> tens(d) in lab && units(d) in lab, 0:9)
function run(W, lab, iters, rs, modes, K, minb; T0=2.0, T1=0.02)
    rng = MersenneTwister(rs)
    ev(l) = sum(reach(W, l, m, K) for m in modes)
    cur = ev(lab); best = (cur, copy(lab)); println("start $cur"); flush(stdout)
    alphabet = vcat([BLANK], tens.(0:9), units.(0:9))
    for it in 1:iters
        T = T0 * (T1 / T0)^(it / iters)
        old = copy(lab)
        if rand(rng) < 0.8
            i, j = rand(rng, 1:24, 2); lab[i] == lab[j] && continue; lab[i], lab[j] = lab[j], lab[i]
        else
            i = rand(rng, 1:24); lab[i] = rand(rng, alphabet); valid(lab, minb) || (lab .= old; continue)
        end
        s = ev(lab)
        if s >= cur || rand(rng) < exp((s - cur) / T)
            cur = s; s > best[1] && (best = (s, copy(lab)); println("it $it best $s lab $(join(lab, ','))"); flush(stdout))
        else
            lab .= old
        end
        best[1] >= 201length(modes) && break
    end
    best
end
if abspath(PROGRAM_FILE) == @__FILE__
    iters = parse(Int, ARGS[1]); rs = parse(Int, ARGS[2]); modes = Symbol.(split(ARGS[3], ","))
    lab = parse.(Int, split(ARGS[4], ",")); K = parse(Int, ARGS[5]); minb = parse(Int, ARGS[6])
    W = buildwords(K)
    b = run(W, lab, iters, rs, modes, K, minb)
    println("final ", b[1], " ", join(b[2], ','))
end
