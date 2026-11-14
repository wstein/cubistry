# Julia tests for FrontGoal.jl. Run: julia test/runtests.jl   (standard library only, no Project.toml needed)
using Test
include(joinpath(@__DIR__, "..", "FrontGoal.jl"))
using .FrontGoal
const FG = FrontGoal
const FIX = joinpath(@__DIR__, "..", "fixtures")

prints = Dict(id => load_print(joinpath(FIX, "print-$id.tsv")) for id in ("de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded"))
function targets(id)
    out = Tuple{Vector{String},String}[]
    for l in eachline(joinpath(FIX, "targets-$id.tsv"))
        startswith(l, "#") && continue
        f = split(l, '\t')
        push!(out, (parse_cells(f[4]), String(f[5])))
    end
    return out
end
const OUTER = FG.MOVES

# Reference: brute-force iterative deepening with no heuristic, on the same engine and predicate.
function bf_opt(pr, cells, pose; maxd, rotations)
    words = rotations ? FG.ROTWORDS : [""]
    function dfs(st, d, last)
        FG.matches_pose(pr, cells, st) && return true
        d == 0 && return false
        for t in OUTER
            t[1] == last && continue
            dfs(apply_word(st, t), d - 1, t[1]) && return true
        end
        return false
    end
    for D in 0:maxd, w in words
        dfs(apply_word(pose, w), D, ' ') && return D
    end
    return maxd + 1
end

function scramble_cases()
    out = Tuple{String,Vector{String},Pose,Int}[]
    for (id, ks) in (("de-a", [1, 4, 9]), ("de-a-unpadded", [2, 6]), ("en-3-zero", [3, 7]), ("en-3-unpadded", [5]))
        pr = prints[id]; T = targets(id)
        for k in ks
            cells, word = T[k]
            base = apply_word(pr.solved, word)
            for scr in ("F", "B U", "U R'", "F R U", "D' L2")
                push!(out, (id, cells, apply_word(base, scr), length(split(scr))))
            end
        end
    end
    return out
end

# one outer test set so that every inner set runs even when an earlier one fails (mutation runs)
@testset "front goal" begin
@testset "predicate agrees with the app's matches()" begin
    n = 0; pos = 0; neg = 0; acc_pos = 0
    for l in eachline(joinpath(FIX, "predicate-cases.tsv"))
        startswith(l, "#") && continue
        id, m, cells, word = split(l, '\t')
        pr = prints[id]; cs = parse_cells(cells)
        pose = apply_word(pr.solved, word)
        want = m == "1"
        @test FG.matches_pose(pr, cs, pose) == want
        # the tables used by the databases must describe the same set
        acc = FG.accepts(pr, cs)
        by_loc = Dict((s.p, s.n) => k for (k, s) in enumerate(pose))
        from_tables = all(j == 5 ? true : acc[j, by_loc[FG.LOCS[FG.SLOT_LOC[j]]]] for j in 1:9)
        c = pose[by_loc[FG.LOCS[FG.SLOT_LOC[5]]]]
        from_tables &= pr.image[by_loc[FG.LOCS[FG.SLOT_LOC[5]]]] == cs[5] && FG.center_ok(cs, findfirst(==(c.up), FG.UP4))
        @test from_tables == want
        n += 1; want ? (pos += 1) : (neg += 1)
    end
    @test n >= 400 && pos >= 100 && neg >= 100
end

@testset "known optima" begin
    for id in ("de-a", "en-3-zero")
        pr = prints[id]; cells, word = targets(id)[2]
        base = apply_word(pr.solved, word)
        h = build_heuristic(pr, cells)
        r = solve_front(h, base)
        @test r.status == :solved && r.htm == 0
        # a back turn leaves the front untouched: front-goal optimum 0 although the full-state optimum is 1
        r = solve_front(h, apply_word(base, "B"))
        @test r.status == :solved && r.htm == 0
        # one front turn: optimum 1 (inverse turn), also for the half turn
        r = solve_front(h, apply_word(base, "F"); rotations = :none)
        @test r.status == :solved && r.htm == 1 && r.word == "F'"
        r = solve_front(h, apply_word(base, "F2"); rotations = :none)
        @test r.status == :solved && r.htm == 1 && r.word == "F2"
    end
