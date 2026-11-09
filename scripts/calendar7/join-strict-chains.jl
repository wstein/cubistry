#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Join independently retained strict chains through the solved printing, using legal
# inverse words. The last window edge includes the bridge; no state is substituted.
# CUBISTRY_RULE=strict join-strict-chains.jl PURE_DIR WINDOW FULL ROOT_MOVES OUT
length(ARGS) == 5 || error("usage: join-strict-chains.jl PURE_DIR WINDOW FULL ROOT_MOVES OUT")
pure_dir, window_path, full_path, roots_path, output = ARGS
ENV["CUBISTRY_RULE"] = "strict"
include(joinpath(pure_dir, "pure_chain.jl"))
inv(word) = [(g, q == 2 ? 2 : -q) for (g, q) in reverse(word)]
# Normalize only adjacent equal generators, preserving the exact group element.
# Independent verify_moves.jl measures HTM after this normalization.
function normalize(word)
    result = Tuple{Int,Int}[]
    for (g, q) in word
        if !isempty(result) && result[end][1] == g
            q += pop!(result)[2]
        end
        q = mod(q, 4)
        q == 0 || push!(result, (g, q == 3 ? -1 : q))
    end
    result
end
function join_chains()
    window = read_chain(window_path)
    full = read_chain(full_path)
    @assert (window.year, window.month) == (2026, 5)
    @assert (window.edges[end].year, window.edges[end].month) == (full.year, full.month) == (2028, 1)
    @assert window.edges[end].end_hash != full.hash "independent retained roots"
    retained = reduce(vcat, (e.moves for e in window.edges))
    bridge = [inv(retained); inv(root_word(roots_path, window.root)); root_word(roots_path, full.root)]
    last = window.edges[end]
    word = normalize([last.moves; bridge])
    m = chain_metrics(word)
    seam = merge(last, (moves=word, htm=m[1], qtm=m[2], rot=m[3], rotq=m[4], end_hash=full.hash))
    edges = [window.edges[1:end-1]; [seam]; full.edges]
    @assert length(edges) == 883
    open(output, "w") do io
        println(io, "cubistry.calendar7.chain.v1")
        println(io, join(["source", window.root, window.year, window.month, window.hash], '\t'))
        for e in edges
            println(io, join(["edge", e.year, e.month, e.htm, e.qtm, e.rot, e.rotq, e.source_hash, e.end_hash], '\t'))
            for (g, q) in e.moves
                println(io, join(["move", g, q], '\t'))
            end
            println(io, "end")
        end
        println(io, "finish")
    end
    println("PASS edges=", length(edges), " raw_bridge_htm=", chain_metrics(bridge)[1], " seam_htm=", seam.htm,
        " total_htm=", sum(e.htm for e in edges))
end
join_chains()
