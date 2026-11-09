#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Export strict calendar root geometry and the 91 display sheets with pinned research
# code. No proof logic is reimplemented here. Run with CUBISTRY_RULE=strict:
# export-julia.jl PURE_DIR DAG CHAIN PRINT ROOT_MOVES OUT_DIR
length(ARGS) == 6 || error("usage: export-julia.jl PURE_DIR DAG CHAIN PRINT ROOT_MOVES OUT_DIR")
pure_dir, dag_path, chain_path, print_path, roots_path, out_dir = ARGS
ENV["CUBISTRY_RULE"] = "strict"
include(joinpath(pure_dir, "pure_chain.jl"))

function export_root(printing, out_dir)
    input = read_chain(chain_path)
    proof = replay_dag(dag_path; require_full=false)
    @assert bytes2hex(sha256(read(print_path))) == STRICT_PRINT_SHA "strict print pin"
    p = UInt16.(1:length(proof.action.generators[1]))
    for (g, q) in root_word(roots_path, input.root), _ in 1:mod(q, 4)
        p = compose(p, UInt16.(proof.action.generators[g]))
    end
    state = decode_physical(printing, p, proof.action)
    @assert front_failure(state, stacked_board(input.year, input.month, PURE_VARIANT), "strict") == OK_FRONT "root front"
    @assert state_digest(state) == input.hash "root digest"
    io = IOBuffer()
    for s in state
        println(io, join([s.id, s.piece, join(s.pos, ','), join(s.normal, ','), join(s.up, ','), s.text, s.ink], '\t'))
    end
    bytes = take!(io)
    @assert bytes2hex(sha256(bytes)) == input.hash "root snapshot preimage"
    write(joinpath(out_dir, "root-state.tsv"), bytes)
end

function export_displays(out_dir)
    goals = stacked_goals(PURE_VARIANT)
    old = physical_targets("EN")
    index = Dict(join(string.(t.board), "|") => i for (i, t) in enumerate(old))
    io = IOBuffer()
    println(io, "cubistry.calendar7.displays.v1")
    for (id, g) in enumerate(goals)
        cells = [string(g.board[r, c][2], ':', g.board[r, c][1]) for r in 1:7 for c in 1:7]
        println(io, join(["display"; id; g.year; g.month; cells], '\t'))
    end
    for y in 2026:2099, m in 1:12
        id = index[join(string.(wrapped_board(y, m)), "|")]
        @assert stacked_board(y, m, PURE_VARIANT) == goals[id].board "month display"
        println(io, join(["month", y, m, id], '\t'))
    end
    write(joinpath(out_dir, "displays.tsv"), take!(io))
end

mkpath(out_dir)
export_root(read_physical(print_path), out_dir)
export_displays(out_dir)
println("PASS strict root and 888 month exports")
