# Independent physical replay of date witnesses (own geometry, Cube.jl; no solver, no generator code).
module Replay
using ..Cube, ..MiniJSON, Dates
export load_witness, expected_cells, date_patterns, check_target, final_state, front_cells,
       count_moves, report_line, WORDLEX, MONTHS, home_stickers

const WEEKDAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"]
const MONTHS = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"]
const WORDLEX = WEEKDAYS

struct Witness
    stk::Vector{Cube.Stk}
    image::Vector{String}
    targets::Vector{Dict{String,Any}}
end

function vec3(a)::Cube.Pt
    (Int(a[1]), Int(a[2]), Int(a[3]))
end

function load_witness(path)
    j = parse_json(read(path, String))
    pr = sort(j["printing"], by = s -> s["id"])
    stk = [Cube.Stk(vec3(s["p"]), vec3(s["n"]), vec3(s["up"])) for s in pr]
    img = [String(s["image"]) for s in pr]
    Witness(stk, img, Vector{Dict{String,Any}}(j["targets"]))
end
home_stickers(w::Witness) = w.stk

# Gregorian 2000-2399: every (weekday(0=Monday), day, month), sorted by month, day, weekday
function date_patterns()
    s = Set{Tuple{Int,Int,Int}}()
    d = Date(2000, 1, 1)
    while year(d) < 2400
        push!(s, (dayofweek(d) - 1, day(d), month(d))); d += Day(1)
    end
    sort(collect(s), by = t -> (t[3], t[2], t[1]))
end

# German A: weekday row (2 letters, third blank), day row (blank, tens, units), month row (3 letters)
function expected_cells(w, d, m; padded::Bool)
    wd = collect(WEEKDAYS[w + 1]); mo = collect(MONTHS[m])
    tens = d >= 10 ? string(d ÷ 10) : (padded ? "0" : "")
    [string(wd[1]), string(wd[2]), "", "", tens, string(d % 10), string(mo[1]), string(mo[2]), string(mo[3])]
end

function front_cells(state::Vector{Cube.Stk}, image::Vector{String})
    out = Tuple{String,Bool}[]   # (image, upright-or-blank)
    for (row, y) in enumerate((1, 0, -1)), (col, x) in enumerate((-1, 0, 1))
        k = findfirst(s -> s.p == (x, y, 1) && s.n == (0, 0, 1), state)
        k === nothing && error("no front sticker")
        push!(out, (image[k], image[k] == "" || state[k].u == (0, 1, 0)))
    end
    out
end

function final_state(w::Witness, toks)
    Cube.replay(w.stk, toks)
end

function count_moves(toks)
    outer = count(t -> t[1] in "RLUDFB", toks); rot = count(t -> t[1] in "xyz", toks)
    slice = count(t -> t[1] in "MES", toks)
    outer, rot, slice
end

# returns (ok::Bool, why::String, toks)
function check_target(w::Witness, t::Dict{String,Any}; padded::Bool, extra::Vector{String} = String[])
    wd, d, m = t["weekday"], t["day"], t["month"]
    toks = vcat(parse_word(t["prelude"]), parse_word(t["word"]), parse_word(t["centerCorrection"]), extra)
    st = final_state(w, toks)
    cells = expected_cells(wd, d, m; padded)
    fc = front_cells(st, w.image)
    for i in 1:9
        fc[i][1] == cells[i] || return (false, "cell $i shows $(fc[i][1]) expected $(cells[i])", toks)
        fc[i][2] || return (false, "cell $i not upright", toks)
    end
    # source-restoring inverse
    back = Cube.replay(st, inverse_word(toks))
    back == w.stk || return (false, "inverse does not restore the print", toks)
    (true, "", toks)
end

function report_line(t, toks, padded)
    o, r, s = count_moves(toks)
    cells = join(expected_cells(t["weekday"], t["day"], t["month"]; padded), "|")
    "T $(t["weekday"]) $(t["day"]) $(t["month"]) $cells outer=$o rot=$r"
end
end
