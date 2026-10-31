# Cyclic layered graph + value iteration (generator side only).
# Layer i = all pool-model states showing display i (i = 0..59). Arcs use the
# restricted radius-4 ball; weight = 1000 * [HTM == 4] + HTM. The minimum mean
# weight per 60-edge cycle is approached by value iteration; the policy is
# backtracked to an eventually periodic walk (run-in + period).
include("pool.jl")
const PB4 = restrictball(makeball(4))
const PC4 = makeclasses(PB4)
const PW4 = Work(PC4.nwords)
w4(len) = len == 4 ? 1000 + len : len

poolok(k) = (s = unkey(k); PIDX[ULC, s[ULC]] == CELLIDX[1] && s[URC] == 1)

struct Layered
    layers::Vector{Vector{UInt64}}
    adj::Vector{Vector{Vector{Tuple{Int32,Int32,Int32}}}}  # layer -> state -> (target idx, weight, elem)
end

function buildlayered(sh, L; maxw = typemax(Int))
    tg = targets(L)
    layers = [filter(poolok, allshowing(sh, tg[i])) for i in 1:60]
    adj = Vector{Vector{Vector{Tuple{Int32,Int32,Int32}}}}(undef, 60)
    for i in 1:60
        nxtL = layers[mod(i, 60)+1]
        need = tg[mod(i, 60)+1]
        A = Vector{Vector{Tuple{Int32,Int32,Int32}}}(undef, length(layers[i]))
        for (a, k) in enumerate(layers[i])
            s = unkey(k)
            best = Dict{Int,Tuple{Int,Int}}()
            foreachhit(s, sh, need, PC4, PW4) do e
                e == 1 && return
                w = w4(PB4.len[e])
                w > maxw && return
                kt = key(applyelem(s, PB4.elems[e]))
                b = searchsortedfirst(nxtL, kt)
                (b <= length(nxtL) && nxtL[b] == kt) || return
                (haskey(best, b) && best[b][1] <= w) || (best[b] = (w, e))
            end
            A[a] = [(Int32(b), Int32(w), Int32(e)) for (b, (w, e)) in best]
        end
        adj[i] = A
    end
    Layered(layers, adj)
end

const INF = typemax(Int) ÷ 4
# value iteration for K cycles; returns per-cycle minima and back pointers
function valueiter(G::Layered, K)
    f = zeros(Int, length(G.layers[1]))
    mins = Int[]
    back = Vector{Vector{Vector{Int32}}}()   # (cycle*60 + layer) -> pred index
    for k in 1:K
        cur = f
        for i in 1:60
            nn = length(G.layers[mod(i, 60)+1])
            g = fill(INF, nn); bp = zeros(Int32, nn)
            for (a, arcs) in enumerate(G.adj[i])
                cur[a] >= INF && continue
                for (b, w, _) in arcs
                    v = cur[a] + w
                    if v < g[b]
                        g[b] = v; bp[b] = a
                    end
                end
            end
            push!(back, [bp]); cur = g
        end
        f = cur
        push!(mins, minimum(f))
        mins[end] >= INF && break
    end
    f, mins, back
end

# backtrack from the best final state; find the last repeated layer-0 state
function extractperiod(G::Layered, f, back, K)
    t = argmin(f)
    seq = Int[]          # layer-0 indices at cycle boundaries, newest first
    path = Int[]          # per-step state indices, newest first
    push!(seq, t)
    idx = t
    for step in (60K):-1:1
        push!(path, idx)
        idx = back[step][1][idx]
        idx == 0 && error("broken back pointer")
        (step - 1) % 60 == 0 && push!(seq, idx)
    end
    push!(path, idx)
    reverse!(path); reverse!(seq)   # path[1] = layer-0 state at cycle 0
    # find a repetition seq[a] == seq[b], b > a, minimal b
    for b in 2:length(seq), a in b-1:-1:1
        if seq[a] == seq[b]
            return (path, a - 1, b - a)   # run-in cycles, period cycles
        end
    end
    (path, -1, -1)
end

function arcof(G, i, a, b)
    best = (typemax(Int32), Int32(0))
    for (bb, w, e) in G.adj[i][a]
        bb == b && w < best[1] && (best = (w, e))
    end
    best
end
