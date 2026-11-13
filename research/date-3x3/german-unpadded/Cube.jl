# Own 3x3 move engine for the German unpadded study (Julia, standard library only).
# Geometry: x right, y up, z toward the viewer (front = +z). Right-hand rotations.
module Cube

export Pt, parse_word, apply_token, replay, Slot, slots, movetable, WORD_FACES, HOME
export inverse_word, compose, perm_inverse, front_slots, center_ids

const Pt = NTuple{3,Int}
const HOME = nothing

# base letter => (axis, layer or nothing, quarter turns right-hand rotation for one token)
const BASE = Dict(
    'R' => (1, 1, -1), 'L' => (1, -1, 1), 'M' => (1, 0, 1), 'x' => (1, nothing, -1),
    'U' => (2, 1, -1), 'D' => (2, -1, 1), 'E' => (2, 0, 1), 'y' => (2, nothing, -1),
    'F' => (3, 1, -1), 'B' => (3, -1, 1), 'S' => (3, 0, -1), 'z' => (3, nothing, -1),
)
const WORD_FACES = ["R", "R'", "R2", "L", "L'", "L2", "U", "U'", "U2", "D", "D'", "D2", "F", "F'", "F2", "B", "B'", "B2"]

# right-hand quarter rotation about axis a, q quarter turns
function rot(v::Pt, a::Int, q::Int)::Pt
    q = mod(q, 4)
    x, y, z = v
    for _ in 1:q
        if a == 1
            x, y, z = x, -z, y
        elseif a == 2
            x, y, z = z, y, -x
        else
            x, y, z = -y, x, z
        end
    end
    return (x, y, z)
end

function parse_word(w::AbstractString)
    toks = split(strip(w))
    for t in toks
        occursin(r"^[RLUDFBMESxyz](2|')?$", t) || error("illegal token $t")
    end
    return String.(toks)
end

function token_turn(t::AbstractString)
    axis, layer, q = BASE[t[1]]
    k = length(t) == 1 ? 1 : (t[2] == '2' ? 2 : -1)
    return axis, layer, q * k
end

# A sticker: position p, outward normal n, print-up vector u
struct Stk
    p::Pt
    n::Pt
    u::Pt
end

function apply_token(s::Stk, t::AbstractString)::Stk
    a, layer, q = token_turn(t)
    (layer !== nothing && s.p[a] != layer) && return s
    return Stk(rot(s.p, a, q), rot(s.n, a, q), rot(s.u, a, q))
end
apply_token(v::Vector{Stk}, t::AbstractString) = [apply_token(s, t) for s in v]
replay(v::Vector{Stk}, toks) = (for t in toks; v = apply_token(v, t); end; v)

function inverse_token(t::AbstractString)
    length(t) == 1 && return t * "'"
    t[2] == '2' ? t : string(t[1])
end
inverse_word(toks) = [inverse_token(t) for t in reverse(toks)]

# ---- permutation-table model: slots = (p,n) for the 48 corner/edge stickers,
#      and (n,up) frames for centers (24 frames). Slot index 1..72.
struct Slot
    p::Pt
    n::Pt
    u::Pt   # (0,0,0) for noncenter stickers
end

const AXES = Pt[(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
dot3(a, b) = a[1] * b[1] + a[2] * b[2] + a[3] * b[3]

function build_slots()
    P = [(x, y, z) for x in -1:1 for y in -1:1 for z in -1:1 if (x, y, z) != (0, 0, 0)]
    sl = Slot[]
    for p in P
        count(!iszero, p) == 1 && continue
        for n in AXES
            dot3(p, n) == 1 && push!(sl, Slot(p, n, (0, 0, 0)))
        end
    end
    @assert length(sl) == 48
    for n in AXES, u in AXES
        dot3(n, u) == 0 && push!(sl, Slot(n, n, u))
    end
    @assert length(sl) == 72
    return sl
end
const slots = build_slots()
const slotindex = Dict(s => i for (i, s) in enumerate(slots))

function movetable(t::AbstractString)::Vector{Int}
    a, layer, q = token_turn(t)
    tab = Vector{Int}(undef, 72)
    for (i, s) in enumerate(slots)
        if layer !== nothing && s.p[a] != layer
            tab[i] = i
        else
            tab[i] = slotindex[Slot(rot(s.p, a, q), rot(s.n, a, q), rot(s.u, a, q))]
        end
    end
    return tab
end

# state: Vector{Int} of length 54: slot of piece i (1..48 stickers, 49..54 centers)
# home state: stickers at their own slot; center c at frame slot 48 + index of canonical (n, upref)
center_ref_up(n) = n[2] != 0 ? (0, 0, -n[2]) : (0, 1, 0)   # same convention as the generator's solved()
const center_ids = [slotindex[Slot(n, n, center_ref_up(n))] for n in AXES]
home_state() = vcat(collect(1:48), center_ids)
apply_table(st::Vector{Int}, tab::Vector{Int}) = [tab[i] for i in st]

function compose(g::Vector{Int}, h::Vector{Int})  # g then h (both as slot maps on 1..72)
    [h[g[i]] for i in eachindex(g)]
end
function perm_inverse(g::Vector{Int})
    r = similar(g); for (i, v) in enumerate(g); r[v] = i; end; r
end

front_slots = [(x, y, 1) for y in (1, 0, -1) for x in (-1, 0, 1)]

end # module
