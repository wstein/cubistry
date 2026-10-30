# Fixture builder for the HSM seconds-first conformance corpus.
#
# This is test-data tooling, NOT a verifier.  It never decides a verdict:
#
#   generate  copies the published witnesses and derives deliberately broken negative
#             controls from them by plain JSON edits.
#   pin       runs BOTH native checkers (Flix and Julia) on every case through their
#             `hsm FILE` command, requires identical valid/status/result digest, and only
#             then writes conformance-hsm/manifest.json.  Any difference is a dissent:
#             nothing is written and the status is UNKNOWN.
#
# See proof-checkers/HSM-PROFILE.md.  No Python verifier is consulted.
#
#   julia --project=proof-checkers/julia proof-checkers/tools/build_hsm_corpus.jl generate WITNESS BASELINE MODES RECOVERY OUTDIR
#   julia --project=proof-checkers/julia proof-checkers/tools/build_hsm_corpus.jl pin ROOT "JULIA CMD" "FLIX CMD"
using JSON, SHA

const PROFILE = "cubistry.hsm-seconds-first"
const RESEARCH_COMMIT = "4d9ef771305def5c4f6e9b1f2eec7689a03ed21b"
const MODES_COMMIT = "30b6d022da60c366d79de5498497df0a07e28caf"
const CASE_DIR = "proof-checkers/conformance-hsm/cases"

# The only non-optimal closed H 00-11 +1 period of twelve shortest edges the author's search found from the same
# start pose (43 HTM against the optimal 40).  Embedded as data; the checkers replay it.
const SUBOPTIMAL_H11 = ["U R2 U'", "R' B' R", "B' U R2 U'", "F D' F' R", "R' B' R", "U2 B U' B R2",
                        "R' B R", "F' R F D'", "R' B' R", "U2 R' U2 L", "R' B' R", "L U' F2 U"]

sha(data) = bytes2hex(sha256(data))

function inverse_word(word)
    out = String[]
    for t in reverse(split(word))
        push!(out, endswith(t, "2") ? t : endswith(t, "'") ? t[1:end-1] : t * "'")
    end
    join(out, " ")
end

mode(o, letter, maximum, direction) = only(m for m in o["modes"] if (m["letter"], m["maximum"], m["direction"]) == (letter, maximum, direction))
dump(o) = Vector{UInt8}(JSON.json(o) * "\n")

