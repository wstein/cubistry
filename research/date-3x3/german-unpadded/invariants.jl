# Parity and twist invariants of the 36 generators and of 3000 random words (seeded). Usage: julia invariants.jl > results/invariants.txt
include(joinpath(@__DIR__, "load.jl"))
using Random
parity(p) = (n = 0; for i in eachindex(p), j in i+1:length(p); p[i] > p[j] && (n += 1); end; n % 2)
const CUB = [Cube.slots[i].p for i in 1:48]
function cp(st)
    out = Int[]
    for k in (3, 2)
        set = sort(unique([p for p in CUB if count(!iszero, p) == k])); ix = Dict(p => i for (i, p) in enumerate(set)); perm = zeros(Int, length(set))
        for s in 1:48; CUB[s] in keys(ix) || continue; perm[ix[CUB[s]]] = ix[CUB[st[s]]]; end
        push!(out, parity(perm))
    end
    out
end
const AX = Cube.slots[49:72]
function twist(slot)
    s = Cube.slots[slot]; n = s.n; u0 = Cube.center_ref_up(n)
    a = findfirst(!iszero, n); sg = n[a] > 0 ? -1 : 1
    for k in 0:3; Cube.rot(u0, a, sg * k) == s.u && return k; end
    error("twist")
end
function cstate(st)
    pos = [Cube.slots[st[48+i]].n for i in 1:6]; order = Cube.AXES
    perm = [findfirst(==(p), order) for p in pos]
    perm, sum(twist(st[48+i]) for i in 1:6)
end
toks = [string(c, m) for c in "RLUDFBMESxyz" for m in ["", "'", "2"]]
for t in toks
    st = Search.st_of_word([t]); c = cp(st); (pp, S) = cstate(st)
    println(t, " corner=", c[1], " edge=", c[2], " centerperm=", parity(pp), " twistsum=", S)
end
rng = MersenneTwister(1); bad = Dict{String,Int}()
for trial in 1:3000
    w = [toks[rand(rng, 1:length(toks))] for _ in 1:rand(rng, 1:40)]
    st = Search.st_of_word(w); c = cp(st); (pp, S) = cstate(st)
    key = "c+e+z=$((c[1]+c[2]+parity(pp))%2) S%2=$(S%2) c=$(c[1]) e=$(c[2]) z=$(parity(pp))"
    bad[key] = get(bad, key, 0) + 1
end
foreach(println, sort(collect(bad)))
