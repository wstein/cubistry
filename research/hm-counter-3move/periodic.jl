# Blank profile with run-in + period closure (candidate producer only).
#
# Mode = (letter, range): M 00..59, H 00..23, H 00..11 (the 11->00 reset).
# A mode's up run is a walk 00 -> 01 -> ... -> range -> 00 -> ... in full cube
# states; it closes when a full state at display 00 repeats. The period is a
# closed cycle of k laps; decrement = exact inverse traversal of that cycle.
include("anneal.jl")

const MODES = (('M', 59), ('H', 23), ('H', 11))
laptargets(L, r) = [target(L, v, true) for v in 0:r]

# greedy open propagation over `laps` laps; returns (bad4, gaps)
function openscore(s, L, r, sh; laps = 2)
    tg = laptargets(L, r); n = r + 1
    R = UInt64[key(s)]; bad = 0; gaps = 0
    for step in 1:laps*n
        need = tg[step % n + 1]
        nxt = stepset(R, sh, need, B3, C3, W3)
        if isempty(nxt)
            nxt = stepset(R, sh, need, B4, C4, W4)
            if isempty(nxt)
                gaps += 1
                t = findstart(MersenneTwister(step), sh, need; from = unkey(R[1]))
                t === nothing && return (bad, gaps + 100)
                nxt = UInt64[key(t)]
            else
                bad += 1
            end
        end
        if length(nxt) > BEAM[]
            nxt = sort!(shuffle(MersenneTwister(step), nxt)[1:BEAM[]])
        end
        R = nxt
    end
    (bad, gaps)
end

function periodicscore(pr::Print)
    tall = vcat([laptargets(L, r) for (L, r) in MODES]...)
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1000.0 * nbad, (:unrealizable, nbad))
    sh = showtable(pr)
    sc = 0.0; info = Int[]
    for (mi, (L, r)) in enumerate(MODES)
        s = findstart(MersenneTwister(100 + mi), sh, target(L, 0, true))
        s === nothing && return (1e9, nothing)
        b, g = openscore(s, L, r, sh)
        sc += 10b + 40g; push!(info, b, g)
    end
    (sc, Tuple(info))
end

