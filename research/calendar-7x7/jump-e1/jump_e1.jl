#!/usr/bin/env julia
# UNTRUSTED experiment harness (candidate generator only). License: AGPL-3.0-or-later.
#
# Experiment E1/E2 of the 7x7 "jump" feasibility study: can the existing pure-split producer
# (pilot/producer-resume.jl: macro library, beam search, hybrid finish, orbit-solve fallback)
# reach a display front from an ARBITRARY legal pose, not only from a chain state?
#
# It does not copy the producer. It reads pilot/producer-resume.jl, cuts the text before the
# line starting with "# ---------------- driver", writes that prelude next to the producer (so the
# relative includes resolve), and includes it with ARGS set to
#   DAG PRINT /dev/null 1 resume PRIOR_MOVES
# After the include, the producer's own definitions (MACS, solve_edge, orbit_solve, digest,
# calendar_target, state, ...) live in Main. `state` is the end state of the prior chain.
#
# Starts: the chain end state composed with a seeded random walk of legal generators.
# Targets: 12 display ids spread over 1..91 (first occurrence month from english/evidence/targets.tsv).
# E1 = solve_edge (beam, hybrid, orbit fallback); E2 = orbit_solve alone (the floor).
# A result is a candidate: the planner's validate_front accepted it. It is NOT a chain edge, and
# neither chain verifier (Julia, Flix) can check it, because the start is not a chain state.
#
# Usage: julia --startup-file=no jump_e1.jl DAG PRINT PRIOR_MOVES OUT_DIR SHARD NSHARD
# Environment: E1_ROT=1 lets the random walk use whole-cube rotations (default 0),
#              E1_SMOKE=1 runs one case only, E1_DEADLINE_MIN (default 300) stops starting new cases.
using Dates, Random
const E1_ARGS = copy(ARGS)
length(E1_ARGS) == 6 || error("usage: jump_e1.jl DAG PRINT PRIOR_MOVES OUT_DIR SHARD NSHARD")
const E1_DAG, E1_PRINT, E1_PRIOR, E1_OUT = E1_ARGS[1], E1_ARGS[2], E1_ARGS[3], E1_ARGS[4]
const E1_SHARD = parse(Int, E1_ARGS[5])
const E1_NSHARD = parse(Int, E1_ARGS[6])
(E1_NSHARD >= 1 && 0 <= E1_SHARD < E1_NSHARD) || error("bad shard $E1_SHARD of $E1_NSHARD")
const E1_ROT = get(ENV, "E1_ROT", "0") == "1"
const E1_SMOKE = get(ENV, "E1_SMOKE", "0") == "1"
const E1_DEADLINE = parse(Float64, get(ENV, "E1_DEADLINE_MIN", "300")) * 60
const E1_T0 = time()
const E1_PILOT = joinpath(@__DIR__, "..", "pure-split-states", "pilot")
const E1_IDS = [1, 9, 17, 25, 33, 41, 50, 58, 66, 74, 82, 91]
const E1_WALKS = [50, 300, 1000, 3000, 5000]
const E1_SEED = 20261107
mkpath(E1_OUT)

# ---- prelude: the producer without its driver ----
const E1_SRC = read(joinpath(E1_PILOT, "producer-resume.jl"), String)
const E1_MARK = findfirst("# ---------------- driver", E1_SRC)
E1_MARK === nothing && error("producer-resume.jl has no driver marker; the harness needs updating")
const E1_PRELUDE = joinpath(E1_PILOT, ".e1-prelude.jl")
write(E1_PRELUDE, E1_SRC[1:first(E1_MARK)-1])
empty!(ARGS)
append!(ARGS, [E1_DAG, E1_PRINT, "/dev/null", "1", "resume", E1_PRIOR])
try
    include(E1_PRELUDE)
finally
    rm(E1_PRELUDE; force=true)
end
println("E1 prelude done after ", round(time() - E1_T0; digits=1), " s; chain end ", lastym[1], "-", lastym[2]); flush(stdout)

# ---- library statistics (input for a sparse WASM layout estimate) ----
let nm = length(MACS)
    mean_cs = sum(length(m.cs) for m in MACS) / nm
    mean_moved = sum(count(i -> m.winv[i] != i, eachindex(m.winv)) for m in MACS) / nm
    open(joinpath(E1_OUT, "e1-stats-shard$(E1_SHARD).tsv"), "w") do io
        println(io, "key\tvalue")
        println(io, "macros\t", nm)
        println(io, "perm_length\t", length(first(MACS).winv))
        println(io, "mean_constrained_positions_moved\t", round(mean_cs; digits=3))
        println(io, "mean_stickers_moved\t", round(mean_moved; digits=3))
        println(io, "prelude_seconds\t", round(time() - E1_T0; digits=1))
        println(io, "julia\t", VERSION)
    end
end

