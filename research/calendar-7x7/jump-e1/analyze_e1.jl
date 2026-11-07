#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Analysis of the E1/E2 shard tables. Julia only; no Python.
# Usage: julia --startup-file=no analyze_e1.jl DIR EXPECTED_CASES
# Reads DIR/e1-shard*.tsv and DIR/e1-stats-shard*.tsv, prints Markdown, writes DIR/summary.md.
# Gates (owner decision): E1 success >= 95 %, median HTM <= 200, p95 HTM <= 500 (nearest rank, so the
# median of an even count is the lower middle value; over successful cases); E2 must succeed on every
# start. Plan stop rule: E1 success below 80 % ends the beam approach.
# A verdict (PASS or FAIL) is printed only for the full run (EXPECTED_CASES == 60) with all 60 distinct
# cases present and none skipped. Anything else prints SMOKE (EXPECTED_CASES < 60) or INCOMPLETE.
length(ARGS) == 2 || error("usage: analyze_e1.jl DIR EXPECTED_CASES")
const DIR = ARGS[1]
const EXPECTED = parse(Int, ARGS[2])
const FULL = 60
files = sort([f for f in readdir(DIR) if occursin(r"^e1-shard\d+\.tsv$", f)])
rows = Dict{String,String}[]
for f in files
    L = readlines(joinpath(DIR, f))
    isempty(L) && continue
    h = split(L[1], '\t')
    for l in L[2:end]
        isempty(l) && continue
        c = split(l, '\t'); length(c) == length(h) || error("bad row in $f: $l")
        push!(rows, Dict(String(h[i]) => String(c[i]) for i in eachindex(h)))
    end
end
cases = [r["case"] for r in rows]
length(unique(cases)) == length(cases) || error("duplicate case ids across the shard tables")
rank(v, p) = (s = sort(v); s[clamp(ceil(Int, p * length(s)), 1, length(s))])
fl(r, k) = parse(Float64, r[k])
ok1 = [r for r in rows if r["e1_status"] == "ok"]
skipped = [r for r in rows if r["e1_status"] == "skipped-budget"]
fail1 = [r for r in rows if startswith(r["e1_status"], "fail")]
ok2 = [r for r in rows if r["e2_status"] == "ok"]
ran = length(rows) - length(skipped)
rate = EXPECTED > 0 ? length(ok1) / EXPECTED : 0.0
htm = [fl(r, "e1_htm") for r in ok1]
secs = [fl(r, "e1_sec") for r in ok1]
io = IOBuffer()
println(io, "<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->")
println(io, "## E1/E2 result (", length(rows), " rows, ", EXPECTED, " expected)\n")
if EXPECTED < FULL
    println(io, "**SMOKE RUN: ", EXPECTED, " case(s) of ", FULL, ". No verdict; the figures below only show that the harness works.**\n")
end
if isempty(rows)
    println(io, "**INCOMPLETE: no result rows were produced (all shards failed before their first case).**")
