# usage: julia ablation.jl <printId> <steps> <out.tsv>   Effect of the number of databases on nodes and time (app pose).
include(joinpath(@__DIR__, "FrontGoal.jl"))
using .FrontGoal
const FG = FrontGoal
id, steps, out = ARGS[1], parse(Int, ARGS[2]), ARGS[3]
pr = load_print(joinpath(@__DIR__, "fixtures", "print-$id.tsv"))
init = split(readline(joinpath(@__DIR__, "data", "initial-$id.tsv")), '\t')
rows = [split(l, '\t') for l in eachline(joinpath(@__DIR__, "data", "app-chain-$id.tsv")) if !startswith(l, "#") && !isempty(l)]
subsets = Dict("all9" => 1:9, "cc+ee+mix(5)" => [1, 2, 3, 6, 8], "corners+edges(4)" => [1, 3, 4, 6], "one corner+one edge(2)" => [1, 3], "corner only(1)" => [1])
pose = apply_word(pr.solved, String(init[3]))
open(out, "w") do io
    println(io, "print\tsubset\tdatabases\tstep\tstatus\thtm\tnodes\tsolve_ms\tbytes")
    for r in rows[1:steps]
        cells = parse_cells(r[8])
        h = build_heuristic(pr, cells)
        for (name, idx) in sort(collect(subsets); by = first)
            hs = FG.Heuristic(h.print, h.cells, h.cubies, h.acc, h.pdbs[idx], 0.0, length(idx) * 4 * FG.TSIZE)
            res = solve_front(hs, pose; maxdepth = 12, time_limit_s = 30.0)
            println(io, join((id, name, length(idx), r[1], res.status, res.htm, res.nodes, round(res.ms; digits = 1), hs.bytes), "\t")); flush(io)
        end
        global pose = apply_word(pose, String(r[7]))
    end
end