# ---- starts and targets ----
function e1_walk(seed, len, rot)
    rng = Random.MersenneTwister(seed)
    pool = rot ? collect(1:21) : [g for g in 1:21 if g % 7 != 0]
    w = Int[]; prev = 0
    while length(w) < len
        g = rand(rng, pool); g == prev && continue
        push!(w, rand(rng, Bool) ? g : -g); prev = g
    end
    w
end
const E1_BASE = state
const E1_STARTS = [P.compose(E1_BASE, P.macro_word_perm(e1_walk(E1_SEED + si, E1_WALKS[si], E1_ROT), gens)) for si in eachindex(E1_WALKS)]
const E1_TARGETS = let
    rows = [split(l, '\t') for l in readlines(joinpath(E1_PILOT, "..", "..", "english", "evidence", "targets.tsv"))[2:end] if !isempty(l)]
    d = Dict(parse(Int, r[1]) => (parse(Int, r[2]), parse(Int, r[3])) for r in rows)
    [(id, d[id]...) for id in E1_IDS]
end
const E1_CASES = [(ti - 1) * length(E1_WALKS) + si - 1 for ti in eachindex(E1_TARGETS) for si in eachindex(E1_WALKS)]
const E1_MINE = E1_SMOKE ? (E1_SHARD == 0 ? [0] : Int[]) : [k for k in E1_CASES if k % E1_NSHARD == E1_SHARD]
println("E1 shard $E1_SHARD of $E1_NSHARD: ", length(E1_MINE), " cases; rotations in walk: ", E1_ROT); flush(stdout)

clean(s) = replace(first(split(string(s), '\n')), '\t' => ' ')[1:min(end, 120)]
const E1_HEADER = ["shard", "case", "display_id", "year", "month", "start_dow", "month_days", "start_id", "walk_len", "walk_rot",
    "e1_status", "e1_how", "e1_htm", "e1_rot_moves", "e1_unsat0", "e1_sec", "e2_status", "e2_htm", "e2_sec", "maxrss_mb"]
const E1_CATS = Ref{Any}(nothing)
open(joinpath(E1_OUT, "e1-shard$(E1_SHARD).tsv"), "w") do io
    println(io, join(E1_HEADER, '\t')); flush(io)
    for k in E1_MINE
        ti, si = divrem(k, length(E1_WALKS)) .+ (1, 1)
        id, y, m = E1_TARGETS[ti]
        S = E1_STARTS[si]
        row = Dict{String,String}("shard" => string(E1_SHARD), "case" => string(k), "display_id" => string(id), "year" => string(y),
            "month" => string(m), "start_dow" => string(Dates.dayofweek(Date(y, m, 1))), "month_days" => string(Dates.daysinmonth(Date(y, m, 1))),
            "start_id" => string(si), "walk_len" => string(E1_WALKS[si]), "walk_rot" => E1_ROT ? "1" : "0",
            "e1_how" => "-", "e1_htm" => "-1", "e1_rot_moves" => "-1", "e1_unsat0" => "-1", "e1_sec" => "0",
            "e2_status" => "-", "e2_htm" => "-1", "e2_sec" => "0")
        if time() - E1_T0 > E1_DEADLINE
            row["e1_status"] = "skipped-budget"; row["e2_status"] = "skipped-budget"
        else
            println("CASE $k display $id $y-$m start $si walk $(E1_WALKS[si])"); flush(stdout)
            t = time()
            try
                r = solve_edge(S, y, m)
                v = r.list[1]
                row["e1_status"] = "ok"; row["e1_how"] = first(split(r.how)); row["e1_htm"] = string(M.htm(v.word))
                row["e1_rot_moves"] = string(count(g -> abs(g) % 7 == 0, v.word)); row["e1_unsat0"] = string(r.u0)
            catch e
                row["e1_status"] = "fail: " * clean(sprint(showerror, e))
            end
            row["e1_sec"] = string(round(time() - t; digits=1))
            # E2: the orbit-by-orbit floor alone, on the same start
            t = time()
            try
                E1_CATS[] === nothing && (E1_CATS[] = P.chain_catalogues(action))
                o = orbit_solve(P, source, S, calendar_target(y, m), action, E1_CATS[])
                if o === nothing
                    row["e2_status"] = "fail: stalled"
                else
                    row["e2_status"] = "ok"; row["e2_htm"] = string(M.htm(o.word))
                end
            catch e
                row["e2_status"] = "fail: " * clean(sprint(showerror, e))
            end
            row["e2_sec"] = string(round(time() - t; digits=1))
        end
        row["maxrss_mb"] = string(round(Sys.maxrss() / 2^20; digits=0))
        println(io, join((row[c] for c in E1_HEADER), '\t')); flush(io)
        println("  E1 ", row["e1_status"], " ", row["e1_how"], " htm=", row["e1_htm"], " ", row["e1_sec"], " s; E2 ", row["e2_status"], " htm=", row["e2_htm"], " ", row["e2_sec"], " s; rss ", row["maxrss_mb"], " MB"); flush(stdout)
        GC.gc()
    end
end
println("E1 SHARD DONE")
