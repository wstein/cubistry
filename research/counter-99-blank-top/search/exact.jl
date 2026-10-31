# Search-side per-print computation over ALL reachable full states (no beam):
# enumerate every legal full state showing value 0, then propagate with words of length
# <= K through the 100 displays. An empty layer means the computation finds no route for
# THIS print (not even an open one) with every edge <= K HTM. No native checker confirms it.
include(joinpath(@__DIR__, "engine.jl"))
cwaxes(P) = P[1]*P[2]*P[3] > 0 ? (1, 2, 3) : (1, 3, 2)   # cyclic axis order at a corner
function twist(st)
    t = 0
    for c in 0:7
        r = M.getref(st, c+1); P = M.posvec(r ÷ 3)
        # local index (home axis order) of the sticker now on the y-face
        home = cwaxes(M.posvec(c)); cur = cwaxes(P)
        k = findfirst(k -> M.CUBIEFACELETS[c+1, r+1, k] % 3 == 1, 1:3)   # sticker k-1 lies on a y-face
        t += mod(findfirst(==(k), home) - findfirst(==(2), cur), 3)
    end
    mod(t, 3)
end
function placements(c, P)   # all ref facelets putting cubie c at position P
    [r for r in (3*M.posidx(P)):(3*M.posidx(P)+2) if M.CUBIEFACELETS[c+1, r+1, 1] >= 0]
end
perms4(v) = length(v) <= 1 ? [copy(v)] : [vcat([v[i]], p) for i in eachindex(v) for p in perms4(deleteat!(copy(v), i))]
function allstates(lab, v, mode)
    loc = M.locs(M.IDSTATE)   # home: sticker s at facelet s
    bl, ll, lr = cands(lab, loc, v, :B, mode)
    cellf = (M.F_UL, M.F_UR, M.F_LL, M.F_LR)
    out = Set{UInt64}()
    for x in bl, y in bl, a in ll, b in lr
        ss = (x, y, a, b); cs = map(s -> s ÷ 3, ss)
        length(unique(cs)) == 4 || continue
        ref = fill(-1, 8)
        for k in 1:4
            c = cs[k]; P = M.facelet(cellf[k])[1]
            ref[c+1] = only(r for r in placements(c, P) if M.CUBIEFACELETS[c+1, r+1, ss[k] % 3 + 1] == cellf[k])
        end
        rest = [c for c in 0:7 if !(c in cs)]
        backs = [p for p in 0:7 if !(p in map(f -> f ÷ 3, cellf))]
        for perm in perms4(backs)
            opts = [placements(rest[i], M.posvec(perm[i])) for i in 1:4]
            for r1 in opts[1], r2 in opts[2], r3 in opts[3], r4 in opts[4]
                ref[rest[1]+1] = r1; ref[rest[2]+1] = r2; ref[rest[3]+1] = r3; ref[rest[4]+1] = r4
                st = M.pack(ref); twist(st) == 0 && push!(out, st)
            end
        end
    end
    out
end
function propagate(W, lab, S0, mode, K)
    layer = S0; sizes = Int[]; out = Tuple{UInt64,Int32}[]
    for i in 1:100
        nxt = Set{UInt64}()
        for st in layer
            succ!(out, W, lab, st, i % 100, :B, K, mode)
            for (ns, _) in out; push!(nxt, ns); end
        end
        push!(sizes, length(nxt)); isempty(nxt) && return (i, sizes)
        layer = nxt
    end
    (101, sizes)
end
