# Julia tests with mutations. Run: julia --startup-file=no test/runtests.jl   (about 1-2 minutes)
using Test
include(joinpath(@__DIR__, "..", "load.jl"))
const DT = normpath(joinpath(@__DIR__, "..", ".."))
const PADDED = joinpath(DT, "witnesses", "de-2.json")
const UNPADDED = joinpath(DT, "german-unpadded", "witnesses", "de-2-unpadded.json")
const W = ["B2", "R", "L'", "D2", "U2", "R", "L'", "B2", "x2"]
const WDIAG = ["B", "U'", "D", "L'", "R", "F'", "B", "U'", "z", "y"]

@testset "engine" begin
    st(w) = Search.st_of_word(String.(split(w)))
    @test st("R U R' U'") != st("")
    @test st(join(fill("R U R' U'", 6), " ")) == st("")           # order 6
    @test st("R R R R") == st("")
    @test st("x") == st("R M' L'") && st("y") == st("U E' D'") && st("z") == st("F S B'")   # slice definitions
    @test_throws ErrorException parse_word("R3")
    @test length(date_patterns()) == 2562
end

@testset "invariants" begin
    parity(p) = (n = 0; for i in eachindex(p), j in i+1:length(p); p[i] > p[j] && (n += 1); end; n % 2)
    cub = [Cube.slots[i].p for i in 1:48]
    function cparity(st, k)
        set = sort(unique([p for p in cub if count(!iszero, p) == k])); ix = Dict(p => i for (i, p) in enumerate(set)); perm = zeros(Int, length(set))
        for s in 1:48; cub[s] in keys(ix) || continue; perm[ix[cub[s]]] = ix[cub[st[s]]]; end
        parity(perm)
    end
    zparity(st) = parity([findfirst(==(Cube.slots[st[48+i]].n), Cube.AXES) for i in 1:6])
    toks = [string(c, m) for c in "RLUDFBMESxyz" for m in ["", "'", "2"]]
    good = [cparity(Search.st_of_word([t]), 3) + cparity(Search.st_of_word([t]), 2) + zparity(Search.st_of_word([t])) for t in toks]
    @test all(iseven, good)                                     # sgn(corners) sgn(edges) sgn(centers) = +1 for all 36 generators
    # mutation: forget the centers; the relation must then fail at the slices and rotations
    bad = [cparity(Search.st_of_word([t]), 3) + cparity(Search.st_of_word([t]), 2) for t in toks]
    @test any(isodd, bad)
    @test all(isodd(bad[i]) for i in eachindex(toks) if toks[i][1] in "MES" && !endswith(toks[i], "2"))
end

@testset "slice words" begin
    for metric in (:stm, :qtm)
        best = Search.slice_bfs(3; metric)
        H = Search.st_of_word(String[])
        @test count(p -> p.first[1:48] == H[1:48] && p.first != H, best) == 0     # no pure-center word of cost <= 3
    end
    best4 = Search.slice_bfs(4; metric = :stm); H = Search.st_of_word(String[])
    @test count(p -> p.first[1:48] == H[1:48] && p.first != H, best4) > 0
    # mutation of the oracle: if only the corners were compared, single slice moves would count as restored
    best1 = Search.slice_bfs(1; metric = :stm)
    @test count(p -> p.first[1:48] != H[1:48], best1) == 9                            # M E S in three directions change edges
    @test count(p -> p.first[[i for i in 1:48 if count(!iszero, Cube.slots[i].p) == 3]] == H[[i for i in 1:48 if count(!iszero, Cube.slots[i].p) == 3]] && p.first != H, best1) == 9
end

