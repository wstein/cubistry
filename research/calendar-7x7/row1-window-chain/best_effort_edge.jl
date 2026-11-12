# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED producer helpers of the best-effort edge (window_chain.jl). Needs ../row1-window-print/common.jl (all_homes, bodykey,
# window_piece_options, coupled_optic, FRONT_NORMAL, IMAGE_UPS) and the rules of window_chain_lib.jl. The checkers verify the wrong cells
# (strict optics) and the Hall witness with their own code, but NOT that the wrong cell shows the digit 29: check.jl and verify_chain.jl accept any wrong
# cell with a valid Hall witness. The 29 rule is enforced by the producer only (re-check in window_chain.jl, tests).

"The front sticker (text, ink, up, ...) of cell (r,c) of a decoded state."
function front_sticker(state,cell)
    r,c=cell;ss=filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state)
    length(ss)==1 || error("cell $cell has $(length(ss)) front stickers")
    only(ss)
end

"Cells of the front whose sticker does not show the board (strict optics: text, ink and the angle of the up vector)."
function front_mismatches(state,board)
    bad=Tuple{Int,Int}[]
    for r in 1:7,c in 1:7
        s=front_sticker(state,(r,c));a=findfirst(==(s.up),IMAGE_UPS)
        (isnothing(a) || coupled_optic(s.text,a-1,s.ink)!=coupled_optic(board[r,c][1],0,board[r,c][2])) && push!(bad,(r,c))
    end
    bad
end

"Hall deficiency |X| - |N(X)| of a cell set X inside one body class: N(X) are the bodies of that class that can show some cell of X exactly under a rigid rotation."
function hall_deficiency(source,board,X)
    homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
    keys=unique(bodykey((c-4,4-r,3)) for (r,c) in X);length(keys)==1 || error("Hall set must lie in one body class")
    hs=[h for h in homes if bodykey(h)==only(keys)]
    nbr=[h for h in hs if any(!isempty(window_piece_options(byhome[h],h,(c-4,4-r,3),board[r,c])) for (r,c) in X)]
    length(X)-length(nbr)
end
