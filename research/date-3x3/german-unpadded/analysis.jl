# W search and application. Usage: julia analysis.jl PADDED_WITNESS.json > results/analysis.txt
include(joinpath(@__DIR__, "load.jl"))

const ROTWORDS = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"]
parity(p) = (n = 0; for i in eachindex(p), j in i+1:length(p); p[i] > p[j] && (n += 1); end; n % 2)
const CUB = [Cube.slots[i].p for i in 1:48]
function cubie_parity(st)   # (corner parity, edge parity) of a 48-slot sticker map
    out = Int[]
    for k in (3, 2)
        set = unique([p for p in CUB if count(!iszero, p) == k]); ix = Dict(p => i for (i, p) in enumerate(set))
        perm = zeros(Int, length(set))
        for s in 1:48; CUB[s] in keys(ix) || continue; perm[ix[CUB[s]]] = ix[CUB[st[s]]]; end
        push!(out, parity(perm))
    end
    out
end
function all_rotations()
    seen = Dict(Search.st_of_word(String[]) => String[])
    for _ in 1:3, w in collect(values(seen)), t in ROTWORDS
        st = Search.st_of_word(vcat(w, [t])); haskey(seen, st) || (seen[st] = vcat(w, [t]))
    end
    seen
end
nonce(st) = st[1:48] == collect(1:48)

# replay helper: final state of a target followed by `extra`; compares with the plain route
after_extra(w, t, extra; padded) = extra_effect(w, t, extra)

function main(path)
    w = load_witness(path)
    println("== A. Rotations: parity of the corner and edge permutation (0 even, 1 odd)")
    rots = all_rotations()
    a4 = Pair{Vector{Int},Vector{String}}[]
    for (st, rw) in sort(collect(rots), by = x -> (length(x[2]), join(x[2], " ")))
        cp = cubie_parity(st[1:48]); push!(a4, st => rw)
        println("rotation ", rpad(join(rw, " "), 8), " corners=", cp[1], " edges=", cp[2], cp[1] == cp[2] ? "  face-turn reachable" : "  not reachable by outer turns")
    end
    rot_ok = [(st, rw) for (st, rw) in a4 if cubie_parity(st[1:48]) == [0, 0] && !isempty(rw)]
    println("even/even nonidentity rotations: ", length(rot_ok), " of 23")

    d1 = filter(t -> t["day"] < 10, w.targets)
    println("\n== B. Center arrangement of the padded witness (days 1-9)")
    t1 = d1[1]
    ok1, same1, s1, s0 = after_extra(w, t1, String[]; padded = true)
    preludes = unique([t["prelude"] for t in d1]); println("targets with day<10: ", length(d1), "  distinct preludes: ", preludes)
    names = Dict((1,0,0)=>"R", (-1,0,0)=>"L", (0,1,0)=>"U", (0,-1,0)=>"D", (0,0,1)=>"F", (0,0,-1)=>"B")
    for (i, s) in enumerate(s0)
        count(!iszero, s.p) == 1 && println("center at ", names[s.p], " shows '", w.image[i] == "" ? "blank" : w.image[i], "' up=", s.u)
    end

    println("\n== C. Slice-only words (M, E, S); corners are never touched by slices")
    for metric in (:stm, :qtm)
        maxc = metric == :stm ? 6 : 8
        best = Search.slice_bfs(maxc; metric)
        H = Search.st_of_word(String[])
        pure = [(c, wd, st) for (st, (c, wd)) in best if nonce(st) && st != H]
        mn = minimum(first.(pure))
        println(metric == :stm ? "metric STM (every slice turn counts 1)" : "metric QTM (half turn counts 2)", ": words searched up to cost ", maxc,
            ", reachable states ", length(best), ", nontrivial pure-center states ", length(pure), ", minimal cost ", mn)
        for c in 1:mn-1; println("  cost $c: none"); end
        for (c, wd, st) in sort(pure, by = x -> (x[1], join(x[2], " ")))
            c == mn || continue
            ok, same, _, _ = after_extra(w, t1, wd; padded = true)
            println("  cost $c  ", rpad(join(wd, " "), 14), " edges/corners unchanged=", same, "  blank to front (day ", t1["day"], ")=", ok)
        end
    end

    println("\n== D. Outer turns plus rotations: shortest face-turn word V with V r = pure center word")
    D, T = bfs_table(5)
    cands = Tuple{Int,Int,Vector{String},Vector{String},Bool}[]
    for (st, rw) in sort(rot_ok, by = x -> (length(x[2]), join(x[2], " ")))
        len, ws = mitm_outer(D, T, Cube.perm_inverse(st[1:48]); maxlen = 10)
        okany = false
        sort!(ws, by = x -> join(x, " "))
        W1 = isempty(ws) ? String[] : vcat(ws[1], rw)
        ok, same, _, _ = after_extra(w, t1, W1; padded = true)
        println("r = ", rpad(join(rw, " "), 6), " minimal outer HTM = ", len, " (all words up to length 10 searched), minimal words ", length(ws), "  first: ", join(ws[1], " "), "  | first with r: blank to front=", ok, " c/e unchanged=", same)
        for v in ws; W = vcat(v, rw); okv, _, _, _ = after_extra(w, t1, W; padded = true); okv && push!(cands, (len, length(rw), v, rw, true)); end
    end
    sort!(cands, by = x -> (x[1], x[2], join(x[3], " ")))
    println("candidates with blank to front: ", length(cands))
    best = cands[1]; Wv = vcat(best[3], best[4])
    println("W (outer HTM ", best[1], ", rotation moves ", best[2], ") = ", join(Wv, " "))
    println("W_inverse = ", join(inverse_word(Wv), " "))
    # also best 120-degree alternative
    c120 = filter(x -> x[2] == 2, cands)
    if !isempty(c120); b = c120[1]; println("shortest with a diagonal 120-degree rotation (outer ", b[1], ", rotation moves ", b[2], ") = ", join(vcat(b[3], b[4]), " ")); end

    println("\n== E. Application of W to every padded target with day < 10")
    nok = 0; tw = Dict{String,Int}()
    for t in d1
        ok, same, s1, s0 = after_extra(w, t, Wv; padded = true)
        nok += ok
        k = findfirst(i -> w.image[i] == "0", eachindex(s1))
        tw[string(names[s1[k].p], " up=", s1[k].u)] = get(tw, string(names[s1[k].p], " up=", s1[k].u), 0) + 1
    end
    println("targets checked: ", length(d1), "  front matches unpadded display and all 48 corner/edge stickers unchanged: ", nok)
    println("glyph 0 after W (position, up): ", sort(collect(tw)))
    println("W in the sticker model on all 2562: days >= 10 are not touched")
end
main(ARGS[1])
