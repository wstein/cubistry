include(joinpath(@__DIR__, "engine.jl"))
# Exact closed-cycle routing for a fixed print: single-source layered DP over full states
# (no beam) from a start state g0 displaying value 0, through values 1..99 and back to g0 itself.
function closedcycle(W, lab, g0, profile, mode; maxlen=KMAX)
    layers = Vector{Dict{UInt64,Tuple{Int,UInt64,Int32}}}(undef, 100)
    cur = Dict(g0 => (0, UInt64(0), Int32(0))); out = Tuple{UInt64,Int32}[]
    for i in 1:100
        v = i % 100; nxt = Dict{UInt64,Tuple{Int,UInt64,Int32}}()
        for (st, (c, _, _)) in cur
            succ!(out, W, lab, st, v, profile, maxlen, mode)
            for (ns, wi) in out
                if i == 100 && ns != g0; continue; end
                nc = c + cost(W.len[wi])
                if nc < get(nxt, ns, (typemax(Int),))[1]; nxt[ns] = (nc, st, wi); end
            end
        end
        isempty(nxt) && return nothing
        layers[i] = nxt; cur = nxt
    end
    # trace back
    words = Int32[]; st = g0
    for i in 100:-1:1
        c, p, wi = layers[i][st]; pushfirst!(words, wi); st = p
    end
    @assert st == g0
    (layers[100][g0][1], words)
end
# candidate starts: states displaying 0 surviving a relaxed pass, best first
function starts(W, lab, seed, profile, mode; beam=3000)
    layer = Dict(seed => 0)
    for p in 1:2
        reached, layer = dppass(W, lab, layer, profile; beam, mode)
        reached <= 100 && return UInt64[]
        p == 1 && (layer = Dict(k => 0 for (k, _) in layer))
    end
    first.(sort!(collect(layer), by = last))
end
function bestcycle(W, lab, seed, profile, mode; ntry=30, beam=3000)
    best = nothing
    for g0 in Iterators.take(starts(W, lab, seed, profile, mode; beam), ntry)
        r = closedcycle(W, lab, g0, profile, mode)
        r === nothing && continue
        if best === nothing || r[1] < best[1]; best = (r[1], r[2], g0); end
    end
    best
end
histo(W, words) = (h = Dict{Int,Int}(); for wi in words; h[W.len[wi]] = get(h, W.len[wi], 0) + 1; end; sort(collect(h)))