else
    println(io, "| Quantity | Value |\n|---|---|")
    println(io, "| E1 success (any validated word) | ", length(ok1), " of ", EXPECTED, " = ", round(100rate; digits=1), " % |")
    println(io, "| E1 failed / skipped (budget) / missing | ", length(fail1), " / ", length(skipped), " / ", EXPECTED - length(rows), " |")
    if !isempty(ok1)
        println(io, "| E1 HTM median / p95 / max | ", rank(htm, 0.5), " / ", rank(htm, 0.95), " / ", maximum(htm), " |")
        println(io, "| E1 seconds median / p95 / max (catalogue builds excluded) | ", rank(secs, 0.5), " / ", rank(secs, 0.95), " / ", maximum(secs), " |")
        rsteps = [fl(r, "e1_rot_steps") for r in ok1]
        println(io, "| E1 whole-cube rotation steps (grouped) median / max | ", rank(rsteps, 0.5), " / ", maximum(rsteps), " |")
    end
    println(io, "| E2 floor success | ", length(ok2), " of ", ran, " run |")
    e2h = [fl(r, "e2_htm") for r in ok2]
    isempty(e2h) || println(io, "| E2 HTM median / p95 / max (same accept and M.htm as E1) | ", rank(e2h, 0.5), " / ", rank(e2h, 0.95), " / ", maximum(e2h), " |")
    rc1 = count(r -> r["e1_recheck"] == "ok", ok1); rc2 = count(r -> r["e2_recheck"] == "ok", ok2)
    println(io, "| Algebra re-check (M.V direct_move) ok, E1 / E2 | ", rc1, " of ", length(ok1), " / ", rc2, " of ", length(ok2), " |")
    println(io, "| Peak RSS over shards (MB) | ", maximum(fl(r, "maxrss_mb") for r in rows), " |")
    println(io, "\n### By method (E1 successes)\n\n| Method | n | median HTM |\n|---|---|---|")
    for how in sort(unique(r["e1_how"] for r in ok1))
        h = [fl(r, "e1_htm") for r in ok1 if r["e1_how"] == how]
        println(io, "| ", how, " | ", length(h), " | ", rank(h, 0.5), " |")
    end
    println(io, "\n### By walk length\n\n| Walk | cases | E1 ok | E1 median HTM | E2 ok |\n|---|---|---|---|---|")
    for w in sort(unique(parse(Int, r["walk_len"]) for r in rows))
        rs = [r for r in rows if parse(Int, r["walk_len"]) == w]
        o = [fl(r, "e1_htm") for r in rs if r["e1_status"] == "ok"]
        println(io, "| ", w, " | ", length(rs), " | ", length(o), " | ", isempty(o) ? "-" : rank(o, 0.5), " | ", count(r -> r["e2_status"] == "ok", rs), " |")
    end
    println(io, "\n### By stratum and target\n\n| Stratum | Display | Month | Start weekday | Days | cases | E1 ok | E1 median HTM |\n|---|---|---|---|---|---|---|---|")
    for key in sort(unique((r["stratum"], parse(Int, r["display_id"])) for r in rows))
        rs = [r for r in rows if r["stratum"] == key[1] && parse(Int, r["display_id"]) == key[2]]
        o = [fl(r, "e1_htm") for r in rs if r["e1_status"] == "ok"]
        r1 = first(rs)
        println(io, "| ", key[1], " | ", key[2], " | ", r1["year"], "-", lpad(r1["month"], 2, '0'), " | ", r1["start_dow"], " | ", r1["month_days"], " | ", length(rs), " | ", length(o), " | ", isempty(o) ? "-" : rank(o, 0.5), " |")
    end
    if !isempty(fail1)
        println(io, "\n### E1 failures\n")
        for r in fail1
            println(io, "- case ", r["case"], " (", r["stratum"], " display ", r["display_id"], ", walk ", r["walk_len"], "): ", r["e1_status"])
        end
    end
    stats = Dict{String,String}()
    for f in sort([f for f in readdir(DIR) if occursin(r"^e1-stats-shard\d+\.tsv$", f)])
        for l in readlines(joinpath(DIR, f))[2:end]
            c = split(l, '\t'); length(c) == 2 && (stats[String(c[1])] = String(c[2]))
        end
    end
    if haskey(stats, "macros")
        nm = parse(Float64, stats["macros"]); mv = parse(Float64, stats["mean_stickers_moved"])
        println(io, "\n### Macro library (input for a sparse WASM layout)\n")
        println(io, "- macros: ", stats["macros"], "; mean stickers moved per macro: ", stats["mean_stickers_moved"], "; mean constrained positions moved: ", stats["mean_constrained_positions_moved"])
        println(io, "- sparse layout estimate (4 bytes per moved sticker + 16 bytes word): ", round(nm * (4mv + 16) / 2^20; digits=1), " MB; dense u16 (", stats["perm_length"], " entries): ", round(nm * 2 * parse(Float64, stats["perm_length"]) / 2^20; digits=1), " MB")
        haskey(stats, "catalogue_seconds") && println(io, "- one-time seconds per shard: prelude (library build) ", stats["prelude_seconds"], ", catalogues ", stats["catalogue_seconds"])
    end
end
g_rate = rate >= 0.95
g_med = !isempty(htm) && rank(htm, 0.5) <= 200
g_p95 = !isempty(htm) && rank(htm, 0.95) <= 500
g_e2 = ran > 0 && length(ok2) == ran
stop80 = rate < 0.80
complete = EXPECTED == FULL && length(rows) == FULL && isempty(skipped)
println(io, "\n### Gates\n")
println(io, "- success >= 95 %: ", g_rate ? "PASS" : "FAIL")
println(io, "- median HTM <= 200 (lower median): ", g_med ? "PASS" : "FAIL")
println(io, "- p95 HTM <= 500: ", g_p95 ? "PASS" : "FAIL")
println(io, "- E2 floor succeeds on every start: ", g_e2 ? "PASS" : "FAIL")
println(io, "- plan stop rule (success < 80 % ends the beam approach): ", stop80 ? "TRIGGERED" : "not triggered")
verdict = EXPECTED < FULL ? "SMOKE (no verdict)" : !complete ? "INCOMPLETE (no verdict)" : (g_rate && g_med && g_p95 && g_e2) ? "PASS" : "FAIL"
println(io, "- verdict: **", verdict, "**")
println(io, "\nCandidates only: each word passed the planner's validate_front and, where the re-check is ok, a replay with the continuous verifier's direct_move. None is a chain edge or verified by the Julia or Flix chain verifiers; the front rule is the producer's own. A PASS lets the study go on to E3; it is not a proof of anything.")
println(io, "\nLicense: CC BY-SA 4.0 (SPDX-License-Identifier: CC-BY-SA-4.0). Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.")
txt = String(take!(io))
write(joinpath(DIR, "summary.md"), txt)
print(txt)
