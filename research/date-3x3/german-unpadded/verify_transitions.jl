# Usage: julia verify_transitions.jl RESULTS.json JOBS.json   (replays source word + planned transition from the home print)
include(joinpath(@__DIR__, "load.jl"))
function main(resf, jobsf)
    r = parse_json(read(resf, String))["results"]; W = String.(split(parse_json(read(jobsf, String))["W"]))
    cache = Dict{String,Replay.Witness}(); io = IOBuffer(); bad = 0
    for x in r
        src = x["source"]; wp = src["witness"]
        w = get!(() -> load_witness(wp), cache, wp)
        t = first(t for t in w.targets if t["weekday"] == src["weekday"] && t["day"] == src["day"] && t["month"] == src["month"])
        extra = haskey(src, "extra") ? String.(src["extra"]) : String[]
        srctoks = vcat(parse_word(t["prelude"]), parse_word(t["word"]), parse_word(t["centerCorrection"]), extra)
        tr = vcat(parse_word(x["prelude"]), parse_word(x["word"]), parse_word(x["centerCorrection"]))
        st = Cube.replay(w.stk, vcat(srctoks, tr))
        tg = x["target"]; padded = x["padding"] == "zero"
        cells = expected_cells(tg["weekday"], tg["day"], tg["month"]; padded)
        fc = front_cells(st, w.image)
        ok = all(fc[i][1] == cells[i] && fc[i][2] for i in 1:9)
        # owner scheme: after a padded target with day < 10 the word W turns the display into the unpadded one
        wfinal = ""
        if endswith(split(x["id"], "|")[2], "W") && tg["day"] < 10
            s2 = Cube.replay(st, W)
            c2 = expected_cells(tg["weekday"], tg["day"], tg["month"]; padded = false)
            f2 = front_cells(s2, w.image)
            same = all(s2[i] == st[i] for i in eachindex(st) if count(!iszero, st[i].p) != 1)
            ok2 = same && all(f2[i][1] == c2[i] && f2[i][2] for i in 1:9)
            ok &= ok2; wfinal = " +W(outer=$(count_moves(W)[1]),rot=$(count_moves(W)[2])) unpadded-ok=$ok2"
        end
        o, rr, _ = count_moves(tr)
        bad += !ok
        println(io, x["id"], " outer=$o rot=$rr", wfinal, " display-ok=$ok")
    end
    println(io, "SUMMARY jobs=$(length(r)) failed=$bad")
    print(String(take!(io))); exit(bad == 0 ? 0 : 1)
end
main(ARGS[1], ARGS[2])
