# Search engine: word index keyed by tracked front-cell tuple, layered DP over full states.
include(joinpath(@__DIR__, "model.jl")); using .M
const KMAX = 5
struct Words
    perms::Vector{Vector{UInt8}}   # 0-based facelet permutation (apply: f -> perm[f+1])
    len::Vector{Int8}
    word::Vector{String}
    byB::Dict{UInt32,Vector{Int32}}
    byA::Dict{UInt32,Vector{Int32}}
end
keyB(a,b,c,d) = UInt32(a) | UInt32(b) << 5 | UInt32(c) << 10 | UInt32(d) << 15
keyA(c,d) = UInt32(c) | UInt32(d) << 5
function buildwords(K=KMAX)
    idp = UInt8.(0:23)
    seen = Dict{Vector{UInt8},Int}(idp => 1)
    perms = [idp]; lens = Int8[0]; words = [""]
    fr = [1]
    for d in 1:K
        nx = Int[]
        for wi in fr, (mi, m) in enumerate(M.MOVEPERMS)
            w = perms[wi]; t = UInt8[m[w[f]+1] for f in 1:24]
            if !haskey(seen, t)
                push!(perms, t); push!(lens, d); push!(words, isempty(words[wi]) ? M.MOVENAMES[mi] : words[wi]*" "*M.MOVENAMES[mi])
                seen[t] = length(perms); push!(nx, length(perms))
            end
        end
        fr = nx
    end
    byB = Dict{UInt32,Vector{Int32}}(); byA = Dict{UInt32,Vector{Int32}}()
    for (i, w) in enumerate(perms)
        inv = zeros(Int, 24); for f in 0:23; inv[w[f+1]+1] = f; end
        q = (inv[M.F_UL+1], inv[M.F_UR+1], inv[M.F_LL+1], inv[M.F_LR+1])
        push!(get!(byB, keyB(q...), Int32[]), i)
        push!(get!(byA, keyA(q[3], q[4]), Int32[]), i)
    end
    Words(perms, lens, words, byB, byA)
end
applyw(st::UInt64, w::Vector{UInt8}) = (x = UInt64(0); for c in 1:8; x |= UInt64(w[M.getref(st, c)+1]) << (5(c-1)); end; x)
# labels: 0 blank, 1..10 tens digit (l-1), 11..20 units digit (l-11)
const BLANK = 0
tens(d) = 1 + d; units(d) = 11 + d
@inline cost(len) = len <= 3 ? Int(len) : (len == 4 ? 1000 : 1_000_000)
# candidate facelets for the four cells for display v given state locs
function cands(lab, loc, v, profile, mode=:lz)
    t, u = divrem(v, 10)
    tl = (mode == :nz && t == 0) ? BLANK : tens(t)
    ll = [loc[s+1] for s in 0:23 if lab[s+1] == tl]
    lr = [loc[s+1] for s in 0:23 if lab[s+1] == units(u)]
    bl = profile == :B ? [loc[s+1] for s in 0:23 if lab[s+1] == BLANK] : Int[]
    bl, ll, lr
end
corner(f) = f ÷ 3
# successors of st toward display v: Vector of (newstate, wordindex)
function succ!(out, W::Words, lab, st, v, profile, maxlen, mode=:lz)
    empty!(out)
    loc = M.locs(st)
    bl, ll, lr = cands(lab, loc, v, profile, mode)
    for a in ll, b in lr
        corner(a) == corner(b) && continue
        if profile == :A
            ws = get(W.byA, keyA(a, b), nothing); ws === nothing && continue
            for wi in ws; W.len[wi] <= maxlen && push!(out, (applyw(st, W.perms[wi]), wi)); end
        else
            for x in bl, y in bl
                (corner(x) == corner(y) || corner(x) == corner(a) || corner(x) == corner(b) || corner(y) == corner(a) || corner(y) == corner(b)) && continue
                ws = get(W.byB, keyB(x, y, a, b), nothing); ws === nothing && continue
                for wi in ws; W.len[wi] <= maxlen && push!(out, (applyw(st, W.perms[wi]), wi)); end
            end
        end
    end
    out
end
# one relaxed pass: layered min-cost DP through displays start+1 ... start+100 (mod 100)
function dppass(W, lab, startlayer::Dict{UInt64,Int}, profile; maxlen=KMAX, beam=typemax(Int), mode=:lz)
    layer = startlayer; out = Tuple{UInt64,Int32}[]
    for i in 1:100
        v = i % 100; nxt = Dict{UInt64,Int}()
        for (st, c) in layer
            succ!(out, W, lab, st, v, profile, maxlen, mode)
            for (ns, wi) in out
                nc = c + cost(W.len[wi])
                if nc < get(nxt, ns, typemax(Int)); nxt[ns] = nc; end
            end
        end
        isempty(nxt) && return (i, nxt)
        if length(nxt) > beam
            ks = sort!(collect(nxt), by = last)[1:beam]; nxt = Dict(ks)
        end
        layer = nxt
    end
    (101, layer)
end
function evaluate(W, lab, profile; beam=3000, passes=2, maxlen=KMAX, seed=M.IDSTATE, mode=:lz)
    layer = Dict(seed => 0)
    best = 0
    for p in 1:passes
        reached, layer = dppass(W, lab, layer, profile; maxlen, beam, mode)
        reached <= 100 && return (Inf, reached + 100(p-1))
        best = minimum(values(layer))
        p < passes && (layer = Dict(k => 0 for (k, _) in layer))
    end
    (best, 201)
end
