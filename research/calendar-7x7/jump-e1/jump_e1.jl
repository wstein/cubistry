#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED experiment harness (candidate generator only).
#
# Experiment E1/E2 of the 7x7 "jump" feasibility study: can the existing pure-split producer
# (pilot/producer-resume.jl: macro library, beam search, hybrid finish, orbit-solve fallback)
# reach a display front from an ARBITRARY legal pose, not only from a chain state?
#
# It does not copy the producer. It reads pilot/producer-resume.jl (SHA-256 pinned below), cuts the
# text before the line that starts with "# ---------------- driver", replaces @__DIR__ by the
# absolute pilot directory, writes that prelude to a temporary directory outside the source tree
# and includes it with ARGS set to
#   DAG PRINT /dev/null 1 resume PRIOR_MOVES
# After the include, the producer's own definitions (MACS, solve_edge, accept, orbit_solve, digest,
# calendar_target, state, ...) live in Main. `state` is the end state of the prior chain.
#
# Starts: the chain end state composed with a seeded random walk of legal generators.
# Targets: 12 display ids, 2 for each of 6 strata (F31, S30, S31, plain, Feb 28, Feb 29), chosen by
# a fixed rule from english/evidence/targets.tsv (see pick_targets).
# E1 = solve_edge (beam, hybrid, orbit fallback); E2 = orbit_solve alone, then the producer's accept
# (so both words go through the same improve_word, validate_front and M.htm).
# A result is a candidate. Besides the planner's validate_front it gets an algebra re-check: the word
# is replayed on the 294 stickers with the continuous verifier's direct_move (M.V) and must give the
# same state and digest as the producer's permutation arithmetic. The FRONT RULE is still the
# producer's validate_front; the re-check does not make a word a certified chain edge.
#
# Usage: julia --startup-file=no jump_e1.jl DAG PRINT PRIOR_MOVES OUT_DIR SHARD NSHARD
# Environment: E1_ROT=1 lets the random walk use whole-cube rotations (default 0),
#              E1_SMOKE=1 runs one case only, E1_DEADLINE_MIN (default 300) stops starting new cases.
using Dates, Random, SHA
const E1_PRODUCER_SHA256 = "922219b96d8bfccf243b715d30797ca8fa7e0161d5172a4351e074b929537c11"
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
const E1_PILOT = normpath(joinpath(@__DIR__, "..", "pure-split-states", "pilot"))
const E1_WALKS = [50, 300, 1000, 3000, 5000]
const E1_SEED = 20261107
mkpath(E1_OUT)

# ---- prelude: the producer without its driver ----
const E1_SRC_PATH = joinpath(E1_PILOT, "producer-resume.jl")
bytes2hex(sha256(read(E1_SRC_PATH))) == E1_PRODUCER_SHA256 ||
    error("producer-resume.jl changed (SHA-256 differs from the pin); review the harness before re-pinning")
const E1_SRC = read(E1_SRC_PATH, String)
const E1_MARK = findfirst(r"^# -{16} driver"m, E1_SRC)
E1_MARK === nothing && error("producer-resume.jl has no driver marker; the harness needs updating")
const E1_PRELUDE_TEXT = replace(E1_SRC[1:first(E1_MARK)-1], "@__DIR__" => repr(E1_PILOT))
const E1_TMP = mktempdir()
const E1_PRELUDE = joinpath(E1_TMP, "e1-prelude.jl")
write(E1_PRELUDE, E1_PRELUDE_TEXT)
empty!(ARGS)
append!(ARGS, [E1_DAG, E1_PRINT, "/dev/null", "1", "resume", E1_PRIOR])
try
    include(E1_PRELUDE)
finally
    rm(E1_TMP; recursive=true, force=true)
end
println("E1 prelude done after ", round(time() - E1_T0; digits=1), " s; chain end ", lastym[1], "-", lastym[2]); flush(stdout)
const E1_PRELUDE_SEC = time() - E1_T0

# ---- catalogue builds are timed here, so they do not inflate the first case ----
t_cat = time()
const E1_CATS = Ref{Any}(P.chain_catalogues(action))
CACHE[] === nothing && (CACHE[] = M.cached_catalogues(action, a; relax_budget=60000))
const E1_CATALOGUE_SEC = time() - t_cat
println("E1 catalogues built in ", round(E1_CATALOGUE_SEC; digits=1), " s"); flush(stdout)

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
        println(io, "prelude_seconds\t", round(E1_PRELUDE_SEC; digits=1))
        println(io, "catalogue_seconds\t", round(E1_CATALOGUE_SEC; digits=1))
        println(io, "producer_sha256\t", E1_PRODUCER_SHA256)
        println(io, "julia\t", VERSION)
    end