end

@testset "optimum equals brute force" begin
    cs = scramble_cases()
    checked = 0
    for (id, cells, pose, k) in cs
        pr = prints[id]
        h = build_heuristic(pr, cells)
        r = solve_front(h, pose; rotations = :none, maxdepth = 6)
        ref = bf_opt(pr, cells, pose; maxd = min(k, 3), rotations = false)
        # BF only reaches depth 3; where it found a goal it is the optimum and must agree
        if ref <= 3
            @test r.status == :solved && r.htm == ref
            checked += 1
        else
            @test r.status == :solved && r.htm > 3 && r.htm <= k
        end
        @test FG.matches_pose(pr, cells, apply_word(pose, r.word))
    end
    @test checked >= 10
end

@testset "optimum with free rotations equals brute force" begin
    pr = prints["de-a"]; cells, word = targets("de-a")[3]
    base = apply_word(pr.solved, word)
    h = build_heuristic(pr, cells)
    for scr in ("R", "U F'", "F R")
        pose = apply_word(base, scr)
        r = solve_front(h, pose; maxdepth = 4)
        @test r.status == :solved
        @test r.htm == bf_opt(pr, cells, pose; maxd = 2, rotations = true)
        @test FG.matches_pose(pr, cells, apply_word(pose, r.word))
    end
end

@testset "center twist is part of the goal" begin
    # the 12 move witness twists only the front center by a half turn; the 8 outer cubies are restored
    pr = prints["de-a"]; cells, word = targets("de-a")[2]
    @test cells[5] != ""
    pose = apply_word(apply_word(pr.solved, word), "F U D F2 U' D' F U D F2 U' D'")
    @test !FG.matches_pose(pr, cells, pose)
    h = build_heuristic(pr, cells)
    r = solve_front(h, pose; rotations = :none, maxdepth = 12)
    @test r.status == :solved && r.htm <= 12
    @test FG.matches_pose(pr, cells, apply_word(pose, r.word))
end

@testset "accepts() equals engine reality for every reachable slot and sticker" begin
    # Independent of the rigid-motion tables: enumerate poses within three outer turns of the solved print with the
    # app-mirroring engine and read the real up vector of whichever sticker lands on each front slot.
    for id in ("de-a", "en-3-zero")
        pr = prints[id]
        seen = Dict{Tuple{Int,Int},FG.V3}()
        function walk(st, d, last)
            by_loc = Dict((s.p, s.n) => k for (k, s) in enumerate(st))
            for j in FG.NONCENTER_SLOTS
                k = by_loc[FG.LOCS[FG.SLOT_LOC[j]]]
                haskey(seen, (j, k)) || (seen[(j, k)] = st[k].up)
            end
            d == 0 && return
            for t in OUTER
                t[1] == last && continue
                walk(apply_word(st, t), d - 1, t[1])
            end
        end
        walk(pr.solved, 3, ' ')
        @test length(seen) > 150
        nonblank = 0
        for ((j, k), up) in seen
            if pr.image[k] != ""
                @test FG.accepts(pr, fill(pr.image[k], 9))[j, k] == (up == (0, 1, 0))
                nonblank += 1
            else
                @test FG.accepts(pr, fill("", 9))[j, k]
            end
        end
        @test nonblank > 50
    end
end

@testset "weaker heuristic gives the same optimum" begin
    nodes_full = 0; nodes_weak = 0
    for (id, ks) in (("de-a", [2, 3]), ("en-3-zero", [4]), ("de-a-unpadded", [5]))
        pr = prints[id]
        for k in ks
            cells, word = targets(id)[k]
            pose = apply_word(apply_word(pr.solved, word), "R U F2 D L' B")
            h = build_heuristic(pr, cells)
            weak = FG.Heuristic(h.print, h.cells, h.cubies, h.acc, h.pdbs[[1, 3]], 0.0, 0)
            a = solve_front(h, pose; maxdepth = 7)
            b = solve_front(weak, pose; maxdepth = 7)
            @test a.status == :solved && b.status == :solved && a.htm == b.htm
            nodes_full += a.nodes; nodes_weak += b.nodes
        end
    end
    # the maximum over nine tables must prune strictly more than the two-table subset (and than table 1 alone)
    @test nodes_weak > nodes_full
