# M/S counter search (generator side only; candidate producer, not proof
# authority). Builds on engine.jl (copied from research/hm-counter-3move).
#
# Closure notion: run-in + repeating period of full 24-sticker states. Because
# setup is excluded from the bound, the search looks for a cycle in the graph
# whose nodes are full states showing L00 and whose arcs are complete 60-edge
# counting runs with every edge within radius R. X* = greatest fixed point of
# Post on the L00 states; X* nonempty <=> an eventually periodic run exists.
using Random
include("engine.jl")

const BACKPOS = [p for p in 1:8 if !(p in CELLIDX)]

# twist of cubie c with rotation r: which home axis of the cubie points along
# +-y, with a chirality correction; verified invariant below.
function twist(c, r)
    p = POS[PIDX[c, r]]
    for a in 1:3
        n = zeros(Int, 3); n[a] = POS[c][a]
        m = ROT[r] * n
        if m[2] != 0
            # cyclic distance from home axis y(2) to a, sign by parities
            d = mod(a - 2, 3)
            par = POS[c][1] * POS[c][2] * POS[c][3]   # home parity (checked)
            return par > 0 ? d : mod(-d, 3)
        end
    end
    error("no y sticker")
end
const TW = [twist(c, r) for c in 1:8, r in 1:NR]
twsum(s::State) = mod(sum(TW[c, s[c]] for c in 1:8), 3)
function checktwist()
    rng = MersenneTwister(1)
    s = IDSTATE
    for _ in 1:20000
        s = applymove(s, rand(rng, 1:18))
        twsum(s) == 0 || error("twist invariant failed")
    end
    true
end
checktwist()

# all full states showing need
function allshowing(show, need::Target)
    opts = [Tuple{Int,Int}[] for _ in 1:4]
    for k in 1:4, c in 1:8, r in 1:NR
        PIDX[c, r] == CELLIDX[k] || continue
        need[k] == '\0' || show[c, r] == need[k] || continue
        push!(opts[k], (c, r))
    end
    out = UInt64[]
    rot = zeros(Int, 8)
    for a in opts[1], b in opts[2], c in opts[3], d in opts[4]
        cs = (a[1], b[1], c[1], d[1])
        length(unique(cs)) == 4 || continue
        rest = [x for x in 1:8 if !(x in cs)]
        fill!(rot, 0)
        for (x, y) in (a, b, c, d)
            rot[x] = y
        end
        for perm in permutations4(rest)
            # perm[i] goes to BACKPOS[i]; 3 rotations each
            rs = [[r for r in 1:NR if PIDX[perm[i], r] == BACKPOS[i]] for i in 1:4]
            for r1 in rs[1], r2 in rs[2], r3 in rs[3], r4 in rs[4]
                rot[perm[1]] = r1; rot[perm[2]] = r2; rot[perm[3]] = r3; rot[perm[4]] = r4
                s = ntuple(i -> UInt8(rot[i]), 8)
                twsum(s) == 0 && push!(out, key(s))
            end
        end
    end
    sort!(out); unique!(out)
end
function permutations4(v)
    out = Vector{Vector{Int}}()
    for i in 1:4, j in 1:4, k in 1:4, l in 1:4
        length(unique((i, j, k, l))) == 4 && push!(out, [v[i], v[j], v[k], v[l]])
    end
    out
end

# ---------------- prints ----------------
# label vector of length 24 (sticker id order): ' ' blank, 'M'/'S' letters at
# cell 2, 'a'..'f' tens 0..5 at cell 3, '0'..'9' units at cell 4.
function mkprint(lab::Vector{Char})
    g = Char[]; c = Int[]
    for x in lab
        if x == ' '
            push!(g, ' '); push!(c, 0)
        elseif x in "MS"
            push!(g, x); push!(c, 2)
        elseif x in 'a':'f'
            push!(g, Char('0' + (x - 'a'))); push!(c, 3)
        else
            push!(g, x); push!(c, 4)
        end
    end
    Print(g, c)
