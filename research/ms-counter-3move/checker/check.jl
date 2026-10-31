# Native Julia checker for the M/S counter witness (cubistry.ms-counter.v1).
#
# Provenance: adapted from research/hm-counter-3move/checker/check.jl at commit
# 9ca9f9e9fe6043cdec584c5394ef92a8634a487d (sticker geometry, Rodrigues turns,
# display check and tracked-sticker graph are reused; the run/period logic is
# new). Shares no code with the generator (engine.jl, ms.jl, pool.jl, ...).
#
# It rebuilds the physical print from the 24 sticker rows, turns every sticker
# frame with integer Rodrigues quarter turns, replays each setup and every
# increment of the M and S runs over the whole claimed period, checks the
# blank upper-left sticker and the upright letter/tens/units at every display,
# checks full-state return to the run start at the period boundary (and that
# the claimed period is minimal), replays the exact inverse decrement
# traversal over the period, and rebuilds the tracked front-sticker graph
# (4 tracked stickers for "blank": 136,080 states) to verify each claimed
# lower bound. Prints a canonical receipt; exits 1 on rejection.
using SHA

struct Reject <: Exception
    reason::String
end
need(ok, why) = ok || throw(Reject(why))

const V = NTuple{3,Int}
dotv(a, b) = a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
crossv(a, b) = (a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1])
const UNITS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))

# Rodrigues with integer cos/sin for k quarter turns about unit axis e
function turn(v::V, e::V, k::Int)::V
    c = (1, 0, -1, 0)[mod(k, 4) + 1]; s = (0, 1, 0, -1)[mod(k, 4) + 1]
    x = crossv(e, v); d = dotv(e, v)
    (v[1] * c + x[1] * s + e[1] * d * (1 - c),
     v[2] * c + x[2] * s + e[2] * d * (1 - c),
     v[3] * c + x[3] * s + e[3] * d * (1 - c))
end

const FACE = Dict('R' => (1, 1), 'L' => (1, -1), 'U' => (2, 1), 'D' => (2, -1), 'F' => (3, 1), 'B' => (3, -1))

struct Stk
    id::Int; cubie::Int; p::V; n::V; up::V; glyph::Char
end

function parsemove(tok)
    need(occursin(r"^[RLUDFB](2|')?$", tok), "illegal move token")
    axis, side = FACE[tok[1]]
    amt = length(tok) == 1 ? 1 : (tok[2] == '2' ? 2 : -1)
    (axis, side, amt)
end
parseword(w) = w == "-" ? Tuple{Int,Int,Int}[] : [parsemove(t) for t in split(w, ' ')]
wordtext(ws) = isempty(ws) ? "-" : join(ws, " ")
function invword(w::Vector{Tuple{Int,Int,Int}})
    [(a, s, m == 2 ? 2 : -m) for (a, s, m) in reverse(w)]
end

function domove(st::Vector{Stk}, mv)
    axis, side, amt = mv
    e = ntuple(i -> i == axis ? 1 : 0, 3)
    k = -side * amt
    [x.p[axis] == side ? Stk(x.id, x.cubie, turn(x.p, e, k), turn(x.n, e, k), turn(x.up, e, k), x.glyph) : x
     for x in st]
end
doword(st, w) = foldl(domove, w; init = st)

const CELLS = ((-1, 1, 1), (1, 1, 1), (-1, -1, 1), (1, -1, 1))   # UL UR LL LR

function wanted(letter::Char, v::Int, blank::Bool)
    (blank ? '_' : '\0', letter, Char('0' + v ÷ 10), Char('0' + v % 10))
end

function checkshow(st::Vector{Stk}, want, what)
    for k in 1:4
        want[k] == '\0' && continue
        seen = [x for x in st if x.p == CELLS[k] && x.n == (0, 0, 1)]
        need(length(seen) == 1, "exactly one visible sticker per cell")
        x = seen[1]
        if want[k] == '_'
            need(x.glyph == '_', "upper-left cell must show a blank sticker at $what")
        else
            need(x.glyph == want[k], "wrong glyph at cell $k for $what")
            need(x.up == (0, 1, 0), "glyph not upright at cell $k for $what")
        end
    end
end

