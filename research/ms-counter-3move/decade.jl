# Decade-periodic construction search in the pool model (generator side only).
#
# Structure: four "units" corners carry the ten units digits, two "tens"
# corners T1/T2 carry tens 0-2 and 3-5. Every decade uses the same 9-step
# units word W (each step one of the six 3-HTM units elements). The decade
# step d (any pool element within 3 HTM) must undo W on the four units corners,
# so every decade sees the same units faces in the same order, while it turns
# or swaps the tens corners. The tens print is assigned lazily; the six decades
# must return to the exact start state (exact closure, period 1).
include("pool.jl")

const UNITSEL = [j for j in 2:length(PB3.elems) if begin
    E = PB3.elems[j]; at = cubieat(E)
    at[CELLIDX[3]] == CELLIDX[3] && E[at[CELLIDX[3]]] == 1 &&
    E[at[CELLIDX[1]]] == 1 && at[CELLIDX[4]] != CELLIDX[4]
end]
const QPOS = [CELLIDX[4]; [p for p in BACKPOS]]
const LLC = findfirst(c -> PIDX[c, 1] == CELLIDX[3], 1:8)
const LRC = findfirst(c -> PIDX[c, 1] == CELLIDX[4], 1:8)

frontface(s::State, k) = (c = cubieat(s)[CELLIDX[k]]; FRONT[c, s[c]][2])   # sticker id

function searchW(P::Int; report = 50)
    T2 = findfirst(c -> PIDX[c, 1] == P, 1:8)
    units = [c for c in POOLC if c != LLC && c != T2]
    found = 0; nW = 0
    words = Int[]
    faces = [frontface(IDSTATE, 4)]
    function rec(s::State)
        if length(words) == 9
            nW += 1
            tryW(s, copy(words), copy(faces), units, T2) && (found += 1)
            return
        end
        for j in UNITSEL
            t = applyelem(s, PB3.elems[j])
            c = cubieat(t)[CELLIDX[4]]
            c == T2 && continue
            f = frontface(t, 4)
            f in faces && continue
            push!(words, j); push!(faces, f)
            rec(t)
            pop!(words); pop!(faces)
            found >= report && return
        end
    end
    rec(IDSTATE)
    println("P=$P words=$nW found=$found"); flush(stdout)
end

const SOLS = Any[]
function tryW(N::State, W, faces, units, T2)
    ds = Int[]
    for j in 2:length(PB3.elems)
        M = applyelem(N, PB3.elems[j])
        all(c -> M[c] == 1, units) && push!(ds, j)
    end
    isempty(ds) && return false
    # DFS over 6 decades with lazy tens print (sticker id -> tens digit)
    tens = Dict{Int,Int}(frontface(IDSTATE, 3) => 0)
    chosen = Int[]
    function dec(s::State, x)
        if x == 6
            return s == IDSTATE
        end
        sW = applyword_elems(s, W)
        for j in ds
            t = applyelem(sW, PB3.elems[j])
            nx = (x + 1) % 6
            f = frontface(t, 3)
            # tens faces must lie on the tens corners
            c = cubieat(t)[CELLIDX[3]]
            (c == LLC || c == T2) || continue
            if haskey(tens, f)
                tens[f] == nx || continue
                push!(chosen, j)
                dec(t, x + 1) && return true
                pop!(chosen)
            else
                nx in values(tens) && continue
                tens[f] = nx; push!(chosen, j)
                dec(t, x + 1) && return true
                pop!(chosen); delete!(tens, f)
            end
        end
        false
    end
    if dec(IDSTATE, 0)
        push!(SOLS, (W, faces, copy(chosen), copy(tens)))
        println("SOLUTION W=", join([join(MOVENAMES[PB3.words[j]], " ") for j in W], " | "),
                " decades=", join([join(MOVENAMES[PB3.words[j]], " ") for j in chosen], " | "))
        flush(stdout)
        return true
    end
    false
end
applyword_elems(s, W) = foldl((a, j) -> applyelem(a, PB3.elems[j]), W; init = s)

if abspath(PROGRAM_FILE) == @__FILE__
    println("units elements: ", [join(MOVENAMES[PB3.words[j]], " ") for j in UNITSEL])
    for P in BACKPOS
        searchW(P; report = 3)
    end
end