end

# ---- targets: 2 per stratum, fixed rule ----
function stratum(y, m)
    d = Date(y, m, 1); dow = dayofweek(d); n = daysinmonth(d)
    m == 2 ? (n == 29 ? "feb29" : "feb28") :
    dow == 5 && n == 31 ? "F31" : dow == 6 && n == 30 ? "S30" : dow == 6 && n == 31 ? "S31" : "plain"
end
# Per stratum: the first id in table order, then the first later id whose month and start weekday both
# differ, else whose weekday differs, else whose month differs, else the second id of the stratum.
function pick_targets(ids)
    out = Tuple{String,Int,Int,Int}[]
    for s in ["F31", "S30", "S31", "plain", "feb28", "feb29"]
        c = [(id, y, m) for (id, y, m) in ids if stratum(y, m) == s]
        length(c) >= 2 || error("stratum $s has fewer than 2 displays")
        dw(x) = dayofweek(Date(x[2], x[3], 1))
        a = c[1]
        j = findfirst(x -> x[3] != a[3] && dw(x) != dw(a), c)
        j === nothing && (j = findfirst(x -> dw(x) != dw(a), c))
        j === nothing && (j = findfirst(x -> x[3] != a[3], c))
        j === nothing && (j = 2)
        push!(out, (s, a...)); push!(out, (s, c[j]...))
    end
    out
end
const E1_TARGETS = let
    rows = [split(l, '\t') for l in readlines(joinpath(E1_PILOT, "..", "..", "english", "evidence", "targets.tsv"))[2:end] if !isempty(l)]
    pick_targets([(parse(Int, r[1]), parse(Int, r[2]), parse(Int, r[3])) for r in rows])
end
length(E1_TARGETS) == 12 || error("expected 12 targets")

# ---- starts ----
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
const E1_SDIG = [digest(S) for S in E1_STARTS]
const E1_CASES = [(ti - 1) * length(E1_WALKS) + si - 1 for ti in eachindex(E1_TARGETS) for si in eachindex(E1_WALKS)]
const E1_MINE = E1_SMOKE ? (E1_SHARD == 0 ? [0] : Int[]) : [k for k in E1_CASES if k % E1_NSHARD == E1_SHARD]
println("E1 shard $E1_SHARD of $E1_NSHARD: ", length(E1_MINE), " cases; rotations in walk: ", E1_ROT)
for (s, id, y, m) in E1_TARGETS; println("  target ", s, " id ", id, " ", y, "-", m); end
flush(stdout)

# ---- helpers ----
clean(s) = (t = replace(first(split(string(s), '\n')), '\t' => ' '); first(t, 120))
# Grouped steps (g, q) of a signed word: consecutive moves of one generator merge to one step.
function e1_steps(word)
    steps = Tuple{Int,Int}[]
    i = 1
    while i <= length(word)
        g = abs(word[i]); net = 0
        while i <= length(word) && abs(word[i]) == g
            net += sign(word[i]); i += 1
        end
        n = mod(net, 4)
        n == 0 && continue
        push!(steps, (g, n == 3 ? -1 : n))
    end
    steps
end
const E1_VP = try M.V.read_physical(E1_PRINT) catch e; e end
# Replays the word on the 294 stickers with the continuous verifier's direct_move and compares state and
# digest with the producer's permutation arithmetic. Never throws; returns (status, digest).
function e1_recheck(S, v)
    try
        E1_VP isa Exception && return ("unavailable: " * clean(sprint(showerror, E1_VP)), "-")
        st = M.V.decode_physical(E1_VP, S, action)
        for (g, q) in e1_steps(v.word); st = M.V.direct_move(st, g, q); end
        st == M.V.decode_physical(E1_VP, v.state, action) || return ("state-mismatch", "-")
        d = M.V.state_digest(st)
        d == digest(v.state) || return ("digest-mismatch", d)
        return ("ok", d)
    catch e
        return ("error: " * clean(sprint(showerror, e)), "-")
    end
