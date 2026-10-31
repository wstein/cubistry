# Exact closed-walk solver for a fixed print (candidate producer only).
# For a chain of displays it propagates the complete set of full cube states
# reachable with one edge of radius <= 3 per display (radius-4 fallback only
# where radius 3 is empty), keeping the minimum accumulated HTM per state.
# The walk must return to the exact start state (59->00, 23->00), and the
# 11->00 reset must reach the exact H00 start state as well.
include("engine.jl")

function costchain(s::State, targets::Vector{Target}, show, balls, cls, works; chord = nothing)
    sk = key(s)
    layers = [Dict(sk => 0)]
    radius = Int[]
    nears = chord === nothing ? Dict{UInt64,Int}[] :
        [Dict(key(applyelem(s, E)) => b.len[i] for (i, E) in enumerate(b.elems)) for b in balls]
    chordradius = 0
    for i in 2:length(targets)+1
        need = i <= length(targets) ? targets[i] : targets[1]
        last = i == length(targets) + 1
        cur = layers[end]
        nxt = Dict{UInt64,Int}()
        used = 0
        for (bi, b) in enumerate(balls)
            for (k, c) in cur
                st = unkey(k)
                foreachhit(st, show, need, cls[bi], works[bi]) do j
                    j <= length(b.elems) || return
                    t = key(applyelem(st, b.elems[j]))
                    (last && t != sk) && return
                    v = c + b.len[j]
                    (get(nxt, t, typemax(Int)) > v) && (nxt[t] = v)
                end
            end
            used = bi
            isempty(nxt) || break
        end
        if isempty(nxt)
            get(ENV, "HM_DEBUG", "") == "1" && println("costchain: empty at layer $i of $(length(targets)+1), previous size $(length(cur))")
            return nothing
        end
        push!(radius, used)
        if chord !== nothing && i == chord
            f = Dict{UInt64,Int}()
            for (bi, near) in enumerate(nears)
                f = Dict(k => v for (k, v) in nxt if haskey(near, k))
                chordradius = bi
                isempty(f) || break
            end
            isempty(f) && return nothing
            nxt = f
        end
        push!(layers, nxt)
    end
    (layers = layers, radius = radius, chordradius = chordradius)
end

# backtrack a min-total walk; returns forward words (move-index vectors)
function backtrack(res, targets, show, balls)
    n = length(targets)
    words = Vector{Vector{Int}}(undef, n)
    cur = unkey(only(keys(res.layers[end])))
    curcost = res.layers[end][key(cur)]
    for i in n:-1:1
        prev = res.layers[i]
        found = false
        for b in balls, (E, w) in zip(b.elems, b.words)
            p = applyword(cur, reverse([invmove(m) for m in w]))
            c = get(prev, key(p), -1)
            if c >= 0 && c + length(w) == curcost
                words[i] = w; cur = p; curcost = c; found = true; break
            end
        end
        found || error("backtrack failed at $i")
    end
    words
end

# minimum HTM (<= 4) from s to any state showing need; 99 if none
function lowerbound(s::State, need::Target, show, b4::Ball)
    best = 99
    for (i, E) in enumerate(b4.elems)
        b4.len[i] >= best && break
        shows(applyelem(s, E), show, need) && (best = b4.len[i])
    end
    best
end