function annealp(seed, iters, out, init; T0 = 4.0)
    rng = MersenneTwister(seed)
    pr = init
    sc, info = periodicscore(pr)
    best = (sc, pr, info)
    println("init score=$sc info=$info"); flush(stdout)
    for it in 1:iters
        T = T0 * (1 - it / iters) + 0.05
        q = mutate(pr, rng, true)
        s2, i2 = periodicscore(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pr, sc, info = q, s2, i2
            if sc < best[1]
                best = (sc, pr, info)
                open(out, "w") do io
                    println(io, join([string(pr.glyph[i] == ' ' ? '_' : pr.glyph[i], pr.cell[i]) for i in 1:24], " "))
                end
                println("it=$it best=$sc info=$info"); flush(stdout)
                sc == 0 && break
            end
        end
        it % 100 == 0 && (println("it=$it cur=$sc"); flush(stdout))
    end
    best
end

function readprinttxt(path)
    toks = split(strip(read(path, String)))
    Print([t[1] == '_' ? ' ' : t[1] for t in toks], [parse(Int, t[2:end]) for t in toks])
end

if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "anneal"
    BEAM[] = 2000
    annealp(parse(Int, ARGS[2]), parse(Int, ARGS[3]), ARGS[4], readprinttxt(ARGS[5]))
end

# ---------------- lap graph and cycle extraction ----------------
const BALLS = Any[B3, B4]; const CLS = Any[C3, C4]; const WORKS = Any[W3, W4]
function enable5!()
    b5 = makeball(5); c5 = makeclasses(b5)
    push!(BALLS, b5); push!(CLS, c5); push!(WORKS, Work(c5.nwords))
end
# edge cost: HTM + 1000 per edge beyond 3 HTM (lexicographic: max first)
const PEN4 = parse(Int, get(ENV, "HM_PEN4", "1000"))
edgecost(len) = len + (len > 3 ? PEN4 : 0) + (len > 4 ? 1_000_000 : 0)

# one lap from state a (showing 00): layers of Dict(state => min cost)
function lap(a::State, L, r, sh)
    tg = laptargets(L, r); n = r + 1
    layers = [Dict(key(a) => 0)]
    for step in 1:n
        need = tg[step % n + 1]
        nxt = Dict{UInt64,Int}()
        for bi in 2:length(BALLS)
            b = BALLS[bi]
            for (k, c) in layers[end]
                st = unkey(k)
                foreachhit(st, sh, need, CLS[bi], WORKS[bi]) do j
                    j <= length(b.elems) || return
                    t = key(applyelem(st, b.elems[j])); v = c + edgecost(b.len[j])
                    get(nxt, t, typemax(Int)) > v && (nxt[t] = v)
                end
            end
            isempty(nxt) || break
        end
        isempty(nxt) && return nothing
        push!(layers, nxt)
    end
    layers
end

# backtrack words of a lap from a to b (b in last layer)
function lapwords(layers, b::UInt64)
    n = length(layers) - 1
    words = Vector{Vector{Int}}(undef, n)
    cur = unkey(b); cc = layers[end][b]
    for i in n:-1:1
        found = false
        for bl in BALLS, w in bl.words
            p = applyword(cur, reverse([invmove(m) for m in w]))
            c = get(layers[i], key(p), -1)
            if c >= 0 && c + edgecost(length(w)) == cc
                words[i] = w; cur = p; cc = c; found = true; break
            end
        end
        found || error("lap backtrack failed")
    end
    words
end

# explore lap graph from s0; returns best cycle as (preperiod node path, cycle node path)
function findcycle(s0::State, L, r, sh; maxnodes = parse(Int, get(ENV, "HM_NODES", "300")))
    succ = Dict{UInt64,Dict{UInt64,Int}}()
    order = [key(s0)]; i = 1
    while i <= length(order) && length(order) <= maxnodes
        a = order[i]; i += 1
        ls = lap(unkey(a), L, r, sh)
        d = ls === nothing ? Dict{UInt64,Int}() : ls[end]
        succ[a] = d
        for b in keys(d)
            haskey(succ, b) || b in order || push!(order, b)
        end
    end
    # best simple cycle by (mean lap cost) among short cycles: BFS per node
    best = nothing
    nodes = collect(keys(succ))
    for a in nodes
        # Dijkstra-free: BFS over laps up to depth 6 tracking cost
        frontier = Dict(a => (0, [a]))
        for depth in 1:6
            nf = Dict{UInt64,Tuple{Int,Vector{UInt64}}}()
            for (x, (c, path)) in frontier
                haskey(succ, x) || continue
                for (y, w) in succ[x]
                    nc = c + w
                    if y == a
                        q = (nc / depth, depth)
                        (best === nothing || q < best[1]) && (best = (q, path))
                    elseif !(y in path) && (get(nf, y, (typemax(Int), UInt64[]))[1] > nc)
                        nf[y] = (nc, vcat(path, y))
                    end
                end
            end
            frontier = nf
            isempty(frontier) && break
        end
    end
    best === nothing && return nothing
    cyc = best[2]
    # preperiod: BFS path from s0 to any cycle node
    parent = Dict(key(s0) => key(s0)); q = [key(s0)]; h = 1; hit = nothing
    while h <= length(q)
        x = q[h]; h += 1
        if x in cyc
            hit = x; break
        end
        for y in keys(get(succ, x, Dict{UInt64,Int}()))
            haskey(parent, y) || (parent[y] = x; push!(q, y))
        end
    end
    pre = [hit]
    while pre[1] != key(s0)
        pushfirst!(pre, parent[pre[1]])
    end
    k = findfirst(==(hit), cyc)
    cyc = vcat(cyc[k:end], cyc[1:k-1])
    (pre = pre, cyc = cyc, quality = best[1], nodes = length(succ))
end

# ---------------- v2 witness writer ----------------
# minimum HTM (<= 4) from s to any state showing need; 99 if none
function lowerbound2(s::State, need::Target, show, b::Ball)
    for (i, E) in enumerate(b.elems)
        shows(applyelem(s, E), show, need) && return b.len[i]
    end
    99
end

function homeup2(sid, cell)
    c = (sid - 1) ÷ 3 + 1; a = (sid - 1) % 3 + 1
    n = zeros(Int, 3); n[a] = POS[c][a]
    for r in 1:NR
        ROT[r]' * [0, 0, 1] == n && mulv(ROT[r], POS[c]) == CELLPOS[cell] && return ROT[r]' * [0, 1, 0]
    end
    error("no frame")
end

function modecycle(s, L, r, sh)
    fc = findcycle(s, L, r, sh)
    fc === nothing && return nothing
    laps = Tuple{UInt64,UInt64}[]
    for i in 1:length(fc.pre)-1
        push!(laps, (fc.pre[i], fc.pre[i+1]))
    end
    P = length(laps)
    c = fc.cyc
    for i in 1:length(c)
        push!(laps, (c[i], c[i % length(c) + 1]))
    end
    words = Vector{Vector{Int}}()
    for (a, b) in laps
        append!(words, lapwords(lap(unkey(a), L, r, sh), b))
    end
    (P = P * (r + 1), Q = length(c) * (r + 1), words = words, quality = fc.quality)
end

function writeperiodic(printfile, out; mstarts = 6)
    pr = readprinttxt(printfile); sh = showtable(pr)
    best = nothing
    for t in 1:mstarts
        s = findstart(MersenneTwister(200 + t), sh, target('M', 0, true))
        s === nothing && continue
        mc = modecycle(s, 'M', 59, sh)
        mc === nothing && continue
        println("M start $t quality $(mc.quality) P=$(mc.P) Q=$(mc.Q)"); flush(stdout)
        (best === nothing || (mc.quality, mc.P) < (best[2].quality, best[2].P)) && (best = (s, mc))
    end
    best === nothing && error("no M cycle")
    sM, mcM = best
    modes = Any[('M', 59, Int[], mcM, sM)]
    for (L, r) in (('H', 23), ('H', 11))
        hb = nothing
        cnt = 0
        cands = [(B4.words[i], applyelem(sM, E)) for (i, E) in enumerate(B4.elems)]
        rngH = MersenneTwister(300)
        for _ in 1:40
            E1 = rand(rngH, 2:length(B4.elems)); x = applyelem(sM, B4.elems[E1])
            for (j, E2) in enumerate(B4.elems)
                push!(cands, (vcat(B4.words[E1], B4.words[j]), applyelem(x, E2)))
            end
        end
        for (wd, s) in cands
            shows(s, sh, target(L, 0, true)) || continue
            cnt += 1; cnt > parse(Int, get(ENV, "HM_HSTARTS", "15")) && break
            mc = modecycle(s, L, r, sh)
            mc === nothing && continue
            q = (mc.quality, length(wd))
            (hb === nothing || q < hb[1]) && (hb = (q, wd, mc, s))
        end
        hb === nothing && error("no $L$r cycle")
        println("$L$r quality $(hb[1]) P=$(hb[3].P) Q=$(hb[3].Q)"); flush(stdout)
        push!(modes, (L, r, hb[2], hb[3], hb[4]))
    end
    io = IOBuffer()
    println(io, "cubistry.hm-counter.v2"); println(io, "profile\tblank"); println(io, "letters\tHM")
    for sid in 1:24
        c = (sid - 1) ÷ 3 + 1; a = (sid - 1) % 3 + 1
        R = ROT[sM[c]]; n = zeros(Int, 3); n[a] = POS[c][a]
        uh = pr.glyph[sid] == ' ' ? (a == 1 ? [0, 1, 0] : [1, 0, 0]) : homeup2(sid, pr.cell[sid])
        println(io, "sticker\t", sid - 1, "\t", c - 1, "\t", join(R * collect(POS[c]), ","), "\t",
                join(R * n, ","), "\t", join(R * uh, ","), "\t", pr.glyph[sid] == ' ' ? "_" : string(pr.glyph[sid]))
    end
    wtxt(w) = isempty(w) ? "-" : join(MOVENAMES[w], " ")
    mx = 0
    for (L, r, setup, mc, s) in modes
        println(io, "mode\t$L\t$r\t$(wtxt(setup))\t$(mc.P)\t$(mc.Q)")
        st = s; n = r + 1
        for (j, w) in enumerate(mc.words)
            v = (j - 1) % n; nv = (v + 1) % n
            lb = lowerbound2(st, target(L, nv, true), sh, BALLS[end])
            println(io, "step\t$L\t$r\t$v\t$nv\t$(wtxt(w))\t$lb")
            mx = max(mx, length(w))
            st = applyword(st, w)
        end
    end
    println(io, "claim\tmaxEdgeHTM\t$mx"); println(io, "end")
    write(out, take!(io)); println("wrote $out")
end

if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "write"
    get(ENV, "HM_B5", "") == "1" && enable5!()
    writeperiodic(ARGS[2], ARGS[3])
end

# exact min-cost single lap from a sampled start per mode (SA objective v2):
# 10 per edge beyond 3 HTM (within radius 4), 40 per lap that needs more.
function lapobjective(pr::Print)
    tall = vcat([laptargets(L, r) for (L, r) in MODES]...)
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1000.0 * nbad, (:unrealizable, nbad))
    sh = showtable(pr)
    sc = 0.0; info = Int[]
    for (mi, (L, r)) in enumerate(MODES)
        s = findstart(MersenneTwister(100 + mi), sh, target(L, 0, true))
        s === nothing && return (1e9, nothing)
        ls = lap(s, L, r, sh)
        if ls === nothing
            sc += 40 + 10 * openscore(s, L, r, sh; laps = 1)[1]; push!(info, -1)
        else
            c = minimum(values(ls[end])); nb = c ÷ 1000
            sc += 10nb + 0.001 * (c % 1000); push!(info, nb)
        end
    end
    (sc, Tuple(info))
