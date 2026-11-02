# Compute optimal all-pairs transitions for the 0-9 tenth counter at r2c1 with stationary T at r1c2.
# Generators: {L, D, B} in HTM (and QTM) preserving the URF corner (1, 1, 1).
# Front display constraints (all 4 front cells):
#   r1c1 (-1, 1, 1) = blank
#   r1c2 ( 1, 1, 1) = T (upright)
#   r2c1 (-1,-1, 1) = digit d (upright)
#   r2c2 ( 1,-1, 1) = blank

const Vec = NTuple{3,Int}
dotp(a, b) = a[1]*b[1] + a[2]*b[2] + a[3]*b[3]
crossp(a, b) = (a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1])
cw(v, a) = (d = dotp(v, a); c = crossp(a, v); (d*a[1]-c[1], d*a[2]-c[2], d*a[3]-c[3]))

const FACE = Dict('L'=>(-1,0,0), 'D'=>(0,-1,0), 'B'=>(0,0,-1))
const R1C1 = (-1,  1, 1)
const R1C2 = ( 1,  1, 1)
const R2C1 = (-1, -1, 1)
const R2C2 = ( 1, -1, 1)
const FRONT = (0, 0, 1)
const UP = (0, 1, 0)

struct Sticker
    pos::Vec
    nrm::Vec
    art::String
    up::Vec
end

# TENTH_PRINT 24 stickers
const RAW_STICKERS = [
    # Cubie 0: (-1, 1, 1) [ULF]
    ((-1, 1, 1), (-1, 0, 0), "blank", (0, 1, 0)),
    ((-1, 1, 1), (0, 1, 0), "1", (0, 0, -1)),
    ((-1, 1, 1), (0, 0, 1), "blank", (0, 1, 0)),
    # Cubie 1: (1, 1, 1) [URF]
    ((1, 1, 1), (1, 0, 0), "blank", (0, 1, 0)),
    ((1, 1, 1), (0, 1, 0), "blank", (0, 0, -1)),
    ((1, 1, 1), (0, 0, 1), "T", (0, 1, 0)),
    # Cubie 2: (-1, -1, 1) [DLF]
    ((-1, -1, 1), (-1, 0, 0), "6", (0, 0, -1)),
    ((-1, -1, 1), (0, -1, 0), "8", (1, 0, 0)),
    ((-1, -1, 1), (0, 0, 1), "0", (0, 1, 0)),
    # Cubie 3: (1, -1, 1) [DRF]
    ((1, -1, 1), (1, 0, 0), "9", (0, 1, 0)),
    ((1, -1, 1), (0, -1, 0), "blank", (0, 0, 1)),
    ((1, -1, 1), (0, 0, 1), "blank", (0, 1, 0)),
    # Cubie 4: (-1, 1, -1) [ULB]
    ((-1, 1, -1), (-1, 0, 0), "blank", (0, 1, 0)),
    ((-1, 1, -1), (0, 1, 0), "blank", (0, 0, -1)),
    ((-1, 1, -1), (0, 0, -1), "2", (0, -1, 0)),
    # Cubie 5: (1, 1, -1) [URB]
    ((1, 1, -1), (1, 0, 0), "blank", (0, 1, 0)),
    ((1, 1, -1), (0, 1, 0), "blank", (0, 0, -1)),
    ((1, 1, -1), (0, 0, -1), "4", (-1, 0, 0)),
    # Cubie 6: (-1, -1, -1) [DLB]
    ((-1, -1, -1), (-1, 0, 0), "5", (0, 1, 0)),
    ((-1, -1, -1), (0, -1, 0), "3", (0, 0, 1)),
    ((-1, -1, -1), (0, 0, -1), "blank", (0, 1, 0)),
    # Cubie 7: (1, -1, -1) [DRB]
    ((1, -1, -1), (1, 0, 0), "blank", (0, 1, 0)),
    ((1, -1, -1), (0, -1, 0), "blank", (0, 0, 1)),
    ((1, -1, -1), (0, 0, -1), "7", (0, 1, 0))
]

const INITIAL_STICKERS = [Sticker(p, n, a, u) for (p, n, a, u) in RAW_STICKERS]

function apply_move(stickers::Vector{Sticker}, face::Char, q::Int)
    axis = FACE[face]
    res = similar(stickers)
    for (i, s) in enumerate(stickers)
        if dotp(s.pos, axis) > 0
            p = s.pos
            n = s.nrm
            u = s.up
            for _ in 1:q
                p = cw(p, axis)
                n = cw(n, axis)
                u = s.art == "blank" ? u : cw(u, axis)
            end
            res[i] = Sticker(p, n, s.art, u)
        else
            res[i] = s
        end
    end
    return res
end

function apply_alg(stickers::Vector{Sticker}, alg::String)
    isempty(strip(alg)) && return stickers
    st = stickers
    for tok in split(strip(alg))
        face = tok[1]
        q = length(tok) == 1 ? 1 : (tok[2] == '\'' ? 3 : 2)
        st = apply_move(st, face, q)
    end
    return st