end

@testset "tables" begin
    pr = prints["en-3-zero"]; cells, _ = targets("en-3-zero")[2]
    h = build_heuristic(pr, cells)
    @test length(h.pdbs) == 9
    @test all(p -> count(==(0), p.dist) > 0, h.pdbs)
    @test all(p -> maximum(filter(!=(0xff), p.dist)) >= 3, h.pdbs)
    @test h.bytes == 9 * 4 * FG.TSIZE
    @test length(FG.ROTWORDS) == 24 && FG.ROTWORDS[1] == "" && all(w -> length(split(w)) <= 2, FG.ROTWORDS[2:end])
end

# ---- independent brute force at depth 4 to 7 with opposite-face pairs (fixtures/bf-cases.tsv, export-bf-cases.mjs)
function bf_cases()
    out = NamedTuple[]
    for l in eachline(joinpath(FIX, "bf-cases.tsv"))
        startswith(l, "#") && continue
        f = split(l, '\t'; keepempty = true)
        push!(out, (id = String(f[1]), cells = parse_cells(f[2]), word = String(f[3]), k = parse(Int, f[4]),
            opt = parse(Int, f[5]), bfword = String(f[6])))
    end
    return out
end
BF = bf_cases()
HCACHE = Dict{Tuple{String,String},Any}()
heur(id, cells) = get!(() -> build_heuristic(prints[id], cells), HCACHE, (id, join(cells, "|")))
opposite_pair(w) = any(p -> p[1] != p[2] && (p[1], p[2]) in (('R', 'L'), ('L', 'R'), ('U', 'D'), ('D', 'U'), ('F', 'B'), ('B', 'F')),
    zip(first.(split(w)), first.(split(w))[2:end]))

@testset "optimum equals independent brute force, depth 4 to 7, opposite faces" begin
    deep = 0; opp = 0
    for c in BF
        c.opt == 0 && continue
        pose = apply_word(prints[c.id].solved, c.word)
        r = solve_front(heur(c.id, c.cells), pose; rotations = :none, maxdepth = 9)
        @test r.status == :solved && r.htm == c.opt
        @test FG.matches_pose(prints[c.id], c.cells, apply_word(pose, r.word))
        c.opt >= 4 && (deep += 1)
        opposite_pair(c.bfword) && (opp += 1)
    end
    @test deep >= 10 && opp >= 8
end

@testset "depth bound is inclusive" begin
    n = 0
    for c in BF
        c.opt >= 4 || continue
        pose = apply_word(prints[c.id].solved, c.word)
        h = heur(c.id, c.cells)
        @test solve_front(h, pose; rotations = :none, maxdepth = c.opt).htm == c.opt
        @test solve_front(h, pose; rotations = :none, maxdepth = c.opt - 1).status == :none_within
        n += 1
        n >= 6 && break
    end
    @test n >= 6
end

@testset "fewest rotation tokens among equal-length routes" begin
    mixed = 0
    for c in BF[1:2:min(end, 30)]
        c.opt == 0 && continue
        pose = apply_word(prints[c.id].solved, c.word)
        h = heur(c.id, c.cells)
        r = solve_front(h, pose; maxdepth = 9)
        @test r.status == :solved
        # independent per-rotation optima: candidate rotation w, then rotation-free search
        best = Dict{Int,Int}()   # tokens => minimal htm
        for w in FG.ROTWORDS
            q = solve_front(h, apply_word(pose, w); rotations = :none, maxdepth = r.htm)
            q.status == :solved || continue
            t = isempty(w) ? 0 : length(split(w))
            best[t] = min(get(best, t, 99), q.htm)
        end
        @test minimum(values(best)) == r.htm
        @test r.rotations == minimum(t for (t, v) in best if v == r.htm)
        length([t for (t, v) in best if v == r.htm]) >= 2 && (mixed += 1)
    end
    @test mixed >= 1
end

end
