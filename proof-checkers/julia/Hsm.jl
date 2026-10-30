# Independent Julia checker for the HSM seconds-first raw-input profile.
#
# Profile document: proof-checkers/HSM-PROFILE.md.  Additive to the frozen issue-74
# contract; nothing in Checker.jl, Conformance.jl or the pinned corpus is touched.
#
# Written independently of the Flix implementation (proof-checkers/flix/src/Hsm.flix)
# and of every Python verifier.  Model: 24 outward facelets of the 2x2x2 lattice, eight
# rigid corners with 24 poses each, 18 face turns (half turn = 1 HTM).  Physical replay
# of the saved words uses full (position, normal, up) sticker frames; distances and
# graphs use an independent facelet-permutation model that is tied back to the frames.
module IndependentHsm
using JSON, SHA
using ..IndependentProof
const IP = IndependentProof

const PROFILE = "cubistry.hsm-seconds-first"
const V3 = NTuple{3,Int}
const Z = (0, 0, 1)
const Y = (0, 1, 0)
const FRONT = [(-1, 1, 1), (1, 1, 1), (-1, -1, 1), (1, -1, 1)]  # blank/letter/tens/units cells
const REQUIRED_MODES = [("S", 59, 1), ("S", 59, -1), ("M", 59, 1), ("M", 59, -1),
                        ("H", 23, 1), ("H", 23, -1), ("H", 11, 1), ("H", 11, -1)]
const MAX_STEPS = 100000
const MAX_TOKENS = 64

need(ok, message; code="INVALID") = IP.need(ok, message; code=code)

# ---------------------------------------------------------------- vectors and moves
dot(a, b) = a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
cross(a, b) = (a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1])
function quarter(v::V3, axis::Int)
    a = ntuple(i -> Int(i == axis), 3)
    c = cross(a, v)
    d = dot(a, v)
    ntuple(i -> c[i] + a[i] * d, 3)
end
function rot(v::V3, axis::Int, q::Int)
    for _ in 1:mod(q, 4)
        v = quarter(v, axis)
    end
    v
end
const FACE_AXIS = Dict('R' => (1, 1), 'L' => (1, -1), 'U' => (2, 1), 'D' => (2, -1), 'F' => (3, 1), 'B' => (3, -1))
const TOKENS = String[string(f, s) for f in "RLUDFB" for s in ("", "2", "'")]
const TOKEN_MOVE = Dict(t => i for (i, t) in enumerate(TOKENS))
move_axis(m) = FACE_AXIS[TOKENS[m][1]][1]
move_side(m) = FACE_AXIS[TOKENS[m][1]][2]
function move_quarters(m)
    t = TOKENS[m]
    amount = endswith(t, "2") ? 2 : endswith(t, "'") ? -1 : 1
    -move_side(m) * amount
end
function parse_word(word)
    need(word isa AbstractString && isvalid(word), "move word must be a string")
    word == "" && return Int[]
    ts = split(String(word), ' '; keepempty=true)
    need(length(ts) <= MAX_TOKENS, "move word token limit")
    need(all(t -> haskey(TOKEN_MOVE, t), ts), "explicit legal single-space-separated move notation required")
    [TOKEN_MOVE[t] for t in ts]
end
function inverse_moves(ms)
    out = Int[]
    for m in reverse(ms)
        t = TOKENS[m]
        push!(out, TOKEN_MOVE[endswith(t, "2") ? t : endswith(t, "'") ? t[1:end-1] : t * "'"])
    end
    out
end

