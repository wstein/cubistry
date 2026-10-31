# Simulated annealing over complete prints, scored by exact set propagation
# (radius-3 edges, radius-4 fallback counted as bad, larger gaps penalised).
include("engine.jl")
include("construct.jl")
using Random, Serialization

const B3 = makeball(3); const B4 = makeball(4)
const C3 = makeclasses(B3); const C4 = makeclasses(B4)
const BEAM = Ref(typemax(Int))
const W3 = Work(C3.nwords); const W4 = Work(C4.nwords)

function findstart(rng, show, need; from = IDSTATE)
    s = from
    for _ in 1:300_000
        s = applymove(s, rand(rng, 1:18)); shows(s, show, need) && return s
    end
    nothing
end

# returns (bad, gaps, minsize) for a chain from start s; chord index optional
function chainscore(s, targets, sh; chord = nothing)
    bad = 0; gaps = 0; minsz = typemax(Int)
    R = UInt64[key(s)]; sk = key(s)
    near3 = chord === nothing ? UInt64[] : neighborsof(s, B3)
    for i in 2:length(targets)+1
        need = i <= length(targets) ? targets[i] : targets[1]
        nxt = stepset(R, sh, need, B3, C3, W3)
        last = i == length(targets) + 1
        last && (nxt = insorted(nxt, sk) ? UInt64[sk] : UInt64[])
        if isempty(nxt)
            nxt = stepset(R, sh, need, B4, C4, W4)
            last && (nxt = insorted(nxt, sk) ? UInt64[sk] : UInt64[])
            if isempty(nxt)
                gaps += 1
                last && break
                t = findstart(MersenneTwister(i), sh, need; from = unkey(R[1]))
                t === nothing && return (bad, gaps + 100, 0)
                nxt = UInt64[key(t)]
            else
                bad += 1
            end
        end
        if chord !== nothing && i == chord
            f = filter(k -> insorted(near3, k), nxt)
            isempty(f) ? (bad += 1) : (nxt = f)
        end
        minsz = min(minsz, length(nxt))
        if length(nxt) > BEAM[]
            nxt = sort!(shuffle(MersenneTwister(i), nxt)[1:BEAM[]])
        end
        R = nxt
    end
    (bad, gaps, minsz)
end

mtargets(blank) = [target('M', v, blank) for v in 0:59]
htargets(blank) = [target('H', v, blank) for v in 0:23]

# can the cells of need be filled by distinct cubies (sticker capacity only)?
function realizable(pr::Print, need::Target)
    opts = [Int[] for _ in 1:4]
    ks = [k for k in 1:4 if need[k] != '\0']
    for k in ks
        for sid in 1:24
            g = pr.glyph[sid]
            if g == need[k] && (g == ' ' || pr.cell[sid] == k)
                push!(opts[k], (sid - 1) ÷ 3 + 1)
            end
        end
        isempty(opts[k]) && return false
    end
    for combo in Iterators.product((opts[k] for k in ks)...)
        length(unique(combo)) == length(ks) && return true
    end
    false
end

function fullscore(pr::Print, blank; withH = true)
    tall = vcat(mtargets(blank), withH ? htargets(blank) : Target[])
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1000.0 * nbad, (:unrealizable, nbad))
    sh = showtable(pr)
    tm = mtargets(blank)
    sm = findstart(MersenneTwister(7), sh, tm[1])
    sm === nothing && return (1e9, nothing)
    bm, gm, zm = chainscore(sm, tm, sh)
    sc = 10.0 * bm + 40.0 * gm - 0.5 * log(max(zm, 1))
    if withH
        th = htargets(blank)
        shh = findstart(MersenneTwister(8), sh, th[1])
        shh === nothing && return (1e9, nothing)
        bh, gh, zh = chainscore(shh, th, sh; chord = 12)
        sc += 10.0 * bh + 40.0 * gh - 0.5 * log(max(zh, 1))
        return (sc, (bm, gm, bh, gh, zm, zh))
    end
    (sc, (bm, gm, zm))
end

function covered(pr::Print, blank)
    have = Set((pr.cell[i], pr.glyph[i]) for i in 1:24)
    all(x -> x in have, required_pairs(blank))
end
function mutate(pr::Print, rng, blank)
    while true
        g = copy(pr.glyph); c = copy(pr.cell)
        r = rand(rng)
        if r < 0.4
            i, j = rand(rng, 1:24, 2)
            g[i], g[j] = g[j], g[i]; c[i], c[j] = c[j], c[i]
        else
            i = rand(rng, 1:24)
            t = rand(rng, blank ? (1:4) : (1:3))
            if t == 1; g[i] = rand(rng, "HM"); c[i] = 2
            elseif t == 2; g[i] = Char('0' + rand(rng, 0:5)); c[i] = 3
            elseif t == 3; g[i] = Char('0' + rand(rng, 0:9)); c[i] = 4
            else g[i] = ' '; c[i] = 0 end
        end
        q = Print(g, c)
        covered(q, blank) && return q
    end
end

function anneal(blank, seed, iters, out; T0 = 6.0, init = nothing)
    rng = MersenneTwister(seed)
    pr = init === nothing ? complete(dfs_partial(seed, blank, 20000; b = B3)[2], blank, rng) : init
    sc, info = fullscore(pr, blank)
    best = (sc, pr, info)
    println("init score=$sc info=$info"); flush(stdout)
    for it in 1:iters
        T = T0 * (1 - it / iters) + 0.05
        q = mutate(pr, rng, blank)
        s2, i2 = fullscore(q, blank)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pr, sc, info = q, s2, i2
            if sc < best[1]
                best = (sc, pr, info)
                serialize(out, best)
                println("it=$it best=$(round(sc,digits=2)) info=$info"); flush(stdout)
            end
        end
        it % 50 == 0 && (println("it=$it cur=$(round(sc,digits=2)) T=$(round(T,digits=2))"); flush(stdout))
    end
    best
end

if abspath(PROGRAM_FILE) == @__FILE__
    blank = ARGS[1] == "blank"; seed = parse(Int, ARGS[2]); iters = parse(Int, ARGS[3])
    init = length(ARGS) >= 5 && ARGS[5] != "-" ? deserialize(ARGS[5])[2] : nothing
    length(ARGS) >= 6 && (BEAM[] = parse(Int, ARGS[6]))
    anneal(blank, seed, iters, ARGS[4]; init = init)
end