end

const E1_HEADER = ["shard", "case", "stratum", "display_id", "year", "month", "start_dow", "month_days", "start_id", "walk_len", "walk_rot",
    "e1_status", "e1_how", "e1_htm", "e1_rot_steps", "e1_unsat0", "e1_sec", "e1_recheck", "start_digest", "e1_end_digest", "e1_word",
    "e2_status", "e2_htm", "e2_rot_steps", "e2_sec", "e2_recheck", "e2_end_digest", "e2_word", "maxrss_mb"]
open(joinpath(E1_OUT, "e1-shard$(E1_SHARD).tsv"), "w") do io
    println(io, join(E1_HEADER, '\t')); flush(io)
    for k in E1_MINE
        ti, si = divrem(k, length(E1_WALKS)) .+ (1, 1)
        stratum_name, id, y, m = E1_TARGETS[ti]
        S = E1_STARTS[si]
        row = Dict{String,String}(c => "-" for c in E1_HEADER)
        merge!(row, Dict("shard" => string(E1_SHARD), "case" => string(k), "stratum" => stratum_name, "display_id" => string(id),
            "year" => string(y), "month" => string(m), "start_dow" => string(dayofweek(Date(y, m, 1))),
            "month_days" => string(daysinmonth(Date(y, m, 1))), "start_id" => string(si), "walk_len" => string(E1_WALKS[si]),
            "walk_rot" => E1_ROT ? "1" : "0", "start_digest" => E1_SDIG[si], "e1_htm" => "-1", "e1_rot_steps" => "-1",
            "e1_unsat0" => "-1", "e1_sec" => "0", "e2_htm" => "-1", "e2_rot_steps" => "-1", "e2_sec" => "0"))
        if time() - E1_T0 > E1_DEADLINE
            row["e1_status"] = "skipped-budget"; row["e2_status"] = "skipped-budget"
        else
            println("CASE $k $stratum_name display $id $y-$m start $si walk $(E1_WALKS[si])"); flush(stdout)
            t = time()
            try
                r = solve_edge(S, y, m)
                v = r.list[1]
                row["e1_status"] = "ok"; row["e1_how"] = first(split(r.how)); row["e1_htm"] = string(M.htm(v.word))
                row["e1_rot_steps"] = string(count(s -> s[1] % 7 == 0, e1_steps(v.word))); row["e1_unsat0"] = string(r.u0)
                row["e1_end_digest"] = digest(v.state); row["e1_word"] = join(v.word, ' ')
                row["e1_recheck"] = first(e1_recheck(S, v))
            catch e
                row["e1_status"] = "fail: " * clean(sprint(showerror, e))
            end
            row["e1_sec"] = string(round(time() - t; digits=1))
            # E2: the orbit-by-orbit floor alone on the same start; the word goes through accept like E1's
            t = time()
            try
                o = orbit_solve(P, source, S, calendar_target(y, m), action, E1_CATS[])
                v = o === nothing ? nothing : accept(S, calendar_target(y, m), o.word)
                if v === nothing
                    row["e2_status"] = o === nothing ? "fail: stalled" : "fail: validation"
                else
                    row["e2_status"] = "ok"; row["e2_htm"] = string(M.htm(v.word))
                    row["e2_rot_steps"] = string(count(s -> s[1] % 7 == 0, e1_steps(v.word)))
                    row["e2_end_digest"] = digest(v.state); row["e2_word"] = join(v.word, ' ')
                    row["e2_recheck"] = first(e1_recheck(S, v))
                end
            catch e
                row["e2_status"] = "fail: " * clean(sprint(showerror, e))
            end
            row["e2_sec"] = string(round(time() - t; digits=1))
        end
        row["maxrss_mb"] = string(round(Sys.maxrss() / 2^20; digits=0))
        println(io, join((row[c] for c in E1_HEADER), '\t')); flush(io)
        println("  E1 ", row["e1_status"], " ", row["e1_how"], " htm=", row["e1_htm"], " ", row["e1_sec"], " s recheck=", row["e1_recheck"],
            "; E2 ", row["e2_status"], " htm=", row["e2_htm"], " ", row["e2_sec"], " s recheck=", row["e2_recheck"], "; rss ", row["maxrss_mb"], " MB"); flush(stdout)
        GC.gc()
    end
end
println("E1 SHARD DONE")
