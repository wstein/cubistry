# Writes raw print + route + setup files for the checkers from a search result.
include(joinpath(@__DIR__, "route.jl"))
const CELLV = Dict(M.F_LL => (-1,-1,1), M.F_LR => (1,-1,1))
vs(v) = join(v, ",")
artname(l) = l == BLANK ? "blank" : string(l <= 10 ? l - 1 : l - 11)
# print re-expressed so that state `home` (engine frame) becomes the printed solved state
function rebase(lab, home)
    loc = M.locs(home); nl = fill(-1, 24)
    for s in 0:23; nl[loc[s+1]+1] = lab[s+1]; end; nl
end
function writeprint(path, lab)
    open(path, "w") do io
        println(io, "sticker\tposition\tnormal\tartwork\tup")
        for f in 0:23
            p, n = M.facelet(f); l = lab[f+1]
            up = l == BLANK ? "-" : vs(M.upfor(f, l <= 10 ? (-1,-1,1) : (1,-1,1)))
            println(io, f, "\t", vs(p), "\t", vs(n), "\t", artname(l), "\t", up)
        end
    end
end
invw(w) = join(reverse([length(m) == 1 ? m * "'" : m[2] == '\'' ? m[1:1] : m for m in split(w, " ")]), " ")
function shortestto(W, lab, st, v, mode)
    loc = M.locs(st); bl, ll, lr = cands(lab, loc, v, :B, mode); best = 99
    for a in ll, b in lr, x in bl, y in bl
        ws = get(W.byB, keyB(x, y, a, b), nothing); ws === nothing && continue
        best = min(best, minimum(W.len[ws]))
    end
    best
end
lbl(v, mode) = mode == :nz && v < 10 ? "_$v" : lpad(string(v), 2, '0')
# words: route word indices; g0: start state, both in the frame of `lab`
function writeroutes(path, W, lab, g0, words, mode)
    st = g0
    open(path, "w") do io
        println(io, "mode\tstep\tfrom\tto\tincrement\tinc_htm\tinc_shortest\tdecrement\tdec_htm\tdec_shortest")
        for i in 0:99
            w = (i + 1) % 100; wi = words[i+1]
            si = shortestto(W, lab, st, w, mode); nx = applyw(st, W.perms[wi]); sd = shortestto(W, lab, nx, i, mode)
            println(io, join([string(mode), i, lbl(i, mode), lbl(w, mode), W.word[wi], W.len[wi], si, invw(W.word[wi]), W.len[wi], sd], "\t"))
            st = nx
        end
    end
    @assert st == g0
end
writesetup(path, mode, word) = open(path, "w") do io
    println(io, "mode\tsetup\thtm"); println(io, mode, "\t", word, "\t", word == "" ? 0 : length(split(word)))
end
# meet-in-the-middle word from state a to state b (radius 5 + 5)
function connect(W, a, b)
    a == b && return ""
    fa = Dict{UInt64,Int}(); for (i, w) in enumerate(W.perms); s = applyw(a, w); haskey(fa, s) || (fa[s] = i); end
    best = nothing
    for (j, w) in enumerate(W.perms)
        s = applyw(b, w)
        if haskey(fa, s)
            i = fa[s]; L = W.len[i] + W.len[j]
            (best === nothing || L < best[1]) && (best = (L, i, j))
        end
    end
    best === nothing && return nothing
    strip(W.word[best[2]] * " " * (W.word[best[3]] == "" ? "" : invw(W.word[best[3]])))
end