end
const REQUIRED = vcat(['M', 'S'], collect('a':'f'), collect('0':'9'))
const ALPH = vcat([' '], REQUIRED)
validlab(lab) = all(x -> count(==(x), lab) >= 1, REQUIRED) && count(==(' '), lab) >= 1

targets(L) = [target(L, v, true) for v in 0:59]

# ---------------- propagation ----------------
const B3 = makeball(3)
const C3 = makeclasses(B3)
const W3 = Work(C3.nwords)

# run 60 edges from set X (states showing L00); returns layers
function run60(X::Vector{UInt64}, sh, tg; b = B3, cl = C3, w = W3, cap = typemax(Int))
    layers = [X]
    for i in 1:60
        need = tg[mod(i, 60)+1]
        nxt = stepset(layers[end], sh, need, b, cl, w)
        if length(nxt) > cap
            nxt = nxt[1:cap]
        end
        push!(layers, nxt)
        isempty(nxt) && break
    end
    layers
end

# greatest fixed point; returns (Xstar, depthreached, iterations)
function fixpoint(sh, L; maxit = 200, verbose = false)
    tg = targets(L)
    X = allshowing(sh, tg[1])
    n0 = length(X)
    it = 0
    while true
        it += 1
        layers = run60(X, sh, tg)
        if length(layers) < 61 || isempty(layers[end])
            return (UInt64[], length(layers) - 1 + 60 * (it - 1), it, n0)
        end
        Y = layers[end]
        verbose && println("  it $it |X|=$(length(X)) -> $(length(Y)) minlayer=$(minimum(length.(layers)))")
        Y == X && return (X, 60 * it, it, n0)
        it >= maxit && return (Y, 60 * it, it, n0)
        X = Y
    end
end

# ---------------- annealing score ----------------
# Pass the 60 displays `passes` times; whenever the reachable set empties, count
# a break and restart from all states showing the next display. Score = breaks.
function breakscore(sh, L; passes = 3, cap = 4000)
    tg = targets(L)
    X = allshowing(sh, tg[1])
    isempty(X) && return 1000
    breaks = 0
    for p in 1:passes, i in 1:60
        need = tg[mod(i, 60)+1]
        nxt = stepset(X, sh, need, B3, C3, W3)
        if isempty(nxt)
            breaks += 1
            nxt = allshowing(sh, need)
            isempty(nxt) && return 1000
        end
        length(nxt) > cap && (nxt = nxt[1:cap])
        X = nxt
    end
    breaks
end
fullbreak(lab; passes = 3) = (sh = showtable(mkprint(lab)); breakscore(sh, 'M'; passes) + breakscore(sh, 'S'; passes))

function mutatelab(lab, rng)
    while true
        q = copy(lab)
        if rand(rng) < 0.6
            i, j = rand(rng, 1:24, 2); q[i], q[j] = q[j], q[i]
        else
            q[rand(rng, 1:24)] = rand(rng, ALPH)
        end
        q != lab && validlab(q) && return q
    end
end

function annealms(seed, iters; T0 = 3.0, init = nothing, passes = 3, log = stdout)
    rng = MersenneTwister(seed)
    lab = init === nothing ? vcat([' ', ' ', ' '], shuffle(rng, vcat(REQUIRED, [rand(rng, ALPH), rand(rng, ALPH), rand(rng, ALPH)]))) : copy(init)
    sc = fullbreak(lab; passes)
    best = (sc, copy(lab))
    for it in 1:iters
        T = T0 * (1 - it / iters) + 0.1
        it % 2000 == 0 && (println(log, "seed=$seed it=$it cur=$sc best=$(best[1])"); flush(log))
        q = mutatelab(lab, rng)
        s2 = fullbreak(q; passes)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            lab, sc = q, s2
            if sc < best[1]
                best = (sc, copy(lab))
                println(log, "seed=$seed it=$it best=$sc lab=\"$(String(lab))\""); flush(log)
                sc == 0 && break
            end
        end
    end
    best
end
