"""
Front-goal search for the 3x3 calendar cube (research prototype, not an app change).

Goal: exactly the app's acceptance predicate `matches(state, cells)` of `src/apps/calendar/model.ts`: the nine
front stickers carry `cells[i]` and every non-blank one is upright (`up == (0,1,0)`). Every other cubie is free.
Move group: the 18 outer turns (HTM), plus a free whole-cube rotation prefix (reported separately, as the app does).

Search: IDA* with pattern databases over cubies. Each database tracks four cubies (location digits 0..23 per
cubie, plus the absolute up direction of the front center) and is a multi-source BFS from every abstract
configuration that extends to an accepted front. The tables depend only on the print and the target cells,
never on the pose.
"""
module FrontGoal

export Sticker, Print, Pose, load_print, load_pose, apply_word, accepts, Heuristic, build_heuristic,
    solve_front, SolveResult, pose_field, parse_cells, rotation_words, front_cell_index

# The only mutation hook: the test runner sets FG_MUTATE to prove that tests fail for the intended reason.
const MUT = get(ENV, "FG_MUTATE", "")

const V3 = NTuple{3,Int}
struct Sticker
    p::V3
    n::V3
    up::V3
end
const Pose = Vector{Sticker}

struct Print
    id::String
    image::Vector{String}
    cubie::Vector{Int}
    solved::Pose
end

# ---------------------------------------------------------------- move engine (mirror of src/apps/calendar/model.ts)

quarter(v::V3, a::Int) =
    a == 0 ? (v[1], -v[3], v[2]) : a == 1 ? (v[3], v[2], -v[1]) : (-v[2], v[1], v[3])

# letter => (axis, layer or nothing, direction)
const FACES = Dict(
    'R' => (0, 1, -1), 'L' => (0, -1, 1), 'U' => (1, 1, -1), 'D' => (1, -1, 1),
    'F' => (2, 1, -1), 'B' => (2, -1, 1),
    'x' => (0, nothing, -1), 'y' => (1, nothing, -1), 'z' => (2, nothing, -1),
)

function token_info(t::AbstractString)
    m = match(r"^([RLUDFBxyz])(2|')?$", t)
    m === nothing && error("Illegal token $t")
    axis, layer, dir = FACES[m.captures[1][1]]
    turns = dir * (m.captures[2] == "2" ? 2 : m.captures[2] == "'" ? -1 : 1)
    return axis, layer, mod(turns, 4)
end

function apply_token(state::Pose, t::AbstractString)
    axis, layer, q = token_info(t)
    out = Vector{Sticker}(undef, length(state))
    for (i, s) in enumerate(state)
        if layer !== nothing && s.p[axis+1] != layer
            out[i] = s
            continue
        end
        p, n, up = s.p, s.n, s.up
        for _ in 1:q
            p = quarter(p, axis); n = quarter(n, axis); up = quarter(up, axis)
        end
        out[i] = Sticker(p, n, up)
    end
    return out
end

function apply_word(state::Pose, word::AbstractString)
    for t in split(word)
        state = apply_token(state, t)
    end
    return state
end

# ---------------------------------------------------------------- TSV exchange

function load_print(path::AbstractString)
    image = String[]; cubie = Int[]; st = Sticker[]
    id = replace(basename(path), r"^print-|\.tsv$" => "")
    for line in eachline(path)
        isempty(line) && continue
        f = split(line, '\t'; keepempty = true)
        push!(cubie, parse(Int, f[3]))
        a = [parse(Int, x) for x in split(f[4])]
        b = [parse(Int, x) for x in split(f[5])]
        c = [parse(Int, x) for x in split(f[6])]
        push!(st, Sticker((a[1], a[2], a[3]), (b[1], b[2], b[3]), (c[1], c[2], c[3])))
        push!(image, String(f[2]))
    end
    length(st) == 54 || error("print must have 54 stickers")
    return Print(id, image, cubie, st)
end