function readprint(rows)
    need(length(rows) == 24, "exactly 24 sticker rows")
    st = Stk[]
    ivec(s) = (f = split(s, ','); need(length(f) == 3, "vector arity");
               Tuple(map(x -> (need(occursin(r"^-?[0-9]+$", x), "integer"); parse(Int, x)), f)))
    for r in rows
        f = split(r, '\t')
        need(length(f) == 7 && f[1] == "sticker", "sticker row shape")
        need(occursin(r"^[0-9]+$", f[2]) && occursin(r"^[0-9]+$", f[3]), "integer ids")
        p, n, u = ivec(f[4]), ivec(f[5]), ivec(f[6])
        need(all(c -> c in (-1, 1), p), "corner position")
        need(n in UNITS && u in UNITS && dotv(p, n) == 1 && dotv(n, u) == 0, "outward tangent frame")
        need(length(f[7]) == 1 && f[7][1] in "MSH0123456789_", "glyph alphabet (H allowed as an inert printed glyph)")
        push!(st, Stk(parse(Int, f[2]), parse(Int, f[3]), p, n, u, f[7][1]))
    end
    need(sort([x.id for x in st]) == collect(0:23), "unique sticker ids 0..23")
    lattice = Set((x.p, x.n) for x in st)
    need(length(lattice) == 24, "complete 24-facelet lattice")
    for c in 0:7
        ps = [x.p for x in st if x.cubie == c]
        need(length(ps) == 3 && length(Set(ps)) == 1, "eight rigid three-sticker corners")
    end
    need(length(Set(x.p for x in st)) == 8, "distinct corner positions")
    sort(st, by = x -> x.id)
end

# ---- tracked-sticker graph ----
const MOVES = [(a, s, m) for (a, s) in ((1, 1), (1, -1), (2, 1), (2, -1), (3, 1), (3, -1)) for m in (1, 2, -1)]
function posemove(pose, mv)
    p, n, u = pose
    axis, side, amt = mv
    p[axis] == side || return pose
    e = ntuple(i -> i == axis ? 1 : 0, 3); k = -side * amt
    (turn(p, e, k), turn(n, e, k), turn(u, e, k))
end
struct Graph
    k::Int
    index::Vector{Dict{NTuple{3,V},Int}}
    dist::Vector{Int8}
end
function buildgraph(k::Int)
    index = Dict{NTuple{3,V},Int}[]
    trans = Matrix{Int}[]
    for slot in (k == 4 ? (1, 2, 3, 4) : (2, 3, 4))
        seed = (CELLS[slot], (0, 0, 1), (0, 1, 0))
        poses = [seed]; idx = Dict(seed => 1)
        i = 1
        while i <= length(poses)
            for mv in MOVES
                q = posemove(poses[i], mv)
                haskey(idx, q) || (push!(poses, q); idx[q] = length(poses))
            end
            i += 1
        end
        need(length(poses) == 24, "24 poses per tracked slot")
        push!(index, idx)
        push!(trans, [idx[posemove(poses[j], MOVES[m])] for j in 1:24, m in 1:18])
    end
    enc(t) = foldl((a, x) -> a * 24 + (x - 1), t; init = 0) + 1
    dist = fill(Int8(-1), 24^k)
    start = ntuple(_ -> 1, k)
    dist[enc(start)] = 0
    q = [start]; h = 1
    while h <= length(q)
        t = q[h]; h += 1; d = dist[enc(t)]
        for m in 1:18
            u = ntuple(j -> trans[j][t[j], m], k)
            e = enc(u)
            if dist[e] < 0
                dist[e] = d + 1; push!(q, u)
            end
        end
    end
    Graph(k, index, dist)
end
graphenc(t) = foldl((a, x) -> a * 24 + (x - 1), t; init = 0) + 1

# minimum graph distance from st to any upright selection showing want
function lowerbound(g::Graph, st::Vector{Stk}, want)
    slots = g.k == 4 ? (1, 2, 3, 4) : (2, 3, 4)
    cands = Vector{Vector{Tuple{Int,Int}}}()   # (cubie, pose index)
    for (j, slot) in enumerate(slots)
        c = Tuple{Int,Int}[]
        for x in st
            if want[slot] == '_' && x.glyph == '_'
                # a blank reads in every orientation: try each tangent as up
                for u in UNITS
                    dotv(u, x.n) == 0 || continue
                    pi = get(g.index[j], (x.p, x.n, u), 0)
                    pi > 0 && push!(c, (x.cubie, pi))
                end
            elseif want[slot] != '_' && x.glyph == want[slot]
                pi = get(g.index[j], (x.p, x.n, x.up), 0)
                pi > 0 && push!(c, (x.cubie, pi))
            end
        end
        push!(cands, c)
    end
    best = typemax(Int)
    for combo in Iterators.product(cands...)
        length(Set(c[1] for c in combo)) == length(combo) || continue
        d = g.dist[graphenc(Tuple(c[2] for c in combo))]
        d >= 0 && (best = min(best, d))
    end
    need(best < typemax(Int), "a reachable matching selection exists")
    best
end

function histtext(lens)
    join(["$d:$(count(==(d), lens))" for d in 0:6], ",")
end