end

if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "anneal2"
    BEAM[] = 2000
    @eval periodicscore(pr::Print) = lapobjective(pr)
    annealp(parse(Int, ARGS[2]), parse(Int, ARGS[3]), ARGS[4], readprinttxt(ARGS[5]))
end

# SA objective v3: per-mode best cycle quality (mean cost per lap, HTM plus
# 10^6 per edge above 4 HTM and HM_PEN4 per edge above 3) over two sampled
# starts, summed over modes.
function cycleobjective(pr::Print)
    tall = vcat([laptargets(L, r) for (L, r) in MODES]...)
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1e9 * nbad, (:unrealizable, nbad))
    sh = showtable(pr)
    sc = 0.0; info = Float64[]
    for (mi, (L, r)) in enumerate(MODES)
        best = Inf
        for t in 1:2
            s = findstart(MersenneTwister(100 + 10mi + t), sh, target(L, 0, true))
            s === nothing && continue
            fc = findcycle(s, L, r, sh; maxnodes = 30)
            fc === nothing || (best = min(best, fc.quality[1]))
        end
        best == Inf && (best = 1e8)
        sc += best; push!(info, best)
    end
    (sc, Tuple(info))
end

if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "anneal3"
    get(ENV, "HM_B5", "") == "1" && enable5!()
    @eval periodicscore(pr::Print) = cycleobjective(pr)
    annealp(parse(Int, ARGS[2]), parse(Int, ARGS[3]), ARGS[4], readprinttxt(ARGS[5]); T0 = 3.0)