@testset "outer-turn search" begin
    D, T = bfs_table(3)
    rz = Search.st_of_word(["y2"])[1:48]
    len, ws = mitm_outer(D, T, Cube.perm_inverse(rz); maxlen = 6)
    @test len == typemax(Int) || len > 6          # nothing within 6: the search cannot invent shorter words
    for v in ws; @test length(v) <= 6; end
    D5, T5 = bfs_table(4)
    len, ws = mitm_outer(D5, T5, Cube.perm_inverse(rz); maxlen = 8)
    @test len == 8 && !isempty(ws)
    for v in ws
        @test Search.st_of_word(vcat(v, ["y2"]))[1:48] == collect(1:48)
    end
    # mutation: wrong rotation direction target (y instead of y2 is odd, so unreachable)
    ry = Search.st_of_word(["y"])[1:48]
    len, ws = mitm_outer(D5, T5, Cube.perm_inverse(ry); maxlen = 8)
    @test isempty(ws)
end

@testset "witness replay" begin
    wp = load_witness(PADDED)
    d1 = [t for t in wp.targets if t["day"] < 10][1]; d2 = [t for t in wp.targets if t["day"] >= 10][1]
    @test check_target(wp, d1; padded = true)[1]
    @test check_target(wp, d2; padded = true)[1] && check_target(wp, d2; padded = false)[1]
    ok, why, _ = check_target(wp, d1; padded = false)             # mutation: wrong mode, the 0 stays on the front center
    @test !ok && occursin("cell 5", why)
    m = copy(d1); m["centerCorrection"] = ""                          # mutation: drop the center correction
    ok, why, _ = check_target(wp, m; padded = true); @test !ok && occursin("upright", why)
    m = copy(d1); m["prelude"] = "y y"                                # mutation: wrong whole-cube prelude
    @test !check_target(wp, m; padded = true)[1]
    m = copy(d1); m["word"] = join(split(m["word"])[1:end-1], " ")    # mutation: last turn missing
    @test !check_target(wp, m; padded = true)[1]
    m = copy(d1); m["day"] = d1["day"] + 1                            # mutation: wrong date
    @test !check_target(wp, m; padded = true)[1]
end

@testset "W" begin
    wp = load_witness(PADDED)
    d1 = [t for t in wp.targets if t["day"] < 10]
    @test all(extra_effect(wp, t, W)[1] for t in d1)
    @test all(extra_effect(wp, t, WDIAG)[1] for t in d1)
    # W followed by its inverse restores the route state
    t = d1[1]; _, _, s1, s0 = extra_effect(wp, t, vcat(W, inverse_word(W))); @test s1 == s0
    # mutation: the pure-center word for z2 (corners and edges restored) keeps F and B apart: the 0 stays or no blank reaches the front
    ok, same, _, _ = extra_effect(wp, t, ["B", "R2", "L2", "B", "F'", "U2", "D2", "F'", "z2"]); @test !ok && same
    # mutation: x2 replaced without changing the turns: corners and edges change
    ok, same, _, _ = extra_effect(wp, t, vcat(W[1:end-1], ["z2"])); @test !ok && !same
    # mutation: wrong direction of the 120 degree rotation: corners and edges change
    ok, same, _, _ = extra_effect(wp, t, vcat(WDIAG[1:end-2], ["z'", "y'"])); @test !ok && !same
    # mutation: one outer turn missing
    ok, same, _, _ = extra_effect(wp, t, vcat(W[2:end])); @test !ok && !same
    # mutation: cycle with the wrong center taken to the front (x2 vs z2 above); a word acting on the front center only
    ok, same, _, _ = extra_effect(wp, t, ["M", "E", "M'", "E'"]); @test ok && same     # slice word, owner's idea
    ok, same, _, _ = extra_effect(wp, t, ["M'", "E", "M", "E'"]); @test !ok && same    # opposite cycle: the 0 or the digit center is in front
end

@testset "direct unpadded witness" begin
    wu = load_witness(UNPADDED); wp = load_witness(PADDED)
    @test wu.stk == wp.stk && wu.image == wp.image                 # the same immutable print
    @test length(wu.targets) == 2562
    bad = count(t -> !check_target(wu, t; padded = false)[1], wu.targets)
    @test bad == 0
    # mutation: the unpadded witness must fail as a padded one on exactly the days < 10 with a changed route
    @test count(t -> !check_target(wu, t; padded = true)[1], wu.targets) == 756
end
