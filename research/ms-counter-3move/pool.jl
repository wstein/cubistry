# Pool model (generator side only). Design restriction used by the search:
#   - one corner carries three blank stickers and stays at the upper-left
#     position (it may twist in place: every face is blank);
#   - one corner carries M and S (both printed upright for the upper-right
#     cell) and never leaves the upper-right position untwisted;
#   - the other six corners ("pool": LL, LR and the four back positions) carry
#     the six tens, ten units and two spare stickers.
# Edges are restricted to ball elements that fix the UR corner exactly and keep
# the UL corner in place. M and S runs then have identical pool dynamics: the S
# run is the M run with the letter corner turned to show S.
include("ms.jl")

const ULC = findfirst(c -> PIDX[c, 1] == CELLIDX[1], 1:8)
const URC = findfirst(c -> PIDX[c, 1] == CELLIDX[2], 1:8)
const POOLC = [c for c in 1:8 if c != ULC && c != URC]
poolsids() = vcat([3 * (c - 1) .+ (1:3) for c in POOLC]...)

function restrictball(b::Ball)
    keep = Int[]
    for (i, E) in enumerate(b.elems)
        at = cubieat(E)
        at[CELLIDX[2]] == CELLIDX[2] && E[at[CELLIDX[2]]] == 1 || continue
        at[CELLIDX[1]] == CELLIDX[1] || continue
        push!(keep, i)
    end
    Ball(b.elems[keep], b.words[keep], b.len[keep])
end
const PB3 = restrictball(B3)
const PC3 = makeclasses(PB3)
const PW3 = Work(PC3.nwords)

# full label vector from an 18-label pool assignment (pool sticker order)
function poollab(pool::Vector{Char})
    lab = fill(' ', 24)
    for (j, sid) in enumerate(poolsids())
        lab[sid] = pool[j]
    end
    # letter corner: M on the sticker facing front at home, S on another face
    lab[3 * (URC - 1) + 3] = 'M'   # home axis z faces front at UR
    lab[3 * (URC - 1) + 1] = 'S'   # home axis x (turned to front for the S run)
    lab
end
const PREQ = vcat(collect('a':'f'), collect('0':'9'))
const PALPH = vcat([' '], PREQ)
validpool(p) = all(x -> count(==(x), p) >= 1, PREQ)

# start sets: states with UL corner in place, UR corner identity
function poolstart(sh, L)
    X = allshowing(sh, target(L, 0, true))
    filter(k -> (s = unkey(k); PIDX[ULC, s[ULC]] == CELLIDX[1] && s[URC] == 1), X)
end

function poolfix(pool; maxit = 400)
    sh = showtable(mkprint(poollab(pool)))
    tg = targets('M')
    X = poolstart(sh, 'M')
    depth = 0
    for it in 1:maxit
        R = X
        for i in 1:60
            R = stepset(R, sh, tg[mod(i, 60)+1], PB3, PC3, PW3)
            isempty(R) && return (UInt64[], depth + i - 1, it)
        end
        depth += 60
        R == X && return (X, depth, it)
        X = R
    end
    (X, depth, maxit)
end

function poolbreaks(pool; passes = 2)
    sh = showtable(mkprint(poollab(pool)))
    tg = targets('M')
    X = poolstart(sh, 'M')
    isempty(X) && return 1000
    b = 0
    for p in 1:passes, i in 1:60
        need = tg[mod(i, 60)+1]
        nxt = stepset(X, sh, need, PB3, PC3, PW3)
        if isempty(nxt)
            b += 1
            nxt = filter(k -> (s = unkey(k); PIDX[ULC, s[ULC]] == CELLIDX[1] && s[URC] == 1), allshowing(sh, need))
            isempty(nxt) && return 1000
        end
        X = nxt
    end
    b
end

function poolanneal(seed, iters; T0 = 2.0, log = stdout)
    rng = MersenneTwister(seed)
    pool = shuffle(rng, vcat(PREQ, [rand(rng, PALPH), rand(rng, PALPH)]))
    sc = poolbreaks(pool); best = (sc, copy(pool))
    for it in 1:iters
        T = T0 * (1 - it / iters) + 0.05
        q = copy(pool)
        while true
            q = copy(pool)
            if rand(rng) < 0.7
                i, j = rand(rng, 1:18, 2); q[i], q[j] = q[j], q[i]
            else
                q[rand(rng, 1:18)] = rand(rng, PALPH)
            end
            q != pool && validpool(q) && break
        end
        s2 = poolbreaks(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pool, sc = q, s2
            if sc < best[1]
                best = (sc, copy(pool))
                println(log, "seed=$seed it=$it best=$sc pool=\"$(String(pool))\""); flush(log)
            end
            if sc == 0
                f = poolfix(pool)
                println(log, "  zero-break pool \"$(String(pool))\" fix depth=$(f[2]) |X*|=$(length(f[1])) it=$(f[3])"); flush(log)
                isempty(f[1]) || return (0, pool, f)
            end
        end
        it % 1000 == 0 && (println(log, "seed=$seed it=$it cur=$sc best=$(best[1])"); flush(log))
    end
    best
end
