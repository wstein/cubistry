#!/usr/bin/env julia
# Export the two facts of the English 7x7 calendar data that only the research code can
# produce, with the research code itself (no reimplementation):
#   root-state.tsv  the 294-sticker pose snapshot of the chain root, byte-identical to the
#                   preimage of the SHA-256 state digest (so sha256(file) is the chain's
#                   source hash)
#   displays.tsv    the 91 display sheets (7x7 cells) and the display id of each of the 888
#                   months 2026-2099, from the research display generator
#
#   julia --startup-file=no scripts/calendar7/export-julia.jl PURE_DIR DAG CHAIN OUT_DIR
#     PURE_DIR  research/calendar-7x7/pure-split-states of the pinned research commit
#     DAG       evidence/dag-all.tsv unpacked from evidence/dag-all.tsv.gz
#     CHAIN     the committed cumulative chain (chain-2028-2076.moves.tsv)
#     OUT_DIR   receives root-state.tsv and displays.tsv
#
# Research candidate, not certified. Proof-relevant logic stays in the research files that
# are included below; this script only calls them and writes their results.
length(ARGS) == 4 || error("usage: export-julia.jl PURE_DIR DAG CHAIN OUT_DIR")
pure_dir, dag_path, chain_path, out_dir = ARGS
include(joinpath(pure_dir, "pure_chain.jl"))

function export_root(printing, dag_path, chain_path, out_dir)
    input = read_chain(chain_path)
    proof = replay_dag(dag_path; require_full=false)
    p = signed_perm(proof.registers, proof.targets[input.root])
    state = decode_physical(printing, p, proof.action)
    @assert front_failure(state, stacked_board(input.year, input.month, PURE_VARIANT), "strict") == OK_FRONT "root front"
    @assert state_digest(state) == input.hash "root digest differs from the chain source hash"
    io = IOBuffer()
    for s in state
        println(io, join([s.id, s.piece, join(s.pos, ','), join(s.normal, ','), join(s.up, ','), s.text, s.ink], '\t'))
    end
    bytes = take!(io)
    @assert bytes2hex(sha256(bytes)) == input.hash "root-state.tsv must hash to the chain source hash"
    write(joinpath(out_dir, "root-state.tsv"), bytes)
    (input.root, input.year, input.month, input.hash)
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
        @assert stacked_board(y, m, PURE_VARIANT) == goals[id].board "month display differs from its type"
        println(io, join(["month", y, m, id], '\t'))
    end
    write(joinpath(out_dir, "displays.tsv"), take!(io))
end

mkpath(out_dir)
printing = read_physical(joinpath(pure_dir, "evidence", "print-pure-A.tsv"))
root = export_root(printing, dag_path, chain_path, out_dir)
export_displays(out_dir)
println("PASS root=", root[1], " ", root[2], "-", root[3], " digest=", root[4])