function cases(text, mtext)
    edited(fn) = (o = JSON.parse(text); fn(o); dump(o))
    medited(fn) = (o = JSON.parse(mtext); fn(o); dump(o))
    sticker(i; kw...) = o -> for (k, v) in kw; o["printing"][i+1][String(k)] = v; end
    function code_swap(old, new)
        o -> begin
            occursin(old, o["printCode"]) || error("printCode lacks $old")
            o["printCode"] = replace(o["printCode"], old => new; count=1)
        end
    end
    seq(fns...) = o -> for f in fns; f(o); end
    function swap_glyphs(o)
        a, b = o["printing"][2], o["printing"][4]
        a["image"], b["image"] = b["image"], a["image"]
        o["printCode"] = replace(o["printCode"], "T0 T2 T4 | T1 T3 T5" => "T0 T1 T4 | T2 T3 T5"; count=1)
    end
    function inverse_traversal(o)
        up, down = mode(o, "S", 59, 1), mode(o, "S", 59, -1)
        down["setup"], down["periodStartFrames"] = up["setup"], up["periodStartFrames"]
        steps = JSON.Object{String,Any}[]
        for s in reverse(up["steps"])
            e = JSON.Object{String,Any}()
            e["from"] = s["to"]; e["to"] = s["from"]; e["word"] = inverse_word(s["word"])
            push!(steps, e)
        end
        down["steps"] = steps
        for k in ("periodHTM", "periodEdges", "maximumHTM", "optimalMeanHTM")
            down[k] = up[k]
        end
    end
    function suboptimal(o)
        m = mode(o, "H", 11, 1)
        steps = JSON.Object{String,Any}[]
        for (i, w) in enumerate(SUBOPTIMAL_H11)
            e = JSON.Object{String,Any}()
            e["from"] = i - 1; e["to"] = i % 12; e["word"] = w
            push!(steps, e)
        end
        m["steps"] = steps
        total = sum(length(split(w)) for w in SUBOPTIMAL_H11)
        m["periodHTM"] = total; m["periodEdges"] = 12
        m["maximumHTM"] = maximum(length(split(w)) for w in SUBOPTIMAL_H11)
        m["optimalMeanHTM"] = "$total/12"
    end
    drop_second_lap(o) = (m = mode(o, "M", 59, 1); m["steps"] = m["steps"][1:60])
    skip_display(o) = (mode(o, "S", 59, 1)["steps"][6]["to"] = 7)
    wrong_frame(o) = (f = mode(o, "S", 59, 1)["periodStartFrames"][4]; f["p"] = [-v for v in f["p"]])
    non_shortest(o) = (mode(o, "S", 59, 1)["steps"][2]["word"] = "R2 U U'")
    drop_mode(o) = (o["modes"] = [m for m in o["modes"] if (m["letter"], m["maximum"], m["direction"]) != ("M", 59, -1)])
    duplicate_mode(o) = push!(o["modes"], JSON.parse(JSON.json(o["modes"][1])))
    setk(path, k, v) = o -> (path(o)[k] = v)
    mode0(o) = o["modes"][1]
    nl(s) = Vector{UInt8}(s * "\n")

    [
        ("schema-unsupported", "negative", "unknown schema name", edited(setk(identity, "schema", "cubistry.hsm-seconds-first-x"))),
        ("version-two", "negative", "unsupported witness version", edited(setk(identity, "version", 2))),
        ("version-float", "negative", "float version token", nl(replace(text, "\"version\":1" => "\"version\":1.0"; count=1))),
        ("extra-top-key", "negative", "unknown top-level key", edited(setk(identity, "note", "x"))),
        ("extra-sticker-key", "negative", "unknown sticker key", edited(sticker(4; color="red"))),
        ("extra-mode-key", "negative", "unknown mode key", edited(setk(mode0, "note", "x"))),
        ("extra-step-key", "negative", "unknown step key", edited(o -> o["modes"][1]["steps"][1]["note"] = "x")),
        ("duplicate-label-key", "negative", "duplicate JSON object key",
         nl(replace(text, "\"label\":\"seconds-first-best\"" => "\"label\":\"seconds-first-best\",\"label\":\"seconds-first-best\""; count=1))),
        ("truncated-json", "negative", "truncated JSON", Vector{UInt8}(text[1:end-40])),
        ("float-slot", "negative", "float integer token", nl(replace(text, "\"slot\":2" => "\"slot\":2.0"; count=1))),
        ("tampered-sticker-printcode", "negative", "sticker glyph changed, printCode kept", edited(sticker(0; image="7"))),
        ("tampered-sticker-missing-glyph", "negative", "tens 5 glyph replaced, printCode updated, glyph 5 no longer printed",
         edited(seq(sticker(5; image="4"), code_swap("T1 T3 T5", "T1 T3 T4")))),
        ("tampered-sticker-swapped-glyphs", "negative", "two tens glyphs swapped consistently, so the saved routes show wrong digits", edited(swap_glyphs)),
        ("printcode-wrong", "negative", "printCode differs from the printed stickers", edited(code_swap("S H M", "H S M"))),
        ("upside-down-glyph", "negative", "letter sticker printed upside down", edited(sticker(10; up=[0, 0, -1]))),
        ("blank-mislabelled", "negative", "real blank sticker given a nonblank slot class", edited(sticker(21; slot=1))),
        ("wrong-frame", "negative", "one saved period-start frame is wrong", edited(wrong_frame)),
        ("non-shortest-edge", "negative", "a saved edge is replaced by a longer word with the same effect", edited(non_shortest)),
        ("broken-closure", "negative", "M +1 period cut after the first lap does not close the full pose", edited(drop_second_lap)),
        ("skipped-display", "negative", "a saved edge skips a display", edited(skip_display)),
        ("missing-required-mode", "negative", "the M -1 mode is absent", edited(drop_mode)),
        ("duplicate-mode", "negative", "the same mode listed twice", edited(duplicate_mode)),
        ("wrong-lap-claim", "negative", "published period HTM is off by one", edited(setk(mode0, "periodHTM", 158))),
        ("wrong-max-claim", "negative", "published maximum edge is off by one", edited(setk(mode0, "maximumHTM", 3))),
        ("wrong-mean-claim", "negative", "published minimum mean differs from the period mean", edited(setk(mode0, "optimalMeanHTM", "13/5"))),
        ("wrong-graph-size", "negative", "published graph size differs from the rebuilt graph", edited(o -> mode(o, "H", 11, 1)["graphNodes"] = 23329)),
        ("non-minimum-mean", "negative", "valid closed shortest-edge H 00-11 +1 period published as the minimum-mean cycle", edited(suboptimal)),
        ("wrong-inverse", "negative", "S -1 given as the inverse traversal of S +1, which is not a shortest-edge schedule", edited(inverse_traversal)),
        ("universal-claim-five", "negative", "universal bound published as five HTM", edited(setk(identity, "universalArbitrarySourceHTM", 5))),
        ("m-cap-six", "negative", "M mode published with a six-HTM cap", edited(o -> mode(o, "M", 59, 1)["htmCap"] = 6)),
        ("word-double-space", "negative", "non-canonical whitespace in a move word", edited(o -> o["modes"][1]["steps"][1]["word"] = "R'  B2 R'")),
        ("modes-selection-rule", "negative", "S 59 -1 claims its own period although the +1 period is not worse",
         medited(o -> (o["appModes"][2]["sourceDirection"] = -1; o["appModes"][2]["traversal"] = "forward"))),
        ("modes-traversal", "negative", "application mode claims forward traversal of the opposite period",
         medited(o -> o["appModes"][2]["traversal"] = "forward")),
        ("modes-app-metric", "negative", "application period HTM understated", medited(o -> o["appModes"][1]["periodHTM"] = 158)),
        ("modes-edge-limit", "negative", "edge limit published as six", medited(o -> o["edgeLimitHTM"] = 6)),
        ("modes-missing-mode", "negative", "one of the 18 own periods is absent", medited(o -> deleteat!(o["modes"], 4))),
        ("modes-cap-four", "negative", "own period certified under a four HTM cap", medited(o -> o["modes"][1]["htmCap"] = 4)),
        # Controls for the dissents found in the review of PR 95 (HSM-PROFILE.md, root-cause record).
        ("mean-trailing-newline", "negative", "minimum mean followed by a newline is not a canonical fraction",
         edited(setk(mode0, "optimalMeanHTM", "53/20\n"))),
        ("mean-non-ascii-digits", "negative", "minimum mean written with Arabic-Indic digits is not a canonical fraction",
         edited(setk(mode0, "optimalMeanHTM", "٥٣/٢٠"))),
        ("byte-order-mark", "negative", "UTF-8 byte order mark before the JSON text", vcat(UInt8[0xef, 0xbb, 0xbf], nl(text))),
        ("modes-lap-trailing-newline", "negative", "application per-lap HTM followed by a newline",
         medited(o -> o["appModes"][1]["perLapHTM"] = o["appModes"][1]["perLapHTM"] * "\n")),
        ("modes-lap-non-ascii-digits", "negative", "application per-lap HTM written with Arabic-Indic digits",
         medited(o -> o["appModes"][1]["perLapHTM"] = "١٥٩/١")),
    ]