end

# merge adjacent turns of the same face (quarter arithmetic mod 4)
function reduceword(w::Vector{Int})
    out = Int[]
    q(m) = ((m - 1) % 3 == 0 ? 1 : (m - 1) % 3 == 1 ? 2 : 3)
    for m in w
        if !isempty(out) && (out[end] - 1) ÷ 3 == (m - 1) ÷ 3
            t = mod(q(out[end]) + q(m), 4); f = (m - 1) ÷ 3
            pop!(out)
            t != 0 && push!(out, 3f + (t == 1 ? 1 : t == 2 ? 2 : 3))
        else
            push!(out, m)
        end
    end
    length(out) == length(w) ? out : reduceword(out)
end

# ---------------- writer v2b: identity reference, optional fixed routes ----------------
# Reference print state = the printed home frames (IDSTATE). Each mode takes
# the better of (a) a given route (setup + period words, e.g. the H/S/M
# seconds-first up runs, valid for any print that keeps the H/M/digit/blank
# stickers they use) and (b) the lap-graph cycle search from starts within
# radius 4 (or 4+4) of the reference state.
function readroutes(path)
    routes = Dict{Tuple{Char,Int},Tuple{Vector{Int},Int,Int,Vector{Vector{Int}}}}()
    cur = nothing
    mv(w) = w == "" || w == "-" ? Int[] : [findfirst(==(t), MOVENAMES) for t in split(w)]
    for line in eachline(path)
        f = split(line, '\t')
        if f[1] == "mode"
            cur = (f[2][1], parse(Int, f[3]))
            routes[cur] = (mv(f[4]), parse(Int, f[5]), parse(Int, f[6]), Vector{Int}[])
        else
            push!(routes[cur][4], mv(f[4]))
        end
    end
    routes
end

function routequality(s, words, P, Q, L, r, sh)
    st = s
    for (j, w) in enumerate(words)
        st = applyword(st, w)
        shows(st, sh, target(L, j % (r + 1), true)) || return nothing
        j == P && (global PSTATE = st)
    end
    P == 0 && (global PSTATE = s)
    st == PSTATE || return nothing
    sum(edgecost(length(w)) for w in words[P+1:end]) / (Q ÷ (r + 1))