function load_pose(field::AbstractString)
    n = [parse(Int, x) for x in split(field)]
    length(n) == 54 * 9 || error("pose needs 486 integers")
    return Sticker[
        Sticker((n[o+1], n[o+2], n[o+3]), (n[o+4], n[o+5], n[o+6]), (n[o+7], n[o+8], n[o+9])) for
        o in 0:9:(54*9-9)
    ]
end

pose_field(p::Pose) = join(
    (join((s.p..., s.n..., s.up...), " ") for s in p), " ")

parse_cells(s::AbstractString) = String.(split(s, '|'; keepempty = true))

# ---------------------------------------------------------------- geometry tables

dot3(a::V3, b::V3) = a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
cross3(a::V3, b::V3) = (a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1])
const AXES = V3[(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]

# a rotation is the triple of images of the basis vectors
const ROTS = [(x, y, cross3(x, y)) for x in AXES for y in AXES if dot3(x, y) == 0]
rot(R, v::V3) = (
    v[1] * R[1][1] + v[2] * R[2][1] + v[3] * R[3][1],
    v[1] * R[1][2] + v[2] * R[2][2] + v[3] * R[3][2],
    v[1] * R[1][3] + v[2] * R[2][3] + v[3] * R[3][3],
)

# the 54 sticker locations (p, n) in the order of the app's solved state
const LOCS = [(p, n) for x in -1:1 for y in -1:1 for z in -1:1 if (x, y, z) != (0, 0, 0) for p in (V3((x, y, z)),)
              for n in AXES if dot3(p, n) == 1]
const LOCIDX = Dict(l => i for (i, l) in enumerate(LOCS))
nz(p::V3) = count(!=(0), p)
const CORNER_LOCS = [i for (i, l) in enumerate(LOCS) if nz(l[1]) == 3]
const EDGE_LOCS = [i for (i, l) in enumerate(LOCS) if nz(l[1]) == 2]
const DIGIT = zeros(Int, length(LOCS))   # location -> digit within its orbit (0..23)
for (d, i) in enumerate(CORNER_LOCS); DIGIT[i] = d - 1; end
for (d, i) in enumerate(EDGE_LOCS); DIGIT[i] = d - 1; end

const FACE_LETTERS = ['R', 'L', 'U', 'D', 'F', 'B']
const MOVES = [string(f, s) for f in FACE_LETTERS for s in ("", "2", "'")]   # 18, face-major
const MOVE_FACE = [div(i - 1, 3) + 1 for i in 1:18]

const PERM = Matrix{Int}(undef, 18, length(LOCS))
for (m, t) in enumerate(MOVES), (i, (p, n)) in enumerate(LOCS)
    s = apply_token([Sticker(p, n, p == n ? (0, 1, 0) : (0, 0, 0))], t)[1]
    PERM[m, i] = LOCIDX[(s.p, s.n)]
end
# digit moves per orbit
const DMOVE = Dict(
    :c => [DIGIT[PERM[m, CORNER_LOCS[d+1]]] for m in 1:18, d in 0:23],
    :e => [DIGIT[PERM[m, EDGE_LOCS[d+1]]] for m in 1:18, d in 0:23],
)

# absolute up directions of the front center sticker, and how each move changes them
const UP4 = V3[(0, 1, 0), (1, 0, 0), (0, -1, 0), (-1, 0, 0)]
const CUPNEXT = Matrix{Int}(undef, 18, 4)
for (m, t) in enumerate(MOVES), c in 1:4
    s = apply_token([Sticker((0, 0, 1), (0, 0, 1), UP4[c])], t)[1]
    CUPNEXT[m, c] = findfirst(==(s.up), UP4)
end

# front slots in the order of the app's `front()`: y = 1,0,-1 and x = -1,0,1; slot 5 (index 4) is the center
const SLOT_LOC = [LOCIDX[(V3((x, y, 1)), V3((0, 0, 1)))] for y in (1, 0, -1) for x in (-1, 0, 1)]
const SLOT_OF_LOC = Dict(l => j for (j, l) in enumerate(SLOT_LOC))
const NONCENTER_SLOTS = [1, 2, 3, 4, 6, 7, 8, 9]
front_cell_index = 5

# the rotation taking a print sticker (p0, n0) to a location, or nothing (centers are ambiguous and excluded)
function rigid(p0::V3, n0::V3, loc::Int)
    p, n = LOCS[loc]
    nz(p0) == 1 && return nothing
    for R in ROTS
        rot(R, p0) == p && rot(R, n0) == n && return R
    end
    return nothing
end

# ---------------------------------------------------------------- goal predicate and cubie tables

struct Cubie
    orbit::Symbol          # :c or :e
    stickers::Vector{Int}  # print sticker indices (1-based); the first is the reference sticker
    locs::Vector{Vector{Int}}  # locs[d+1][i] = location of stickers[i] when the reference sticker is at digit d
end

function cubies_of(pr::Print)
    out = Cubie[]
    for c in sort(unique(pr.cubie))
        ks = [k for k in 1:54 if pr.cubie[k] == c]
        p0 = pr.solved[ks[1]].p
        nz(p0) == 1 && continue
        orbit = nz(p0) == 3 ? :c : :e
        list = orbit == :c ? CORNER_LOCS : EDGE_LOCS
        locs = Vector{Vector{Int}}()
        for L in list
            R = rigid(pr.solved[ks[1]].p, pr.solved[ks[1]].n, L)
            R === nothing && error("no rigid map")
            push!(locs, [LOCIDX[(rot(R, pr.solved[k].p), rot(R, pr.solved[k].n))] for k in ks])
        end
        push!(out, Cubie(orbit, ks, locs))
    end
    return out
end

"""
accepts(pr, cells)[j][k]: sticker k (1-based) is acceptable on non-center slot j (1..9). Mirrors `matches()`:
the image must equal the cell, and a non-blank image must be upright.
"""
function accepts(pr::Print, cells::Vector{String})
    acc = falses(9, 54)
    for j in NONCENTER_SLOTS, k in 1:54
        s = pr.solved[k]
        pr.image[k] == cells[j] || continue
        R = rigid(s.p, s.n, SLOT_LOC[j])
        R === nothing && continue
        if MUT == "ignore_up" || pr.image[k] == "" || rot(R, s.up) == (0, 1, 0)
            acc[j, k] = true
        end
    end
    MUT == "drop_slot9" && (acc[9, :] .= true)
    return acc
end

center_ok(cells::Vector{String}, cup::Int) =
    MUT == "ignore_center_up" || cells[5] == "" || cup == 1

# ---------------------------------------------------------------- pattern databases

const TSIZE = 24^4
const MOVE_TABLES = Dict{NTuple{4,Symbol},Matrix{UInt32}}()

function move_table(types::NTuple{4,Symbol})
    get!(MOVE_TABLES, types) do
        tbl = Matrix{UInt32}(undef, 18, TSIZE)
        dm = [DMOVE[t] for t in types]
        for idx in 0:TSIZE-1
            d1 = idx % 24; d2 = (idx ÷ 24) % 24; d3 = (idx ÷ 576) % 24; d4 = idx ÷ 13824
            for m in 1:18
                tbl[m, idx+1] = dm[1][m, d1+1] + 24 * dm[2][m, d2+1] + 576 * dm[3][m, d3+1] + 13824 * dm[4][m, d4+1]
            end
        end
        tbl
    end
end

struct PDB
    types::NTuple{4,Symbol}
    cubies::NTuple{4,Int}      # indices into Heuristic.cubies
    dist::Vector{UInt8}        # index = tuple + TSIZE * (cup - 1), 255 = unreachable
end

struct Heuristic
    print::Print
    cells::Vector{String}
    cubies::Vector{Cubie}
    acc::BitMatrix
    pdbs::Vector{PDB}
    build_ms::Float64
    bytes::Int
end

function build_pdb(cubies::Vector{Cubie}, sel::NTuple{4,Int}, acc::BitMatrix, cells::Vector{String}, anyfree::Vector{Bool}, free_ok_slots)
    types = ntuple(i -> cubies[sel[i]].orbit, 4)
    tbl = move_table(types)
    dist = fill(0xff, 4 * TSIZE)
    # per tracked cubie and digit: slot occupancy and acceptance
    occ = [[Tuple{Int,Bool}[] for _ in 0:23] for _ in 1:4]
    for i in 1:4, d in 0:23
        cb = cubies[sel[i]]
        for (si, loc) in enumerate(cb.locs[d+1])
            j = get(SLOT_OF_LOC, loc, 0)
            j == 0 && continue
            push!(occ[i][d+1], (j, acc[j, cb.stickers[si]]))
        end
    end
    queue = UInt32[]
    for cup in 1:4
        center_ok(cells, cup) || continue
        for idx in 0:TSIZE-1
            d = (idx % 24, (idx ÷ 24) % 24, (idx ÷ 576) % 24, idx ÷ 13824)
            # two tracked cubies cannot share a cubie position: reject digits of one orbit on the same position
            filled = 0; ok = true
            for i in 1:4
                for (j, a) in occ[i][d[i]+1]
                    if !a || (filled >> j) & 1 == 1
                        ok = false
                    end
                    filled |= 1 << j
                end
                ok || break
            end
            ok || continue
            for j in NONCENTER_SLOTS
                (filled >> j) & 1 == 1 && continue
                (anyfree[j] && MUT != "strict_sources") || (ok = false)
            end
            ok || continue
            dist[idx+1+TSIZE*(cup-1)] = 0
            push!(queue, UInt32(idx + TSIZE * (cup - 1)))
        end
    end
    head = 1; level = 0
    next = UInt32[]
    cur = queue
    while !isempty(cur)
        empty!(next)
        for s in cur
            idx = Int(s) % TSIZE; cup = Int(s) ÷ TSIZE + 1
            for m in 1:18
                ni = Int(tbl[m, idx+1]) + TSIZE * (CUPNEXT[m, cup] - 1)
                if dist[ni+1] == 0xff
                    dist[ni+1] = UInt8(level + 1)
                    push!(next, UInt32(ni))
                end
            end
        end
        level += 1
        cur, next = next, cur
    end
    return PDB(types, sel, dist)
end

"""
Builds the tracked-cubie databases for one print and one set of cells. Cubies are ranked by how strongly the
cells require them (1 / number of acceptable stickers per slot); corners and edges are then grouped by four.
"""
function build_heuristic(pr::Print, cells::Vector{String})
    t0 = time_ns()
    cubies = cubies_of(pr)
    acc = accepts(pr, cells)
    score = zeros(length(cubies))
    for j in NONCENTER_SLOTS
        ks = findall(acc[j, :])
        isempty(ks) && continue
        for (ci, cb) in enumerate(cubies), k in cb.stickers
            k in ks && (score[ci] += 1 / length(ks))
        end
    end
    rank(orbit) = sort([i for (i, c) in enumerate(cubies) if c.orbit == orbit]; by = i -> (-score[i], i))
    cs = rank(:c); es = rank(:e)
    groups = Vector{NTuple{4,Int}}()
    push!(groups, Tuple(cs[1:4])); push!(groups, Tuple(cs[5:8]))
    for g in 1:3; push!(groups, Tuple(es[4g-3:4g])); end
    push!(groups, (cs[1], cs[2], es[1], es[2]))
    push!(groups, (cs[3], cs[4], es[3], es[4]))
    push!(groups, (cs[1], cs[2], cs[3], es[1]))
    push!(groups, (es[1], es[2], es[3], cs[1]))
    pdbs = PDB[]
    for sel in groups
        # a slot not filled by a tracked cubie needs an acceptable untracked sticker
        anyfree = fill(false, 9)
        for j in NONCENTER_SLOTS
            for (ci, cb) in enumerate(cubies)
                ci in sel && continue
                any(k -> acc[j, k], cb.stickers) && (anyfree[j] = true)
            end
        end
        push!(pdbs, build_pdb(cubies, sel, acc, cells, anyfree, nothing))
    end
    bytes = sum(length(p.dist) for p in pdbs)
    return Heuristic(pr, cells, cubies, acc, pdbs, (time_ns() - t0) / 1e6, bytes)
end

# ---------------------------------------------------------------- full goal check (independent of the databases)

"""True iff `pose` satisfies the nine-cell predicate; this is a direct re-statement of `matches()`."""
function matches_pose(pr::Print, cells::Vector{String}, pose::Pose)
    for j in 1:9
        MUT == "drop_slot9" && j == 9 && continue
        l = LOCS[SLOT_LOC[j]]
        k = findfirst(s -> (s.p, s.n) == l, pose)
        k === nothing && return false
        s = pose[k]
        pr.image[k] == cells[j] || return false
        MUT == "ignore_up" && continue
        MUT == "ignore_center_up" && j == 5 && continue
        (pr.image[k] == "" || s.up == (0, 1, 0)) || return false
    end
    return true
end

# ---------------------------------------------------------------- rotations

"""Minimal rotation words (tokens x y z with ' and 2) for all 24 whole-cube orientations; identity first."""
function rotation_words()
    probe = Sticker[Sticker((0, 0, 1), (0, 0, 1), (0, 1, 0)), Sticker((1, 1, 1), (1, 0, 0), (0, 1, 0))]
    key(s) = [(a.p, a.n, a.up) for a in s]
    seen = Dict(key(probe) => "")
    order = [("", probe)]
    for (w, st) in order, t in ("x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2")
        ns = apply_token(st, t)
        k = key(ns)
        haskey(seen, k) && continue
        word = isempty(w) ? t : w * " " * t
        seen[k] = word
        push!(order, (word, ns))
    end
    length(order) == 24 || error("rotation group incomplete: $(length(order))")
    return [w for (w, _) in order]
end
const ROTWORDS = rotation_words()

# ---------------------------------------------------------------- IDA*

struct SolveResult
    status::Symbol          # :solved, :none_within (no route up to maxdepth), :limit (node or time limit)
    word::String            # rotation prefix plus outer turns
    htm::Int
    rotations::Int
    nodes::Int
    ms::Float64
    root_h::Int             # best (smallest) root heuristic over the candidate rotations
end

mutable struct Search
    h::Heuristic
    npdb::Int
    ti::Matrix{Int}      # depth x pdb
    cup::Vector{Int}
    path::Vector{Int}
    nodes::Int
    limit::Int
    deadline::UInt64
    aborted::Bool
    pose::Pose
    start_digits::Vector{Int}
    tables::Vector{Matrix{UInt32}}
end

function root_index(h::Heuristic, pose::Pose, pdb::PDB)
    idx = 0; mul = 1
    for i in 1:4
        cb = h.cubies[pdb.cubies[i]]
        s = pose[cb.stickers[1]]
        d = DIGIT[LOCIDX[(s.p, s.n)]]
        idx += d * mul
        mul *= 24
    end
    return idx
end

function hval(h::Heuristic, ti::AbstractVector{Int}, cup::Int)
    best = 0
    for (i, pdb) in enumerate(h.pdbs)
        v = pdb.dist[ti[i]+1+TSIZE*(cup-1)]
        v == 0xff && return 255
        v > best && (best = Int(v))
    end
    MUT == "h_plus_one" && best > 0 && (best += 1)
    return best
end

function replay(pose::Pose, path::Vector{Int}, depth::Int)
    for i in 1:depth
        pose = apply_token(pose, MOVES[path[i]])
    end
    return pose
end

function dfs!(S::Search, depth::Int, bound::Int, last_face::Int)::Bool
    S.nodes += 1
    if (S.nodes & 0xfff) == 0
        if S.nodes > S.limit || time_ns() > S.deadline
            S.aborted = true
            return false
        end
    end
    h = hval(S.h, view(S.ti, depth + 1, :), S.cup[depth+1])
    depth + h > bound && return false
    if depth == bound
        h == 0 || return false
        return matches_pose(S.h.print, S.h.cells, replay(S.pose, S.path, depth))
    end
    for m in 1:18
        f = MOVE_FACE[m]
        f == last_face && continue
        # opposite faces commute: only allow the order R-before-L, U-before-D, F-before-B
        iseven(last_face) && last_face > 0 && f == last_face - 1 && continue
        for i in 1:S.npdb
            S.ti[depth+2, i] = Int(S.tables[i][m, S.ti[depth+1, i]+1])
        end
        S.cup[depth+2] = CUPNEXT[m, S.cup[depth+1]]
        S.path[depth+1] = m
        dfs!(S, depth + 1, bound, f) && return true
        S.aborted && return false
    end
    return false
end

"""
Optimal front-goal route for `pose` (outer turns, rotations free), searching depths 0..maxdepth.
Candidate rotations are those that bring a center with the required image to the front.
"""
function solve_front(h::Heuristic, pose::Pose; maxdepth::Int = 12, node_limit::Int = typemax(Int),
        time_limit_s::Float64 = 300.0, rotations::Symbol = :free)
    t0 = time_ns()
    pr = h.print
    cands = Tuple{String,Pose,Int}[]
    for w in (rotations == :free ? ROTWORDS : [""])
        q = apply_word(pose, w)
        ci = findfirst(s -> (s.p, s.n) == (V3((0, 0, 1)), V3((0, 0, 1))), q)
        pr.image[ci] == h.cells[5] || continue
        push!(cands, (w, q, findfirst(==(q[ci].up), UP4)))
    end
    isempty(cands) && return SolveResult(:none_within, "", 0, 0, 0, 0.0, -1)
    tables = [move_table(p.types) for p in h.pdbs]
    searches = Search[]
    root_hs = Int[]
    for (w, q, cu) in cands
        S = Search(h, length(h.pdbs), zeros(Int, maxdepth + 2, length(h.pdbs)), zeros(Int, maxdepth + 2),
            zeros(Int, maxdepth + 1), 0, node_limit, t0 + UInt64(round(time_limit_s * 1e9)), false, q, Int[], tables)
        for (i, p) in enumerate(h.pdbs)
            S.ti[1, i] = root_index(h, q, p)
        end
        S.cup[1] = cu
        push!(searches, S)
        push!(root_hs, hval(h, view(S.ti, 1, :), cu))
    end
    total_nodes = 0
    best_word = ""; best_rot = 99; found_bound = -1
    for bound in 0:maxdepth
        for (ci, S) in enumerate(searches)
            root_hs[ci] > bound && continue
            S.aborted = false
            ok = dfs!(S, 0, bound, 0)
            total_nodes += S.nodes; S.nodes = 0
            if S.aborted
                return SolveResult(:limit, "", 0, 0, total_nodes, (time_ns() - t0) / 1e6, minimum(root_hs))
            end
            if ok
                w = cands[ci][1]
                rots = isempty(w) ? 0 : length(split(w))
                if rots < best_rot
                    best_rot = rots
                    best_word = join(filter(!isempty, [w, join((MOVES[S.path[i]] for i in 1:bound), " ")]), " ")
                    found_bound = bound
                end
            end
        end
        found_bound >= 0 && return SolveResult(:solved, best_word, found_bound, best_rot, total_nodes,
            (time_ns() - t0) / 1e6, minimum(root_hs))
    end
    return SolveResult(:none_within, "", 0, 0, total_nodes, (time_ns() - t0) / 1e6, minimum(root_hs))
end

end # module
