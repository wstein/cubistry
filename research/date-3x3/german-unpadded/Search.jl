# Searches for pure-center words: slice-only BFS and outer-turn meet-in-the-middle.
module Search
using ..Cube
export slice_bfs, mitm_outer, rotation_names, st_of_word, rot_table

const ROTS = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"]
rotation_names() = ROTS

tabcache = Dict{String,Vector{Int}}()
tab(t) = get!(() -> movetable(t), tabcache, t)

home() = vcat(collect(1:48), Cube.center_ids)
step(st, t) = (T = tab(t); [T[i] for i in st])
st_of_word(toks) = (st = home(); for t in toks; st = step(st, t); end; st)

# Effect of a whole-cube rotation word as a 72-slot table
function rot_table(toks)
    T = collect(1:72)
    for t in toks; T = Cube.compose(T, tab(t)); end
    T
end

# slice-only words (M,E,S): min cost words per reachable state, cost = :stm or :qtm
function slice_bfs(maxcost::Int; metric::Symbol)
    moves = [string(c, m) for c in "MES" for m in ["", "'", "2"]]
    cost(t) = metric == :stm ? 1 : (endswith(t, "2") ? 2 : 1)
    best = Dict{Vector{Int},Tuple{Int,Vector{String}}}()
    best[home()] = (0, String[])
    frontier = Dict{Int,Vector{Vector{Int}}}(0 => [home()])
    for c in 0:maxcost
        for st in get(frontier, c, Vector{Int}[])
            best[st][1] == c || continue
            w = best[st][2]
            for t in moves
                nst = step(st, t); nc = c + cost(t)
                nc > maxcost && continue
                if !haskey(best, nst) || best[nst][1] > nc
                    best[nst] = (nc, vcat(w, [t]))
                    push!(get!(frontier, nc, Vector{Int}[]), nst)
                end
            end
        end
    end
    best
end

# Outer-turn meet in the middle: all face-only words V with edge/corner effect = target (48-vector),
# depth(V) = a+b with a,b <= half.  Returns (length, words).
struct Entry; depth::UInt8; last::UInt8; end
const FACES = WORD_FACES
function bfs_table(half::Int)
    T = [tab(t)[1:48] for t in FACES]   # restrict to slots 1..48 (closed under faces)
    key(st) = NTuple{48,UInt8}(st)
    id = UInt8.(1:48)
    D = Dict{NTuple{48,UInt8},Entry}(key(id) => Entry(0, 0xff))
    fr = [id]
    for d in 1:half
        nf = Vector{Vector{UInt8}}()
        for st in fr
            lastm = D[key(st)].last
            for (mi, t) in enumerate(FACES)
                lastm != 0xff && FACES[lastm][1] == t[1] && continue   # same face twice is redundant
                nst = UInt8[T[mi][i] for i in st]
                k = key(nst)
                haskey(D, k) && continue
                D[k] = Entry(d, UInt8(mi)); push!(nf, nst)
            end
        end
        fr = nf
    end
    D, T
end

function word_of(D, T, st::Vector{UInt8})
    toks = String[]
    while true
        e = D[NTuple{48,UInt8}(st)]
        e.depth == 0 && break
        m = e.last
        pushfirst!(toks, FACES[m])
        inv = Cube.perm_inverse(Int.(T[m]))
        st = UInt8[inv[i] for i in st]
    end
    toks
end

function mitm_outer(D, T, target::Vector{Int}; maxlen::Int)
    t = UInt8.(target)
    found = Vector{Vector{String}}()
    bestlen = typemax(Int)
    for (kb, eb) in D
        stB = collect(kb)
        invB = Cube.perm_inverse(Int.(stB))
        stA = UInt8[invB[i] for i in t]
        ea = get(D, NTuple{48,UInt8}(stA), nothing)
        ea === nothing && continue
        len = Int(ea.depth) + Int(eb.depth)
        len > min(maxlen, bestlen) && continue
        wA = word_of(D, T, stA); wB = word_of(D, T, collect(kb))
        w = vcat(wA, wB)
        if len < bestlen; bestlen = len; empty!(found); end
        push!(found, w)
    end
    bestlen, unique(found)
end
export bfs_table
end
