# H/M counter candidate engine (generator side only; the Julia and Flix
# checkers share no code with this file).
#
# Model: 2x2x2, fixed frame, eight rigid corners, 24 immutable stickers, the 18
# outer-face turns R L U D F B (quarter, inverse, half), HTM. A corner cubie c
# has home position POS[c] and a rotation index r (one of 24 proper rotations);
# its position is ROT[r]*POS[c]. Sticker id = 3c + a, where a is the home axis
# (0 = x, 1 = y, 2 = z) of its outward normal. A non-blank sticker is printed
# with one up vector; that makes it readable upright at exactly one front cell.
# A blank sticker reads as blank in every orientation.

const POS = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
posindex(p) = ((p[1] > 0) * 4 + (p[2] > 0) * 2 + (p[3] > 0)) + 1

function allrots()
    units = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    rs = Matrix{Int}[]
    for a in units, b in units
        sum(a .* b) == 0 || continue
        c = (a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1])
        push!(rs, hcat(collect(a), collect(b), collect(c)))
    end
    sort!(rs, by = m -> m == [1 0 0; 0 1 0; 0 0 1] ? 0 : 1)
    rs
end
const ROT = allrots()
const NR = 24
findrot(m) = findfirst(==(m), ROT)
const COMP = [findrot(ROT[a] * ROT[b]) for a in 1:NR, b in 1:NR]   # a after b
const INV = [findfirst(b -> COMP[a, b] == 1, 1:NR) for a in 1:NR]
mulv(m, v) = Tuple(m * collect(v))
# position index of cubie c with rotation r
const PIDX = [posindex(mulv(ROT[r], POS[c])) for c in 1:8, r in 1:NR]

# Cells: 1 = UL (-1,1,1), 2 = UR (1,1,1), 3 = LL (-1,-1,1), 4 = LR (1,-1,1)
const CELLPOS = [(-1, 1, 1), (1, 1, 1), (-1, -1, 1), (1, -1, 1)]
const CELLIDX = [posindex(p) for p in CELLPOS]
cellof(pi) = findfirst(==(pi), CELLIDX)   # nothing if not a front position

# For cubie c with rotation r located on the front: (cell, front sticker id,
# cell where that sticker would be upright given this rotation == cell itself).
# Readability of a non-blank sticker printed for cell k: readable iff cell == k.
function frontsticker(c, r)
    pi = PIDX[c, r]
    k = cellof(pi)
    k === nothing && return (0, 0)
    n0 = ROT[r]' * [0, 0, 1]          # home-frame normal facing front
    a = findfirst(!=(0), n0)
    return (k, 3 * (c - 1) + a)        # sticker ids 1..24
end
const FRONT = [frontsticker(c, r) for c in 1:8, r in 1:NR]

const MOVENAMES = String[]
const MOVEROT = Int[]
const MOVEAXIS = Int[]
const MOVESIDE = Int[]
function rotabout(axis, quarters)
    m = [1 0 0; 0 1 0; 0 0 1]
    q = mod(quarters, 4)
    i, j = axis % 3 + 1, (axis + 1) % 3 + 1   # right-handed cyclic pair
    g = zeros(Int, 3, 3); g[axis, axis] = 1; g[i, j] = -1; g[j, i] = 1
    for _ in 1:q
        m = g * m
    end
    findrot(m)
end
for (f, axis, side) in (("R", 1, 1), ("L", 1, -1), ("U", 2, 1), ("D", 2, -1), ("F", 3, 1), ("B", 3, -1))
    for (suf, amt) in (("", 1), ("2", 2), ("'", -1))
        push!(MOVENAMES, f * suf); push!(MOVEROT, rotabout(axis, -side * amt))
        push!(MOVEAXIS, axis); push!(MOVESIDE, side)
    end
end

const State = NTuple{8,UInt8}
const IDSTATE = ntuple(_ -> UInt8(1), 8)
function applymove(s::State, m::Int)::State
    ax = MOVEAXIS[m]; sd = MOVESIDE[m]; mr = MOVEROT[m]
    ntuple(8) do c
        r = Int(s[c])
        POS_ = mulv(ROT[r], POS[c])
        POS_[ax] == sd ? UInt8(COMP[mr, r]) : UInt8(r)
    end
end
applyword(s::State, w::Vector{Int}) = foldl(applymove, w; init = s)
key(s::State) = foldl((acc, x) -> (acc << 5) | UInt64(x), s; init = UInt64(0))
unkey(k::UInt64)::State = ntuple(i -> UInt8((k >> (5 * (8 - i))) & 31), 8)
# cubie at each position index
function cubieat(s::State)
    out = zeros(Int, 8)
    for c in 1:8
        out[PIDX[c, s[c]]] = c
    end
    out