end

# Check display target: blank at r1c1 and r2c2, T upright at r1c2, digit d upright at r2c1
function matches_tenth_target(stickers::Vector{Sticker}, d::Int)
    r1c1_ok = false
    r1c2_ok = false
    r2c1_ok = false
    r2c2_ok = false
    for s in stickers
        if s.nrm == FRONT
            if s.pos == R1C1
                s.art == "blank" || return false
                r1c1_ok = true
            elseif s.pos == R1C2
                (s.art == "T" && s.up == UP) || return false
                r1c2_ok = true
            elseif s.pos == R2C1
                (s.art == string(d) && s.up == UP) || return false
                r2c1_ok = true
            elseif s.pos == R2C2
                s.art == "blank" || return false
                r2c2_ok = true
            end
        end
    end
    return r1c1_ok && r1c2_ok && r2c1_ok && r2c2_ok
end

# Periodic words
const TENTH_WORDS = ["L", "L", "B L", "B L", "D", "B D", "B L", "D", "L", "D"]

# Canonical states 0..9
canonical_states = Vector{Vector{Sticker}}(undef, 10)
let curr = INITIAL_STICKERS
    for i in 1:10
        canonical_states[i] = curr
        curr = apply_alg(curr, TENTH_WORDS[i])
    end
    @assert matches_tenth_target(canonical_states[1], 0)
    @assert curr == INITIAL_STICKERS
end

# All moves in HTM
const MOVES = [
    ("L", 'L', 1), ("L'", 'L', 3), ("L2", 'L', 2),
    ("D", 'D', 1), ("D'", 'D', 3), ("D2", 'D', 2),
    ("B", 'B', 1), ("B'", 'B', 3), ("B2", 'B', 2)
]

function state_key(stickers::Vector{Sticker})
    Tuple((s.pos, s.nrm, s.up) for s in stickers)
end

println("Computing optimal all-pairs transitions (0..9 to 0..9) with all 4 front cells checked...")

struct Transition
    from::Int
    to::Int
    alg::String
    htm::Int
    qtm::Int
end

function qtm_of(alg::String)
    isempty(strip(alg)) && return 0
    sum(tok -> endswith(tok, "2") ? 2 : 1, split(strip(alg)))
end

transitions = Transition[]

for from in 0:9
    start_state = canonical_states[from + 1]
    q = [(start_state, String[])]
    visited = Set([state_key(start_state)])
    found = Dict{Int, Vector{String}}()
    found[from] = String[]

    while !isempty(q) && length(found) < 10
        (st, path) = popfirst!(q)
        for (m_name, face, turns) in MOVES
            nxt = apply_move(st, face, turns)
            k = state_key(nxt)
            if !(k in visited)
                push!(visited, k)
                nxt_path = [path; m_name]
                for to in 0:9
                    if !haskey(found, to) && matches_tenth_target(nxt, to)
                        found[to] = nxt_path
                    end
                end
                if length(nxt_path) < 4
                    push!(q, (nxt, nxt_path))
                end
            end
        end
    end

    for to in 0:9
        if from != to
            alg_toks = found[to]
            alg = join(alg_toks, " ")
            htm = length(alg_toks)
            qtm = qtm_of(alg)
            push!(transitions, Transition(from, to, alg, htm, qtm))
        end
    end
end

println("Successfully computed $(length(transitions)) transitions!")

# Check distribution
counts = Dict{Int, Int}()
for t in transitions
    counts[t.htm] = get(counts, t.htm, 0) + 1
end
println("HTM counts: ", sort(collect(counts)))

# Write TSV
evidence_dir = normpath(joinpath(@__DIR__, "..", "evidence"))
tsv_path = joinpath(evidence_dir, "optimal-transitions.tsv")
open(tsv_path, "w") do io
    println(io, "from\tto\talg\thtm\tqtm")
    for t in transitions
        println(io, "$(t.from)\t$(t.to)\t$(t.alg)\t$(t.htm)\t$(t.qtm)")
    end
end
println("Wrote $tsv_path")

# Write JSON
json_path = joinpath(evidence_dir, "optimal-transitions.json")
open(json_path, "w") do io
    println(io, "{")
    println(io, "  \"schema\": \"cubistry.tenth-transitions\",")
    println(io, "  \"version\": 1,")
    println(io, "  \"generator\": \"{L, D, B}\",")
    println(io, "  \"frontCells\": { \"r1c1\": \"blank\", \"r1c2\": \"T\", \"r2c1\": \"digit\", \"r2c2\": \"blank\" },")
    println(io, "  \"totalTransitions\": $(length(transitions)),")
    println(io, "  \"transitions\": [")
    for (i, t) in enumerate(transitions)
        comma = i == length(transitions) ? "" : ","
        println(io, "    { \"from\": $(t.from), \"to\": $(t.to), \"alg\": \"$(t.alg)\", \"htm\": $(t.htm), \"qtm\": $(t.qtm) }$comma")
    end
    println(io, "  ]")
    println(io, "}")
end
println("Wrote $json_path")
