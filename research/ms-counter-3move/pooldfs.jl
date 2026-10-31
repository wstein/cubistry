# Lazy-print DFS for an exactly closed 60-edge M walk in the pool model
# (generator side only). The print is built while walking; macro distances
# (in PB3 steps) to the start state prune walks that cannot close in time.
include("pool.jl")

function macrodist()
    d = Dict{UInt64,Int8}(key(IDSTATE) => 0)
    fr = [IDSTATE]; k = 0
    while !isempty(fr)
        k += 1; nx = State[]
        for s in fr, E in PB3.elems
            t = applyelem(s, E); kt = key(t)
            haskey(d, kt) && continue
            d[kt] = k; push!(nx, t)
        end
        fr = nx
    end
    d
end
const MD = macrodist()

function basepartial()
    p = Partial()
    for i in 1:3
        p.glyph[3 * (ULC - 1) + i] = ' '; p.cell[3 * (ULC - 1) + i] = 0
    end
    lab = poollab(fill('?', 18))
    for i in 1:3
        sid = 3 * (URC - 1) + i
        g = lab[sid]
        p.glyph[sid] = g; p.cell[sid] = g == ' ' ? 0 : 2
    end
    p
end
function poolneed(p::Partial)
    have = Set((p.cell[i], p.glyph[i]) for i in 1:24 if p.glyph[i] != '\0')
    miss = count(x -> !(x in have), [(3, Char('0' + d)) for d in 0:5]) +
           count(x -> !(x in have), [(4, Char('0' + d)) for d in 0:9])
    miss, count(==('\0'), p.glyph)
end

mutable struct Ctx
    rng::MersenneTwister
    nodes::Int
    budget::Int
    best::Int
    pen::Float64
end

function dfs(ctx::Ctx, s::State, i::Int, p::Partial, words::Vector{Int}, tg)
    ctx.nodes += 1
    i - 1 > ctx.best && (ctx.best = i - 1)
    if i > 60
        return s == IDSTATE
    end
    ctx.nodes > ctx.budget && return false
    need = tg[mod(i, 60)+1]
    cands = Tuple{Float64,Int,Vector{Tuple{Int,Char,Int}}}[]
    for j in 2:length(PB3.elems)
        t = applyelem(s, PB3.elems[j])
        md = get(MD, key(t), Int8(127))
        md <= 60 - i || continue
        news = lazymatch(t, need, p)
        news === nothing && continue
        push!(cands, (length(news) * ctx.pen + rand(ctx.rng), j, news))
    end
    sort!(cands, by = first)
    for (_, j, news) in cands[1:min(end, 4)]
        q = copyp(p)
        for (sid, g, c) in news
            q.glyph[sid] = g; q.cell[sid] = c
        end
        miss, free = poolneed(q)
        miss > free && continue
        push!(words, j)
        if dfs(ctx, applyelem(s, PB3.elems[j]), i + 1, q, words, tg)
            p.glyph .= q.glyph; p.cell .= q.cell
            return true
        end
        pop!(words)
        ctx.nodes > ctx.budget && return false
    end
    false
end

function trydfs(seed, budget; pen = 1.0)
    ctx = Ctx(MersenneTwister(seed), 0, budget, 0, pen)
    p = basepartial()
    tg = targets('M')
    for (sid, g, c) in lazymatch(IDSTATE, tg[1], p)
        p.glyph[sid] = g; p.cell[sid] = c
    end
    words = Int[]
    ok = dfs(ctx, IDSTATE, 1, p, words, tg)
    ok, p, words, ctx
end