end
# Apply group element E (state reached from identity) to s: cubie at position q
# gets rotation E[q] composed after its own.
function applyelem(s::State, E::State)::State
    ntuple(8) do c
        q = PIDX[c, s[c]]
        UInt8(COMP[E[q], s[c]])
    end
end

struct Ball
    elems::Vector{State}
    words::Vector{Vector{Int}}
    len::Vector{Int}
end
function makeball(radius)
    elems = State[IDSTATE]; words = [Int[]]; len = [0]
    seen = Dict(key(IDSTATE) => 1)
    frontier = [1]
    for d in 1:radius
        nxt = Int[]
        for i in frontier, m in 1:18
            t = applymove(elems[i], m)
            k = key(t)
            haskey(seen, k) && continue
            push!(elems, t); push!(words, vcat(words[i], m)); push!(len, d)
            seen[k] = length(elems); push!(nxt, length(elems))
        end
        frontier = nxt
    end
    Ball(elems, words, len)
end

# class bitsets: for cell k and rotation class r, the set of ball elements whose
# rotation for the source position q = r^-1 * cell is r.
struct Classes
    nwords::Int
    bits::Array{UInt64,3}  # (nwords, NR, 4)
    src::Matrix{Int}       # source position index for (r, cell)
end
function makeclasses(b::Ball)
    n = length(b.elems); nw = cld(n, 64)
    bits = zeros(UInt64, nw, NR, 4)
    src = zeros(Int, NR, 4)
    for k in 1:4, r in 1:NR
        src[r, k] = posindex(mulv(ROT[INV[r]], CELLPOS[k]))
    end
    for (i, E) in enumerate(b.elems), k in 1:4
        for r in 1:NR
            q = src[r, k]
            if E[q] == r
                bits[(i - 1) >> 6 + 1, r, k] |= UInt64(1) << ((i - 1) & 63)
            end
        end
    end
    Classes(nw, bits, src)
end

# Print: for each sticker id (1..24): glyph (Char) and cell (1..4) where it is
# upright; blank stickers use ' ' and cell 0.
struct Print
    glyph::Vector{Char}
    cell::Vector{Int}
end
# displayed glyph of cubie c with rotation r if on front cell k, else '\0' / '?'
function showtable(p::Print)
    t = fill('\0', 8, NR)
    for c in 1:8, r in 1:NR
        k, sid = FRONT[c, r]
        k == 0 && continue
        g = p.glyph[sid]
        t[c, r] = g == ' ' ? ' ' : (p.cell[sid] == k ? g : '?')
    end
    t
end

# ---------------- display targets and set propagation ----------------
# need[k] = required glyph at cell k, '\0' = unconstrained.
const Target = NTuple{4,Char}
target(letter::Char, v::Int, blank::Bool) =
    (blank ? ' ' : '\0', letter, Char('0' + v ÷ 10), Char('0' + v % 10))

function shows(s::State, show, need::Target)
    cat = cubieat(s)
    for k in 1:4
        need[k] == '\0' && continue
        c = cat[CELLIDX[k]]
        show[c, s[c]] == need[k] || return false
    end
    true
end

mutable struct Work
    acc::Vector{UInt64}
    m::Vector{UInt64}
end
Work(nw::Int) = Work(zeros(UInt64, nw), zeros(UInt64, nw))

# all ball elements E such that s*E shows need; calls f(i) for each index
@inline function foreachhit(f, s::State, show, need::Target, cl::Classes, w::Work)
    cat = cubieat(s)
    fill!(w.acc, typemax(UInt64))
    for k in 1:4
        need[k] == '\0' && continue
        fill!(w.m, 0)
        any = false
        for r in 1:NR
            c = cat[cl.src[r, k]]
            nr = COMP[r, s[c]]
            if show[c, nr] == need[k]
                any = true
                @inbounds for j in 1:cl.nwords
                    w.m[j] |= cl.bits[j, r, k]
                end
            end
        end
        any || return
        @inbounds for j in 1:cl.nwords
            w.acc[j] &= w.m[j]
        end
    end
    @inbounds for j in 1:cl.nwords
        x = w.acc[j]
        while x != 0
            t = trailing_zeros(x)
            f((j - 1) * 64 + t + 1)
            x &= x - 1
        end
    end
end

function stepset(R::Vector{UInt64}, show, need::Target, b::Ball, cl::Classes, w::Work)
    out = UInt64[]
    n = length(b.elems)
    for k in R
        s = unkey(k)
        foreachhit(s, show, need, cl, w) do i
            i <= n && push!(out, key(applyelem(s, b.elems[i])))
        end
    end
    sort!(out); unique!(out)