end

function generate(witness, baseline, modes, recovery, outdir)
    ispath(outdir) && error("output directory must be new")
    mkpath(outdir)
    w, b, m, r = read.((witness, baseline, modes, recovery))
    rows = [("witness", "positive", "new seconds-first print, eight modes (research $(RESEARCH_COMMIT[1:7]))", w),
            ("baseline", "positive", "current app print, eight recurrent modes (research $(RESEARCH_COMMIT[1:7]))", b),
            ("modes", "positive", "same print, all 18 own periods and application modes, edges at most five HTM (research $(MODES_COMMIT[1:7]))", m),
            ("recovery-unsupported", "negative", "recovery-table schema: no native profile, UNSUPPORTED (research $(MODES_COMMIT[1:7]))", r)]
    append!(rows, cases(JSON.json(JSON.parse(String(copy(w)))), JSON.json(JSON.parse(String(copy(m))))))
    index = JSON.Object{String,Any}[]
    for (name, group, description, data) in rows
        write(joinpath(outdir, name * ".json"), data)
        e = JSON.Object{String,Any}()
        e["name"] = name; e["group"] = group; e["description"] = description
        e["path"] = "$CASE_DIR/$name.json"; e["sha256"] = sha(data)
        push!(index, e)
    end
    write(joinpath(dirname(outdir), "cases.index.json"), JSON.json(index; pretty=2) * "\n")
    println(length(index), " cases written to ", outdir)