# ---------------------------------------------------------------- lattice
const POSITIONS = V3[(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
const NORMAL_AXES = V3[(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
const AXIS_SET = Set(NORMAL_AXES)
const FACELETS = Tuple{V3,V3}[(p, n) for p in POSITIONS for n in NORMAL_AXES if dot(p, n) == 1]
const FIDX = Dict(f => i - 1 for (i, f) in enumerate(FACELETS))      # 0-based facelet ids
position_index(p::V3) = (p[1] > 0 ? 4 : 0) + (p[2] > 0 ? 2 : 0) + (p[3] > 0 ? 1 : 0)
const GOAL = [FIDX[(FRONT[i], Z)] for i in 1:4]
const MOVEF = [begin
                   a, s, q = move_axis(m), move_side(m), move_quarters(m)
                   [(p[a] == s ? FIDX[(rot(p, a, q), rot(n, a, q))] : f - 1) for (f, (p, n)) in enumerate(FACELETS)]
               end for m in 1:18]
@assert length(FACELETS) == 24

# ---------------------------------------------------------------- print (source state)
struct Print
    id::Vector{Int}
    cubie::Vector{Int}
    p::Vector{V3}
    n::Vector{V3}
    up::Vector{V3}
    image::Vector{String}
    slot::Vector{Int}
end

glyph_kind(image, slot) = image == "" ? (:blank, "") : image in ("H", "S", "M") ? (:letter, image) :
                          slot == 2 ? (:tens, image) : (:units, image)

function exact_keys(obj, names, what)
    need(obj isa AbstractDict, what * " must be an object")
    need(Set(keys(obj)) == Set(names), what * " must have exactly the keys " * join(sort(collect(names)), ","))
end
function vec3(value, what)
    need(value isa AbstractVector && length(value) == 3, what * " must be a 3-vector")
    ntuple(i -> IP.integer(value[i], -1, 1), 3)
end

function parse_print(rows)
    need(rows isa AbstractVector && length(rows) == 24, "exactly 24 immutable stickers")
    pr = Print(zeros(Int, 24), zeros(Int, 24), Vector{V3}(undef, 24), Vector{V3}(undef, 24), Vector{V3}(undef, 24),
               fill("", 24), zeros(Int, 24))
    for (i, s) in enumerate(rows)
        exact_keys(s, ("id", "cubie", "p", "n", "up", "image", "slot"), "sticker")
        pr.id[i] = IP.integer(s["id"], 0, 23)
        need(pr.id[i] == i - 1, "ordered unique physical identities")
        pr.cubie[i] = IP.integer(s["cubie"], 0, 7)
        pr.p[i] = vec3(s["p"], "p")
        pr.n[i] = vec3(s["n"], "n")
        pr.up[i] = vec3(s["up"], "up")
        need(s["image"] isa AbstractString && isvalid(s["image"]), "image must be a string")
        pr.image[i] = String(s["image"])
        pr.slot[i] = IP.integer(s["slot"], 0, 3)
        need(pr.p[i] in POSITIONS && pr.n[i] in AXIS_SET && pr.up[i] in AXIS_SET && dot(pr.p[i], pr.n[i]) == 1 &&
             dot(pr.n[i], pr.up[i]) == 0, "outward tangent sticker frame")
        im = pr.image[i]
        need(im == "" || (length(im) == 1 && im[1] in "0123456789HSM"), "fixed glyph or real blank")
        if im == ""
            need(pr.slot[i] == 0, "blank artwork is used only upper-left")
        else
            f = FRONT[pr.slot[i]+1]
            need((dot(pr.p[i], pr.up[i]), dot(pr.p[i], cross(pr.up[i], pr.n[i]))) == (f[2], f[1]), "exact nonblank upright slot class")
            if im in ("H", "S", "M")
                need(pr.slot[i] == 1, "letters are upright only upper-right")
            else
                need(pr.slot[i] in (2, 3), "digits are upright only lower-left or lower-right")
                pr.slot[i] == 2 && need(im in ("0", "1", "2", "3", "4", "5"), "tens glyph range")
            end
        end
    end
    need(Set((pr.p[i], pr.n[i]) for i in 1:24) == Set(FACELETS), "complete 24-facelet lattice")
    for c in 0:7
        mem = [i for i in 1:24 if pr.cubie[i] == c]
        need(length(mem) == 3 && length(Set(pr.p[i] for i in mem)) == 1, "eight rigid corners")
    end
    need(length(Set(pr.p[i] for i in 1:24)) == 8, "eight distinct body positions")
    kinds = Set(glyph_kind(pr.image[i], pr.slot[i]) for i in 1:24)
    required = Set([(:blank, ""), (:letter, "H"), (:letter, "S"), (:letter, "M")])
    union!(required, [(:tens, string(d)) for d in 0:5], [(:units, string(d)) for d in 0:9])
    need(issubset(required, kinds), "every blank, letter, tens and units glyph is printed")
    pr
end

function print_code(pr::Print)
    tok(i) = pr.image[i] == "" ? "_" : pr.image[i] in ("H", "S", "M") ? pr.image[i] :
             (pr.slot[i] == 2 ? "T" : "U") * pr.image[i]
    join((join((tok(i) for i in 1:24 if pr.cubie[i] == c), " ") for c in 0:7), " | ")
end

# ---------------------------------------------------------------- engine
mutable struct Engine
    pr::Print
    members::Vector{Vector{Int}}      # corner (1-based) -> sticker indices (1-based), id order
    corner_of::Vector{Int}            # sticker index -> corner (1-based)
    local_of::Vector{Int}             # sticker index -> 1..3
    poses::Vector{Vector{NTuple{3,Int}}}   # corner -> pose -> facelets of its three stickers
    pose_index::Vector{Dict{NTuple{3,Int},Int}}
    ptrans::Vector{Vector{Vector{Int}}}    # corner -> move -> pose -> pose (1-based poses)
    where::Vector{Vector{Int}}        # corner -> pose -> position index
    twist::Vector{Vector{Int}}        # corner -> pose -> twist 0..2
    at::Vector{Vector{Vector{Int}}}   # corner -> position -> poses there
    dist::Vector{UInt8}
    diameter::Int
    reach::Int
end

function key_move(m::Int, k::Int)
    f = MOVEF[m]
    a, b, c, d = k ÷ 13824, (k ÷ 576) % 24, (k ÷ 24) % 24, k % 24
    ((f[a+1] * 24 + f[b+1]) * 24 + f[c+1]) * 24 + f[d+1]
end
encode_key(a, b, c, d) = ((a * 24 + b) * 24 + c) * 24 + d

function twist_of(triple::NTuple{3,Int}, home_y::Int)
    # Position of the home y-facing sticker in the counter-clockwise order, starting at the y-facing sticker.
    f = [FACELETS[t+1] for t in triple]
    p = f[1][1]
    u = findfirst(x -> x[2][2] != 0, f)
    order = [u]
    while length(order) < 3
        a = f[order[end]][2]
        push!(order, first(j for j in 1:3 if !(j in order) && dot(cross(a, f[j][2]), p) > 0))
    end
    findfirst(==(home_y), order) - 1
end

function build_engine(pr::Print)
    members = [[i for i in 1:24 if pr.cubie[i] == c] for c in 0:7]
    corner_of = zeros(Int, 24)
    local_of = zeros(Int, 24)
    for (c, mem) in enumerate(members), (j, i) in enumerate(mem)
        corner_of[i] = c
        local_of[i] = j
    end
    poses = Vector{Vector{NTuple{3,Int}}}()
    pose_index = Vector{Dict{NTuple{3,Int},Int}}()
    ptrans = Vector{Vector{Vector{Int}}}()
    wh = Vector{Vector{Int}}()
    tw = Vector{Vector{Int}}()
    at = Vector{Vector{Vector{Int}}}()
    for c in 1:8
        home = ntuple(j -> FIDX[(pr.p[members[c][j]], pr.n[members[c][j]])], 3)
        list = [home]
        idx = Dict(home => 1)
        for t in list, m in 1:18
            nt = ntuple(j -> MOVEF[m][t[j]+1], 3)
            if !haskey(idx, nt)
                push!(list, nt)
                idx[nt] = length(list)
            end
        end
        need(length(list) == 24, "each rigid corner has 24 poses")
        push!(poses, list)
        push!(pose_index, idx)
        push!(ptrans, [[idx[ntuple(j -> MOVEF[m][t[j]+1], 3)] for t in list] for m in 1:18])
        push!(wh, [position_index(FACELETS[t[1]+1][1]) + 1 for t in list])
        home_y = findfirst(x -> x[2][2] != 0, [FACELETS[t+1] for t in home])
        push!(tw, [twist_of(t, home_y) for t in list])
        push!(at, [[k for k in 1:24 if wh[end][k] == pos] for pos in 1:8])
    end
    # Twist invariant: each move changes the total twist of the eight corners by 0 mod 3.
    for m in 1:18
        delta = Dict{Int,Int}()
        for c in 1:8, k in 1:24
            nk = ptrans[c][m][k]
            d = mod(tw[c][nk] - tw[c][k], 3)
            need(get!(delta, wh[c][k], d) == d, "twist change depends only on the position")
        end
        need(length(delta) == 8 && sum(values(delta)) % 3 == 0, "every face turn preserves total twist mod 3")
    end
    for c in 1:8
        need(tw[c][1] == 0, "source pose has twist zero")
    end
    # Four-sticker distance table: ordered facelets on four distinct corners, goal = the four front cells.
    dist = fill(0xff, 24^4)
    goal = encode_key(GOAL...)
    dist[goal+1] = 0
    queue = [goal]
    for k in queue
        d = dist[k+1]
        for m in 1:18
            b = key_move(m, k)
            if dist[b+1] == 0xff
                dist[b+1] = d + 0x01
                push!(queue, b)
            end
        end
    end
    need(length(queue) == 24 * 21 * 18 * 15, "every ordered four-corner placement is covered")
    diameter = Int(maximum(d for d in dist if d != 0xff))
    Engine(pr, members, corner_of, local_of, poses, pose_index, ptrans, wh, tw, at, dist, diameter, length(queue))
end

glyph_matches(pr::Print, i, cell, letter, tens, units) =
    cell == 1 ? pr.image[i] == "" : cell == 2 ? pr.image[i] == letter :
    cell == 3 ? (pr.slot[i] == 2 && pr.image[i] == tens) : (pr.slot[i] == 3 && pr.image[i] == units)

function options(E::Engine, letter::String, value::Int)
    tens, units = string(value ÷ 10), string(value % 10)
    lists = [[i for i in 1:24 if glyph_matches(E.pr, i, cell, letter, tens, units)] for cell in 1:4]
    out = NTuple{4,Int}[]
    for a in lists[1], b in lists[2], c in lists[3], d in lists[4]
        length(Set((E.corner_of[a], E.corner_of[b], E.corner_of[c], E.corner_of[d]))) == 4 && push!(out, (a, b, c, d))
    end
    need(!isempty(out), "some distinct physical corner selection exists")
    out
end

# ---------------------------------------------------------------- physical frames
struct State
    p::Vector{V3}
    n::Vector{V3}
    up::Vector{V3}
end
Base.:(==)(a::State, b::State) = a.p == b.p && a.n == b.n && a.up == b.up
source_state(pr::Print) = State(copy(pr.p), copy(pr.n), copy(pr.up))
function turn(s::State, ms)
    p, n, up = copy(s.p), copy(s.n), copy(s.up)
    for m in ms
        a, side, q = move_axis(m), move_side(m), move_quarters(m)
        for i in 1:24
            if p[i][a] == side
                p[i], n[i], up[i] = rot(p[i], a, q), rot(n[i], a, q), rot(up[i], a, q)
            end
        end
    end
    State(p, n, up)
end
facelets(s::State) = [FIDX[(s.p[i], s.n[i])] for i in 1:24]
function show_display(pr::Print, s::State, letter, value)
    expected = ["", letter, string(value ÷ 10), string(value % 10)]
    for (cell, image) in enumerate(expected)
        hits = [i for i in 1:24 if s.p[i] == FRONT[cell] && s.n[i] == Z]
        need(length(hits) == 1 && pr.image[hits[1]] == image, "exact real-blank/fixed-glyph display")
        image != "" && need(s.up[hits[1]] == Y, "nonblank glyph upright")
    end
end
function cost(E::Engine, fac, opts)
    best = 255
    keys_ = Int[]
    for (a, b, c, d) in opts
        k = encode_key(fac[a], fac[b], fac[c], fac[d])
        dk = Int(E.dist[k+1])
        need(dk != 255, "reachable display")
        if dk < best
            best = dk
            empty!(keys_)
        end
        dk == best && push!(keys_, k)
    end
    best, sort!(unique!(keys_))
end
shortest(E::Engine, s::State, letter, value) = cost(E, facelets(s), options(E, letter, value))[1]
pose_of(E::Engine, s::State) = begin
    fac = facelets(s)
    [E.pose_index[c][ntuple(j -> fac[E.members[c][j]], 3)] for c in 1:8]
end

# ---------------------------------------------------------------- universal bound
function universal(E::Engine, limit::Int)
    legal = 0
    far = [k for k in 0:24^4-1 if limit < E.dist[k+1] < 255]
    rev = [Dict(E.poses[E.corner_of[i]][k][E.local_of[i]] => k for k in 1:24) for i in 1:24]
    key_of(o, poses) = encode_key((E.poses[E.corner_of[i]][poses[E.corner_of[i]]][E.local_of[i]] for i in o)...)
    for letter in ("H", "S", "M"), value in 0:59
        opts = options(E, letter, value)
        corners = [[E.corner_of[i] for i in o] for o in opts]
        count_in(c) = count(cs -> c in cs, corners)
        relevant = sort(unique(vcat(corners...)); by=c -> (!(c in corners[1]), -count_in(c), c))
        placed(poses, cs) = all(c -> poses[c] != 0, cs)
        function search!(poses, depth)
            if depth > length(relevant)
                return length(relevant) < 8 || sum(E.twist[c][poses[c]] for c in 1:8) % 3 == legal
            end
            c = relevant[depth]
            used = Set(E.where[d][poses[d]] for d in 1:8 if poses[d] != 0)
            for k in 1:24
                E.where[c][k] in used && continue
                poses[c] = k
                ok = true
                for (o, cs) in zip(opts, corners)
                    if c in cs && placed(poses, cs) && E.dist[key_of(o, poses)+1] <= limit
                        ok = false
                        break
                    end
                end
                ok && search!(poses, depth + 1) && return true
                poses[c] = 0
            end
            false
        end
        for k in far
            digits = (k ÷ 13824, (k ÷ 576) % 24, (k ÷ 24) % 24, k % 24)
            poses = zeros(Int, 8)
            for (i, f) in zip(opts[1], digits)
                poses[E.corner_of[i]] = rev[i][f]
            end
            any(placed(poses, cs) && E.dist[key_of(o, poses)+1] <= limit for (o, cs) in zip(opts, corners)) && continue
            if search!(poses, 5)
                return (false, letter, value)
            end
        end
    end
    (true, "", 0)
end

# ---------------------------------------------------------------- fractions
function parse_fraction(s, what)
    need(s isa AbstractString, what * " must be a string")
    m = match(r"^(0|[1-9][0-9]{0,8})(?:/([1-9][0-9]{0,8}))?$", s)
    need(m !== nothing, what * " must be a canonical fraction")
    num = parse(Int64, m.captures[1])
    den = m.captures[2] === nothing ? Int64(1) : parse(Int64, m.captures[2])
    need(gcd(num, den) == 1 && (m.captures[2] === nothing || den > 1), what * " must be in lowest terms")
    num, den
end
function frac_string(num, den)
    g = gcd(num, den)
    num, den = num ÷ g, den ÷ g
    den == 1 ? string(num) : string(num, "/", den)
end

# ---------------------------------------------------------------- mode replay
struct Mode
    letter::String
    maximum::Int
    direction::Int
    cap::Int
    graph_nodes::Int
    graph_edges::Int
    passes::Int
    mean::Tuple{Int64,Int64}
    period_htm::Int
    period_edges::Int
    max_htm::Int
    setup::Vector{Int}
    frames::State
    steps::Vector{Tuple{Int,Int,Vector{Int}}}
end

function parse_mode(m)
    exact_keys(m, ("letter", "maximum", "direction", "htmCap", "graphNodes", "graphEdges", "certificatePasses",
                   "optimalMeanHTM", "periodHTM", "periodEdges", "maximumHTM", "appPolicy13", "setup",
                   "periodStart", "periodStartFrames", "steps"), "mode")
    need(m["letter"] in ("H", "S", "M"), "letter H, S or M")
    maximum = IP.integer(m["maximum"], 0, 1000)
    need(maximum in (11, 23, 59), "range 11, 23 or 59")
    direction = IP.integer(m["direction"], -1, 1)
    need(direction in (-1, 1), "direction +1 or -1")
    cap = IP.integer(m["htmCap"], 1, 6)
    m["letter"] == "M" && need(cap <= 5, "M edges are capped at five HTM")
    exact_keys(m["appPolicy13"], ("preperiodEdges", "periodEdges", "periodHTM", "maximumHTM"), "appPolicy13")
    for v in values(m["appPolicy13"])
        IP.integer(v, 0, 10^9)
    end
    need(IP.integer(m["periodStart"], 0, 0) == 0, "period starts at the setup pose")
    frames = m["periodStartFrames"]
    need(frames isa AbstractVector && length(frames) == 24, "explicit 24-sticker period start pose")
    p, n, up = V3[], V3[], V3[]
    for (i, f) in enumerate(frames)
        exact_keys(f, ("id", "p", "n", "up"), "frame")
        need(IP.integer(f["id"], 0, 23) == i - 1, "frames ordered by sticker id")
        push!(p, vec3(f["p"], "p")); push!(n, vec3(f["n"], "n")); push!(up, vec3(f["up"], "up"))
    end
    steps = m["steps"]
    need(steps isa AbstractVector && 0 < length(steps) <= MAX_STEPS, "nonempty bounded period")
    parsed = Tuple{Int,Int,Vector{Int}}[]
    for s in steps
        exact_keys(s, ("from", "to", "word"), "step")
        w = parse_word(s["word"])
        need(!isempty(w), "every edge moves")
        push!(parsed, (IP.integer(s["from"], 0, 59), IP.integer(s["to"], 0, 59), w))
    end
    Mode(m["letter"], maximum, direction, cap, IP.integer(m["graphNodes"], 1, 10^9), IP.integer(m["graphEdges"], 1, 10^9),
         IP.integer(m["certificatePasses"], 0, 10^9), parse_fraction(m["optimalMeanHTM"], "optimalMeanHTM"),
         IP.integer(m["periodHTM"], 1, 10^9), IP.integer(m["periodEdges"], 1, 10^9), IP.integer(m["maximumHTM"], 1, 6),
         parse_word(m["setup"]), State(p, n, up), parsed)
end

function replay_mode(E::Engine, md::Mode, start::State)
    pr = E.pr
    n = md.maximum + 1
    state = turn(start, md.setup)
    show_display(pr, state, md.letter, 0)
    need(state == md.frames, "saved period start pose equals the replayed setup pose for every sticker frame")
    need(length(md.steps) % n == 0, "full laps")
    period_pose = state
    value = 0
    costs = Int[]
    poses = Vector{Int}[]
    seen = Set{Int}([0])
    for (from, to, word) in md.steps
        target = mod(value + md.direction, n)
        need((from, to) == (value, target), "exact modular order")
        c = length(word)
        need(c == shortest(E, state, md.letter, target), "shortest legal edge from the actual full source pose")
        push!(poses, pose_of(E, state))
        previous = state
        state = turn(state, word)
        show_display(pr, state, md.letter, target)
        need(turn(state, inverse_moves(word)) == previous, "every full physical edge inverse")
        push!(costs, c)
        value = target
        push!(seen, value)
    end
    need(value == 0 && state == period_pose, "exact 24-sticker full-period closure")
    need(maximum(costs) <= md.cap, "mode HTM ceiling")
    need(md.max_htm == maximum(costs) && md.period_htm == sum(costs) && md.period_edges == length(costs), "honest period metrics")
    need(md.mean == (Int64(md.period_htm) ÷ gcd(md.period_htm, md.period_edges), Int64(md.period_edges) ÷ gcd(md.period_htm, md.period_edges)),
         "honest exact period mean")
    # The same period run backwards (each edge inverted) must close the full pose and show every display.
    state = period_pose
    value = 0
    icosts = Int[]
    notshortest = 0
    for (from, to, word) in reverse(md.steps)
        need(value == to, "inverse traversal order")
        iw = inverse_moves(word)
        notshortest += length(iw) != shortest(E, state, md.letter, from)
        state = turn(state, iw)
        show_display(pr, state, md.letter, from)
        push!(icosts, length(iw))
        value = from
    end
    need(value == 0 && state == period_pose, "inverse traversal closes the full pose")
    (costs=costs, poses=poses, seen=seen, period_pose=period_pose,
     inverse=(sum(icosts), maximum(icosts), notshortest))
end

# ---------------------------------------------------------------- minimum-mean certificate
function perms4(xs)
    out = Vector{Vector{Int}}()
    for a in xs, b in xs, c in xs, d in xs
        length(Set((a, b, c, d))) == 4 && push!(out, [a, b, c, d])
    end
    out
end

function certify(E::Engine, md::Mode, replay)
    n = md.maximum + 1
    A, L = md.mean
    opts = [options(E, md.letter, v) for v in 0:n-1]
    # pose of corner c that puts local sticker j on a given facelet
    goalpose = Dict{Tuple{Int,Int},Int}()
    for i in 1:24, cell in 1:4
        c, j = E.corner_of[i], E.local_of[i]
        for k in 1:24
            E.poses[c][k][j] == GOAL[cell] && (goalpose[(i, cell)] = k)
        end
    end
    code_of(t) = begin
        x = Int64(0)
        for c in 8:-1:1
            x = x * 24 + (t[c] - 1)
        end
        x
    end
    index = Dict{Int64,Int32}()
    nodes = Vector{NTuple{8,UInt8}}()
    layer = Int32[]
    free_positions = [i for i in 1:8 if !(i - 1 in (position_index(f) for f in FRONT))]
    for v in 0:n-1, o in opts[v+1]
        fixed = zeros(Int, 8)
        for (cell, i) in enumerate(o)
            fixed[E.corner_of[i]] = goalpose[(i, cell)]
        end
        rest = [c for c in 1:8 if fixed[c] == 0]
        for perm in perms4(free_positions), a in E.at[rest[1]][perm[1]], b in E.at[rest[2]][perm[2]],
            c in E.at[rest[3]][perm[3]], d in E.at[rest[4]][perm[4]]
            t = copy(fixed)
            t[rest[1]], t[rest[2]], t[rest[3]], t[rest[4]] = a, b, c, d
            sum(E.twist[x][t[x]] for x in 1:8) % 3 == 0 || continue
            code = code_of(t)
            if !haskey(index, code)
                push!(nodes, ntuple(x -> UInt8(t[x]), 8))
                push!(layer, v)
                index[code] = length(nodes)
            end
        end
    end
    N = length(nodes)
    # shortest words, memoised by (remaining length, set of live four-sticker keys)
    memo = Dict{Tuple{Int,Vector{Int}},Vector{Vector{Int8}}}()
    function words(rem, keys_)
        rem == 0 && return [Int8[]]
        hit = get(memo, (rem, keys_), nothing)
        hit !== nothing && return hit
        out = Vector{Vector{Int8}}()
        for m in 1:18
            nxt = Int[]
            for k in keys_
                b = key_move(m, k)
                E.dist[b+1] == rem - 1 && push!(nxt, b)
            end
            isempty(nxt) && continue
            for w in words(rem - 1, sort!(unique!(nxt)))
                push!(out, vcat(Int8(m), w))
            end
        end
        memo[(rem, keys_)] = out
        out
    end
    costv = zeros(Int8, N)
    start = zeros(Int32, N + 1)
    succ = Int32[]
    fac = zeros(Int, 24)
    for i in 1:N
        t = nodes[i]
        for c in 1:8, j in 1:3
            fac[E.members[c][j]] = E.poses[c][t[c]][j]
        end
        nv = mod(layer[i] + md.direction, n)
        d, keys_ = cost(E, fac, opts[nv+1])
        costv[i] = d
        ends = Set{Int64}()
        for w in words(d, keys_)
            e = collect(Int, t)
            for m in w, c in 1:8
                e[c] = E.ptrans[c][m][e[c]]
            end
            push!(ends, code_of(e))
        end
        start[i] = length(succ) + 1
        for code in sort!(collect(ends))
            need(haskey(index, code), "every shortest-edge endpoint is an enumerated display node")
            push!(succ, index[code])
        end
    end
    start[N+1] = length(succ) + 1
    need(N == md.graph_nodes && length(succ) == md.graph_edges, "independent graph size equals the published size")
    # The saved period must be a cycle of this graph.
    for (k, pose) in enumerate(replay.poses)
        nxt = replay.poses[mod1(k + 1, length(replay.poses))]
        need(haskey(index, code_of(pose)) && haskey(index, code_of(nxt)), "saved poses are enumerated display nodes")
        i = index[code_of(pose)]
        need(index[code_of(nxt)] in view(succ, start[i]:start[i+1]-1), "saved edge is a graph edge")
        need(costv[i] == replay.costs[k], "saved edge cost equals the graph cost")
    end
    # Dual certificate: Bellman-Ford potentials for weights L*cost - A on nodes of cost <= cap.
    active = [costv[i] <= md.cap for i in 1:N]
    order = sortperm(layer; rev=md.direction == 1)
    pot = zeros(Int64, N)
    parent = zeros(Int32, N)
    passes = 0
    while true
        passes += 1
        passes > 20000 && throw(IP.Invalid("ERROR", "potentials did not converge"))
        updated = false
        for i in order
            active[i] || continue
            w = Int64(L) * costv[i] - A
            for e in start[i]:start[i+1]-1
                j = succ[e]
                if active[j] && w + pot[j] < pot[i]
                    pot[i] = w + pot[j]
                    parent[i] = j
                    updated = true
                end
            end
        end
        updated || break
        if passes % 8 == 0
            color = zeros(UInt8, N)
            for s0 in 1:N
                path = Int[]
                x = s0
                while x > 0 && color[x] == 0
                    color[x] = 1
                    push!(path, x)
                    x = parent[x]
                end
                need(!(x > 0 && color[x] == 1), "a recurrent shortest-edge schedule with a lower mean exists")
                for y in path
                    color[y] = 2
                end
            end
        end
    end
    for i in 1:N
        active[i] || continue
        for e in start[i]:start[i+1]-1
            j = succ[e]
            active[j] && need(Int64(L) * costv[i] - A + pot[j] - pot[i] >= 0, "exact dual feasibility of every edge")
        end
    end
    (nodes=N, edges=length(succ))
end

# ---------------------------------------------------------------- output
emit(x::Bool) = x ? "true" : "false"
emit(x::Integer) = string(x)
emit(x::AbstractString) = JSON.json(String(x))
emit(x::AbstractVector) = "[" * join((emit(v) for v in x), ",") * "]"
emit(x::Vector{<:Pair}) = "{" * join((emit(k) * ":" * emit(v) for (k, v) in x), ",") * "}"
emit(x::NamedTuple) = emit([string(k) => v for (k, v) in pairs(x)])

function check_hsm(data, input_sha)
    need(data isa AbstractDict && get(data, "schema", nothing) == PROFILE, "unsupported HSM witness schema"; code="UNSUPPORTED")
    exact_keys(data, ("schema", "version", "label", "printCode", "universalArbitrarySourceHTM", "printing", "modes"), "witness")
    need(data["version"] isa Integer && !(data["version"] isa Bool) && data["version"] == 1, "unsupported witness version"; code="UNSUPPORTED")
    need(data["label"] isa AbstractString && isvalid(data["label"]), "label must be a string")
    need(IP.integer(data["universalArbitrarySourceHTM"], 0, 100) == 6, "the profile publishes the six-HTM universal bound")
    pr = parse_print(data["printing"])
    need(data["printCode"] == print_code(pr), "printCode equals the printed stickers")
    E = build_engine(pr)
    need(E.diameter == 7, "single-target four-corner graph diameter seven")
    holds, bl, bv = universal(E, 6)
    need(holds, "universal six-HTM bound fails for display $(bl)$(lpad(bv, 2, '0'))")
    src = source_state(pr)
    max_from_print = 0
    for letter in ("H", "S", "M"), v in 0:59
        d = shortest(E, src, letter, v)
        need(d <= 6, "all 180 exact displays reachable from the print")
        max_from_print = max(max_from_print, d)
    end
    rawmodes = data["modes"]
    need(rawmodes isa AbstractVector && !isempty(rawmodes) && length(rawmodes) <= 18, "bounded nonempty mode list")
    modes = [parse_mode(m) for m in rawmodes]
    triples = [(m.letter, m.maximum, m.direction) for m in modes]
    need(length(Set(triples)) == length(triples), "distinct modes")
    need(all(t -> t in triples, REQUIRED_MODES), "the eight seconds-first modes are present")
    replays = [replay_mode(E, m, src) for m in modes]
    shown = Set{Tuple{String,Int}}()
    for (m, r) in zip(modes, replays), v in r.seen
        push!(shown, (m.letter, v))
    end
    need(all((l, v) in shown for l in ("S", "M") for v in 0:59) && all(("H", v) in shown for v in 0:23),
         "all S, M and H 00-23 displays physically witnessed")
    certified = Dict{Int,Any}()
    for i in sortperm([m.maximum for m in modes]; alg=MergeSort)
        certified[i] = certify(E, modes[i], replays[i])
    end
    rows = Any[]
    for (i, (m, r)) in enumerate(zip(modes, replays))
        laps = length(r.costs) ÷ (m.maximum + 1)
        push!(rows, (letter=m.letter, maximum=m.maximum, direction=m.direction, htmCap=m.cap,
                     periodEdges=length(r.costs), laps=laps, periodHTM=m.period_htm, maximumHTM=m.max_htm,
                     meanHTM=frac_string(m.mean...), perLapHTM=frac_string(m.period_htm, laps),
                     setupHTM=length(m.setup), graphNodes=certified[i].nodes, graphEdges=certified[i].edges,
                     minimumMeanCertified=true,
                     inverseTraversal=(periodHTM=r.inverse[1], maximumHTM=r.inverse[2], edgesNotShortest=r.inverse[3])))
    end
    emit([
        "valid" => true, "status" => "VALID", "profile" => PROFILE, "profileVersion" => 1,
        "inputSHA256" => input_sha, "printCode" => data["printCode"],
        "fourStickerPlacements" => E.reach, "fourStickerDiameter" => E.diameter,
        "universalBound" => (claimedHTM=6, holds=true, displays=180, maxFromPrintHTM=max_from_print),
        "modes" => rows,
        "displaysWitnessed" => (S=count(x -> x[1] == "S", shown), M=count(x -> x[1] == "M", shown), H=count(x -> x[1] == "H", shown)),
        "claims" => (globalPrintOptimality="UNKNOWN", conditionalLowerBound168="NOT_CHECKED",
                     wrapMinimaPerCycle="NOT_CERTIFIED", appPolicy13Figures="NOT_CHECKED",
                     certificatePasses="INFORMATIONAL"),
    ])
end

function evaluate(path)
    try
        data, sha = IP.read_json(path)
        (true, "VALID", check_hsm(data, sha))
    catch error
        d = IP.invalid_result(error)
        (false, d["status"], emit(["valid" => false, "status" => d["status"], "reason" => d["reason"]]))
    end
end

end