end

# ---------------- chains ----------------
# targets[1] is the start display; the chain visits targets[2..end] and then
# closes back to the exact start state. chord = (i, j): additionally the state
# at targets[i] must reach the exact state at targets[j] (j < i) via one edge
# within radius 3 (used for 11 -> 00 with j = 1).
struct ChainResult
    layers::Vector{Vector{UInt64}}
    radius::Vector{Int}     # radius used for edge into layer i+1 (last = closure)
    bad::Int                # number of edges needing radius > 3
end

function neighborsof(s::State, b::Ball)
    v = UInt64[key(applyelem(s, E)) for E in b.elems]
    sort!(v); unique!(v)
end
insorted(v, k) = (i = searchsortedfirst(v, k); i <= length(v) && v[i] == k)

# balls[1] = radius-3 ball, balls[2] = radius-4 ball (fallback)
function runchain(s::State, targets::Vector{Target}, show, balls, cls, works;
                  chord = nothing, maxsize = typemax(Int), rng = nothing)
    layers = [UInt64[key(s)]]
    radius = Int[]; bad = 0
    sk = key(s)
    near3 = chord === nothing ? UInt64[] : neighborsof(s, balls[1])
    for i in 2:length(targets)+1
        need = i <= length(targets) ? targets[i] : targets[1]
        R = layers[end]
        local nxt
        used = 0
        for (bi, b) in enumerate(balls)
            nxt = stepset(R, show, need, b, cls[bi], works[bi])
            if i == length(targets) + 1
                nxt = insorted(nxt, sk) ? UInt64[sk] : UInt64[]
            end
            used = bi
            isempty(nxt) || break
        end
        isempty(nxt) && return ChainResult(layers, radius, typemax(Int))
        push!(radius, used + 2); used > 1 && (bad += 1)
        if chord !== nothing && i == chord
            f = filter(k -> insorted(near3, k), nxt)
            if isempty(f)
                bad += 1   # chord needs > 3 (not further resolved here)
            else
                nxt = f
            end
        end
        if length(nxt) > maxsize && rng !== nothing
            nxt = sort!(nxt[randperm(rng, length(nxt))[1:maxsize]])
        end
        push!(layers, nxt)
    end
    ChainResult(layers, radius, bad)
end

# Walk back from the closed start through stored layers; returns per-edge
# words (forward) and states. Prefers the shortest element per edge.
function extractwalk(res::ChainResult, targets::Vector{Target}, show, balls)
    n = length(targets)
    states = Vector{State}(undef, n + 1)
    words = Vector{Vector{Int}}(undef, n)
    states[n+1] = unkey(res.layers[1][1])
    for i in n:-1:1
        cur = states[i+1]
        prevlayer = res.layers[i]
        found = false
        for b in balls
            for (E, w) in zip(b.elems, b.words)
                inv = reverse([invmove(m) for m in w])
                prev = applyword(cur, inv)
                if insorted(prevlayer, key(prev)) && applyword(prev, w) == cur
                    states[i] = prev; words[i] = w; found = true; break
                end
            end
            found && break
        end
        found || error("walk extraction failed at layer $i")
    end
    states, words
end
invmove(m) = (f = (m - 1) ÷ 3; a = (m - 1) % 3; 3f + (a == 1 ? 1 : 2 - a) + 1)

# ---------------- lazy-print depth-first construction ----------------
# Builds a print while walking a chain: unassigned stickers act as wildcards.
mutable struct Partial
    glyph::Vector{Char}   # '\0' unassigned
    cell::Vector{Int}
end
Partial() = Partial(fill('\0', 24), zeros(Int, 24))
copyp(p::Partial) = Partial(copy(p.glyph), copy(p.cell))

# check s against need under partial print; returns list of new assignments
# (sid, glyph, cell) or nothing if inconsistent.
function lazymatch(s::State, need::Target, p::Partial)
    cat = cubieat(s)
    news = Tuple{Int,Char,Int}[]
    for k in 1:4
        need[k] == '\0' && continue
        c = cat[CELLIDX[k]]
        kk, sid = FRONT[c, s[c]]
        g = p.glyph[sid]
        if g == '\0'
            any(x -> x[1] == sid, news) && return nothing
            push!(news, (sid, need[k], need[k] == ' ' ? 0 : k))
        elseif g == ' '
            need[k] == ' ' || return nothing
        else
            (g == need[k] && p.cell[sid] == k) || return nothing
        end
    end
    news
end
