# Lazy-print randomized DFS: builds a candidate print and open walks for the
# M chain (00..59, then 00) and the H chain (00..23, then 00). The exact
# closed-walk check is done afterwards by set propagation (solve.jl).
using Random

function required_pairs(blank::Bool)
    req = Set{Tuple{Int,Char}}()
    for x in "HM"; push!(req, (2, x)); end
    for d in 0:5; push!(req, (3, Char('0' + d))); end
    for d in 0:9; push!(req, (4, Char('0' + d))); end
    blank && push!(req, (0, ' '))
    req
end
function missingcount(p::Partial, req)
    have = Set{Tuple{Int,Char}}()
    for i in 1:24
        p.glyph[i] == '\0' || push!(have, (p.cell[i], p.glyph[i]))
    end
    count(x -> !(x in have), req), count(==('\0'), p.glyph)
end

mutable struct DFSCtx
    rng::MersenneTwister
    b::Ball
    req::Set{Tuple{Int,Char}}
    nodes::Int
    budget::Int
    newpenalty::Float64
    maxdepth::Int
end

# targets[1] already shown by s; walk targets[2..end]
function dfs!(ctx::DFSCtx, s::State, targets, i, p::Partial, words, states)
    i > length(targets) && return true
    ctx.nodes += 1
    i > ctx.maxdepth && (ctx.maxdepth = i)
    ctx.nodes > ctx.budget && return false
    need = targets[i]
    cands = Tuple{Float64,Int,Vector{Tuple{Int,Char,Int}}}[]
    for (j, E) in enumerate(ctx.b.elems)
        j == 1 && continue
        t = applyelem(s, E)
        news = lazymatch(t, need, p)
        news === nothing && continue
        push!(cands, (length(news) * ctx.newpenalty + ctx.b.len[j] + rand(ctx.rng), j, news))
    end
    sort!(cands, by = first)
    for (_, j, news) in cands[1:min(end, 6)]
        q = copyp(p)
        for (sid, g, c) in news
            q.glyph[sid] = g; q.cell[sid] = c
        end
        miss, free = missingcount(q, ctx.req)
        miss > free && continue
        t = applyelem(s, ctx.b.elems[j])
        push!(words, j); push!(states, t)
        if dfs!(ctx, t, targets, i + 1, q, words, states)
            p.glyph .= q.glyph; p.cell .= q.cell
            return true
        end
        pop!(words); pop!(states)
        ctx.nodes > ctx.budget && return false
    end
    false
end

# best partial print reached by the DFS (deepest prefix), for seeding
function dfs_partial(seed, blank, budget; b = makeball(3))
    rng = MersenneTwister(seed)
    best = Ref((0, Partial()))
    ctx = DFSCtx(rng, b, required_pairs(blank), 0, budget, 1.5, 0)
    tg = [target('M', v, blank) for v in 0:59]; push!(tg, tg[1])
    p = Partial()
    for (sid, g, c) in lazymatch(IDSTATE, tg[1], p)
        p.glyph[sid] = g; p.cell[sid] = c
    end
    dfs_track!(ctx, IDSTATE, tg, 2, p, best)
    best[]
end
function dfs_track!(ctx, s, targets, i, p, best)
    i > best[][1] && (best[] = (i, copyp(p)))
    i > length(targets) && return true
    ctx.nodes += 1
    ctx.nodes > ctx.budget && return false
    need = targets[i]
    cands = Tuple{Float64,Int,Vector{Tuple{Int,Char,Int}}}[]
    for (j, E) in enumerate(ctx.b.elems)
        j == 1 && continue
        news = lazymatch(applyelem(s, E), need, p)
        news === nothing && continue
        push!(cands, (length(news) * ctx.newpenalty + ctx.b.len[j] + rand(ctx.rng), j, news))
    end
    sort!(cands, by = first)
    for (_, j, news) in cands[1:min(end, 6)]
        q = copyp(p)
        for (sid, g, c) in news
            q.glyph[sid] = g; q.cell[sid] = c
        end
        miss, free = missingcount(q, ctx.req)
        miss > free && continue
        dfs_track!(ctx, applyelem(s, ctx.b.elems[j]), targets, i + 1, q, best) && return true
        ctx.nodes > ctx.budget && return false
    end
    false
end

# complete a partial print: cover missing required pairs, then random extras
function complete(p::Partial, blank, rng)
    g = copy(p.glyph); c = copy(p.cell)
    free = shuffle(rng, findall(==('\0'), g))
    have = Set((c[i], g[i]) for i in 1:24 if g[i] != '\0')
    for (cell, gl) in sort(collect(required_pairs(blank)))
        (cell, gl) in have && continue
        i = pop!(free); g[i] = gl; c[i] = cell
    end
    for i in free
        r = rand(rng, 1:3)
        if r == 1; g[i] = rand(rng, "HM"); c[i] = 2
        elseif r == 2; g[i] = Char('0' + rand(rng, 0:5)); c[i] = 3
        else g[i] = Char('0' + rand(rng, 0:9)); c[i] = 4 end
    end
    Print(g, c)
end
