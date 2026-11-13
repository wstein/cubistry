module ReplayExtra
using ..Cube, ..Replay
using ..Replay: expected_cells, front_cells
export extra_effect
# Effect of an extra word after the route of a padded target: returns
# (front shows the unpadded display, corner/edge stickers unchanged, state after, state before)
function extra_effect(w::Replay.Witness, t::Dict{String,Any}, extra)
    toks = vcat(parse_word(t["prelude"]), parse_word(t["word"]), parse_word(t["centerCorrection"]))
    s0 = Cube.replay(w.stk, toks); s1 = Cube.replay(s0, extra)
    nc = [i for i in eachindex(s0) if count(!iszero, s0[i].p) != 1]
    same = all(s0[i] == s1[i] for i in nc)
    cells = expected_cells(t["weekday"], t["day"], t["month"]; padded = false)
    fc = front_cells(s1, w.image)
    (same && all(fc[i][1] == cells[i] && fc[i][2] for i in 1:9), same, s1, s0)
end
end