end

function writeperiodic2(printfile, out; routesfile = "", hstarts = 15)
    pr = readprinttxt(printfile); sh = showtable(pr)
    routes = routesfile == "" ? Dict() : readroutes(routesfile)
    modes = Any[]
    for (L, r) in MODES
        best = nothing
        for src in "SHM"
            haskey(routes, (src, r)) || continue
            setup, P, Q, words = routes[(src, r)]
            s = applyword(IDSTATE, setup)
            if shows(s, sh, target(L, 0, true))
                q = routequality(s, words, P, Q, L, r, sh)
                q === nothing || (best === nothing || q < best[1]) && (best = (q, setup, (P = P, Q = Q, words = words), "given-$src"))
            end
        end
        cands = hstarts == 0 ? Tuple{Vector{Int},State}[] : [(B4.words[i], applyelem(IDSTATE, E)) for (i, E) in enumerate(B4.elems)]
        rngH = MersenneTwister(300)
        for _ in 1:(hstarts == 0 ? 0 : 40)
            E1 = rand(rngH, 2:length(B4.elems)); x = applyelem(IDSTATE, B4.elems[E1])
            for (j, E2) in enumerate(B4.elems)
                push!(cands, (vcat(B4.words[E1], B4.words[j]), applyelem(x, E2)))
            end
        end
        cnt = 0
        for (wd, s) in cands
            shows(s, sh, target(L, 0, true)) || continue
            cnt += 1; cnt > hstarts && break
            mc = modecycle(s, L, r, sh)
            mc === nothing && continue
            (best === nothing || mc.quality[1] < best[1]) && (best = (mc.quality[1], wd, mc, "search"))
        end
        best === nothing && error("no cycle for $L$r")
        println("$L$r quality $(best[1]) source $(best[4]) P=$(best[3].P) Q=$(best[3].Q)"); flush(stdout)
        push!(modes, (L, r, best[2], best[3]))
    end
    # rebase: the reference state is the M start, so the M setup is empty and
    # the H setups become inverse(M setup) followed by their own setup
    msetup = modes[1][3]
    sRef = applyword(IDSTATE, msetup)
    invm = reverse([invmove(m) for m in msetup])
    modes = [(L, r, L == 'M' ? Int[] : reduceword(vcat(invm, su)), mc) for (L, r, su, mc) in modes]
    io = IOBuffer()
    println(io, "cubistry.hm-counter.v2"); println(io, "profile\tblank"); println(io, "letters\tHM")
    for sid in 1:24
        c = (sid - 1) ÷ 3 + 1; a = (sid - 1) % 3 + 1
        n = zeros(Int, 3); n[a] = POS[c][a]
        R = ROT[sRef[c]]
        uh = pr.glyph[sid] == ' ' ? (a == 1 ? [0, 1, 0] : [1, 0, 0]) : homeup2(sid, pr.cell[sid])
        println(io, "sticker\t", sid - 1, "\t", c - 1, "\t", join(R * collect(POS[c]), ","), "\t",
                join(R * n, ","), "\t", join(R * uh, ","), "\t", pr.glyph[sid] == ' ' ? "_" : string(pr.glyph[sid]))
    end
    wtxt(w) = isempty(w) ? "-" : join(MOVENAMES[w], " ")
    mx = 0
    for (L, r, setup, mc) in modes
        println(io, "mode\t$L\t$r\t$(wtxt(setup))\t$(mc.P)\t$(mc.Q)")
        st = applyword(sRef, setup); n = r + 1
        for (j, w) in enumerate(mc.words)
            v = (j - 1) % n; nv = (v + 1) % n
            lb = lowerbound2(st, target(L, nv, true), sh, BALLS[end])
            println(io, "step\t$L\t$r\t$v\t$nv\t$(wtxt(w))\t$lb")
            mx = max(mx, length(w)); st = applyword(st, w)
        end
    end
    println(io, "claim\tmaxEdgeHTM\t$mx"); println(io, "end")
    write(out, take!(io)); println("wrote $out")
end

if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "write2"
    get(ENV, "HM_B5", "") == "1" && enable5!()
    writeperiodic2(ARGS[2], ARGS[3]; routesfile = length(ARGS) >= 4 ? ARGS[4] : "",
                   hstarts = parse(Int, get(ENV, "HM_HSTARTS", "15")))
end