end

function run_checker(cmd, path)
    out = IOBuffer()
    p = run(pipeline(ignorestatus(Cmd([cmd; path])); stdout=out, stderr=devnull))
    lines = filter(l -> !isempty(strip(l)), split(String(take!(out)), '\n'))
    r = JSON.parse(String(lines[end]))
    (valid=r["valid"], status=r["status"], digest=r["valid"] ? sha(String(lines[end])) : "", reason=get(r, "reason", ""))
end

function pin(root, julia, flix)
    index = JSON.parse(read(joinpath(root, "proof-checkers/conformance-hsm/cases.index.json"), String))
    jcmd = [split(julia); joinpath(root, "proof-checkers/julia/check.jl"); "hsm"]
    fcmd = [split(flix); "hsm"]
    cases_out, dissent = JSON.Object{String,Any}[], []
    for row in index
        path = joinpath(root, CASE_DIR, row["name"] * ".json")
        sha(read(path)) == row["sha256"] || error("fixture changed: " * row["name"])
        a = run_checker(fcmd, path); b = run_checker(jcmd, path)
        println(row["name"], " flix: ", a.status, " julia: ", b.status); flush(stdout)
        if (a.valid, a.status, a.digest) != (b.valid, b.status, b.digest)
            push!(dissent, (row["name"], a, b)); continue
        end
        e = JSON.Object{String,Any}(row)
        e["expectedValid"] = a.valid; e["expectedStatus"] = a.status; e["resultSHA256"] = a.digest
        push!(cases_out, e)
    end
    if !isempty(dissent)
        println("DISSENT: status UNKNOWN, manifest not written")
        foreach(println, dissent)
        exit(1)
    end
    m = JSON.Object{String,Any}()
    m["schema"] = "cubistry.hsm-conformance.v1"; m["profile"] = PROFILE
    m["researchCommits"] = JSON.Object{String,Any}("seconds-first" => RESEARCH_COMMIT, "seconds-first-modes" => MODES_COMMIT)
    m["scope"] = "raw-input HSM profile; verdicts produced by the Flix and Julia checkers, identical in both"
    m["caseCount"] = length(cases_out); m["cases"] = cases_out
    write(joinpath(root, "proof-checkers/conformance-hsm/manifest.json"), JSON.json(m; pretty=2) * "\n")
    println("manifest written: ", length(cases_out), " cases")
end

if length(ARGS) >= 1 && ARGS[1] == "generate" && length(ARGS) == 6
    generate(ARGS[2:6]...)
elseif length(ARGS) == 4 && ARGS[1] == "pin"
    pin(ARGS[2:4]...)
else
    error("usage: generate WITNESS BASELINE MODES RECOVERY OUTDIR | pin ROOT JULIACMD FLIXCMD")
end
