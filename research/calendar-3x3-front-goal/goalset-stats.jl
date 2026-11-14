# usage: julia goalset-stats.jl
# Size of the acceptance goal set per print over the 27 sample targets of fixtures/targets-*.tsv (every 97th of 2562).
include(joinpath(@__DIR__, "FrontGoal.jl"))
using .FrontGoal
const FG = FrontGoal

function front_assignments(pr, cells)
    cubies = FG.cubies_of(pr); acc = FG.accepts(pr, cells)
    owner = Dict(k => ci for (ci, c) in enumerate(cubies) for k in c.stickers)
    opts = [[owner[k] for k in findall(acc[j, :]) if haskey(owner, k)] for j in FG.NONCENTER_SLOTS]
    count = 0
    function rec(i, used)
        i > length(opts) && return (count += 1; nothing)
        for c in opts[i]
            c in used && continue
            rec(i + 1, (used..., c))
        end
    end
    rec(1, ())
    # the canonical stickered orientation per cubie in a slot is unique (corner and edge cubies have 24 placements,
    # one per (slot, sticker)); so assignments of (cubie, sticker) pairs are counted by sticker choice below
    return count, length.(opts)
end

function stat(v)
    s = sort(v); n = length(s)
    q(p) = s[min(n, floor(Int, p * (n - 1) + 0.5) + 1)]
    return (min = s[1], median = q(0.5), p95 = q(0.95), max = s[end])
end

function centers(pr, cells)
    ks = [k for k in 1:54 if FG.nz(pr.solved[k].p) == 1 && pr.image[k] == cells[5]]
    return length(ks)
end

# remaining 4 corners and 8 edges move freely: 4! * 8! / 2 (parity) * 3^3 * 2^7 completions per front assignment
completions = factorial(4) * factorial(8) ÷ 2 * 27 * 128
println("print\ttargets\tassignments(min/median/p95/max)\tcenters(min/max)\tfull_states_median\tshare_of_cube_median")
total = BigInt(43252003274489856000)   # |G| of the 3x3x3 corner and edge group
for id in ("de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded")
    pr = load_print(joinpath(@__DIR__, "fixtures", "print-$id.tsv"))
    A = Int[]; C = Int[]; maxopts = Int[]
    for l in eachline(joinpath(@__DIR__, "fixtures", "targets-$id.tsv"))
        startswith(l, "#") && continue
        cells = parse_cells(split(l, '\t')[4])
        a, o = front_assignments(pr, cells)
        push!(A, a); push!(C, centers(pr, cells)); push!(maxopts, maximum(o))
    end
    s = stat(A)
    full = BigInt(s.median) * completions
    println(id, "\t", length(A), "\t", s.min, "/", s.median, "/", s.p95, "/", s.max, "\t", minimum(C), "/", maximum(C),
        "\t", full, "\t", Float64(full / total))
end