function validate(path)
    raw = read(path)
    text = String(copy(raw))
    need(!occursin('\r', text), "CR forbidden")
    need(endswith(text, "\n"), "final LF required")
    rows = split(chop(text), '\n')
    need(all(!isempty, rows), "empty line")
    need(rows[1] == "cubistry.ms-counter.v1", "schema header")
    f = split(rows[2], '\t'); need(length(f) == 2 && f[1] == "profile" && f[2] in ("free", "blank"), "profile row")
    blank = f[2] == "blank"
    need(rows[3] == "letters\tMS", "letters row must be exactly MS")
    st0 = readprint(rows[4:27])
    blank && need(any(x -> x.glyph == '_', st0), "blank profile needs a blank sticker")
    g = buildgraph(blank ? 4 : 3)
    out = String[]
    push!(out, "cubistry.ms-counter.receipt.v1")
    push!(out, "witness-sha256\t" * bytes2hex(sha256(raw)))
    push!(out, "profile\t" * (blank ? "blank" : "free"))
    reach = [Int(d) for d in g.dist if d >= 0]
    push!(out, "graph\t$(length(reach))\t" * join(["$d:$(count(==(d), reach))" for d in 0:maximum(reach)], ","))
    r = 28
    alllens = Int[]
    for letter in ('M', 'S')
        f = split(rows[r], '\t'); r += 1
        need(length(f) == 6 && f[1] == "run" && f[2] == string(letter) && f[3] == "setup" && f[5] == "period",
             "run row for $letter")
        need(occursin(r"^[1-9][0-9]{0,2}$", f[6]), "period must be a positive integer")
        p = parse(Int, f[6])
        setup = parseword(f[4]); setuptext = f[4]
        start = doword(st0, setup)
        checkshow(start, wanted(letter, 0, blank), "$(letter)00 after setup")
        n = 60 * p
        state = start
        states = [start]; words = Vector{Vector{Tuple{Int,Int,Int}}}()
        lens = Int[]; lbs = Int[]
        for i in 0:n-1
            v = i % 60; nv = (v + 1) % 60
            f = split(rows[r], '\t'); r += 1
            need(length(f) == 7 && f[1] == "edge" && f[2] == string(letter) && f[3] == string(i) &&
                 f[4] == string(v) && f[5] == string(nv), "edge row $letter $i")
            w = parseword(f[6])
            need(occursin(r"^[0-9]+$", f[7]), "integer lower bound")
            lb = lowerbound(g, state, wanted(letter, nv, blank))
            need(parse(Int, f[7]) == lb, "claimed lower bound differs for $letter edge $i ($v->$nv)")
            need(length(w) >= lb, "word shorter than graph distance for $letter edge $i ($v->$nv)")
            nxt = doword(state, w)
            checkshow(nxt, wanted(letter, nv, blank), "$letter edge $i ($v->$nv)")
            need(doword(nxt, invword(w)) == state, "full-state edge inverse")
            push!(words, w); push!(lens, length(w)); push!(lbs, lb)
            state = nxt
            if nv == 0 && i < n - 1
                need(state != start, "period boundary: $letter returns to the start state before the claimed period")
            end
            i < n - 1 && push!(states, state)
        end
        need(state == start, "period boundary: $letter run does not return to the exact start state after the claimed period")
        # decrement = exact inverse traversal of the period, starting from 00
        dstate = start
        for i in n-1:-1:0
            dstate = doword(dstate, invword(words[i+1]))
            need(dstate == states[i+1], "exact full-state decrement replay $letter")
            checkshow(dstate, wanted(letter, i % 60, blank), "decrement $letter to edge $i source")
        end
        append!(alllens, lens)
        push!(out, "run\t$letter\tperiod\t$p\trunin\t0\tedges\t$n\ttotal\t$(sum(lens))\tmax\t$(maximum(lens))\thist\t$(histtext(lens))\tlbtotal\t$(sum(lbs))\tlbmax\t$(maximum(lbs))\ttight\t$(count(lens .== lbs))")
        push!(out, "decrement\t$letter\tedges\t$n\tinverse\texact")
        push!(out, "setup\t$letter\thtm\t$(length(setup))\tword\t$(setuptext)")
    end
    f = split(rows[r], '\t'); r += 1
    need(length(f) == 3 && f[1] == "claim" && f[2] == "maxEdgeHTM", "claim row")
    need(parse(Int, f[3]) == maximum(alllens), "claimed maximum edge HTM differs from replay")
    need(rows[r] == "end" && r == length(rows), "end row")
    push!(out, "transitions\t$(length(alllens))\ttotal\t$(sum(alllens))\tmax\t$(maximum(alllens))\thist\t$(histtext(alllens))")
    push!(out, "verdict\tACCEPT")
    join(out, "\n") * "\n"
end
if abspath(PROGRAM_FILE) == @__FILE__
    try
        print(validate(ARGS[1]))
    catch e
        e isa Reject || rethrow()
        println("REJECT\t", e.reason)
        exit(1)
    end
end
