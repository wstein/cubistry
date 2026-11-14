# usage: julia run_steps.jl <printId> <app|own> <out.tsv> [steps] [timeLimitSeconds] [maxDepth]
# app: every step starts from the ACTUAL pose after the app's own route (poses replayed from data/app-chain-*.tsv).
# own: the pose of this solver's own previous route is carried instead.
using SHA
include(joinpath(@__DIR__, "FrontGoal.jl"))
using .FrontGoal

id, variant, out = ARGS[1], ARGS[2], ARGS[3]
steps = length(ARGS) >= 4 ? parse(Int, ARGS[4]) : 100
tlimit = length(ARGS) >= 5 ? parse(Float64, ARGS[5]) : 120.0
maxdepth = length(ARGS) >= 6 ? parse(Int, ARGS[6]) : 12
variant in ("app", "own") || error("variant must be app or own")
pr = load_print(joinpath(@__DIR__, "fixtures", "print-$id.tsv"))
init = split(readline(joinpath(@__DIR__, "data", "initial-$id.tsv")), '\t')
rows = [split(l, '\t') for l in eachline(joinpath(@__DIR__, "data", "app-chain-$id.tsv")) if !startswith(l, "#") && !isempty(l)]
pose = apply_word(pr.solved, String(init[3]))
cache = Dict{String,Heuristic}()
open(out, "w") do io
    println(io, "print\tvariant\tstep\tdate\tapp_htm\tapp_rot\tstatus\tfront_htm\tfront_rot\tnodes\tsolve_ms\tpdb_ms\troot_h\troute")
    for (si, r) in enumerate(rows[1:steps])
        step, date, app_htm, app_rot = r[1], r[2], r[3], r[4]
        approute, cells = String(r[7]), parse_cells(r[8])
        if variant == "app"
            string(parse(Int, bytes2hex(sha1(pose_field(pose)))[1:12]; base = 16)) == r[9] || error("pose replay differs from the app at step $step")
        end
        key = join(cells, "|")
        pdb_ms = 0.0
        if !haskey(cache, key)
            cache[key] = build_heuristic(pr, cells); pdb_ms = cache[key].build_ms
        end
        res = solve_front(cache[key], pose; maxdepth = maxdepth, time_limit_s = tlimit)
        println(io, join((id, variant, step, date, app_htm, app_rot, res.status, res.htm, res.rotations, res.nodes,
            round(res.ms; digits = 1), round(pdb_ms; digits = 1), res.root_h, res.word), "\t"))
        flush(io)
        println(stderr, "$id $variant step $step app=$app_htm front=$(res.htm) status=$(res.status) nodes=$(res.nodes) ms=$(round(res.ms)) h0=$(res.root_h)")
        if variant == "app"
            global pose = apply_word(pose, approute)
        else
            res.status == :solved || error("own chain cannot continue: step $step status $(res.status)")
            global pose = apply_word(pose, res.word)
        end
    end
end
