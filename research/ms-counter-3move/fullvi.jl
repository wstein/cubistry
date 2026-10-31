# Full-model layered graph (no pool restriction): all states showing each
# display, arcs from the unrestricted radius-4 ball. Generator side only;
# used to check whether lifting the pool restriction helps a given print.
include("vi.jl")
const FB4 = makeball(4)
const FC4 = makeclasses(FB4)
const FW4 = Work(FC4.nwords)

function buildfull(sh, L)
    tg = targets(L)
    layers = [allshowing(sh, tg[i]) for i in 1:60]
    adj = Vector{Vector{Vector{Tuple{Int32,Int32,Int32}}}}(undef, 60)
    for i in 1:60
        nxtL = layers[mod(i, 60)+1]; need = tg[mod(i, 60)+1]
        A = Vector{Vector{Tuple{Int32,Int32,Int32}}}(undef, length(layers[i]))
        for (a, k) in enumerate(layers[i])
            s = unkey(k)
            best = Dict{Int,Tuple{Int,Int}}()
            foreachhit(s, sh, need, FC4, FW4) do e
                e == 1 && return
                w = w4(FB4.len[e])
                kt = key(applyelem(s, FB4.elems[e]))
                b = searchsortedfirst(nxtL, kt)
                (b <= length(nxtL) && nxtL[b] == kt) || return
                (haskey(best, b) && best[b][1] <= w) || (best[b] = (w, e))
            end
            A[a] = [(Int32(b), Int32(w), Int32(e)) for (b, (w, e)) in best]
        end
        adj[i] = A
    end
    Layered(layers, adj)
end

if abspath(PROGRAM_FILE) == @__FILE__
    lab = length(ARGS[1]) == 18 ? poollab(collect(ARGS[1])) : collect(ARGS[1])
    sh = showtable(mkprint(lab))
    for L in "MS"
        t = @elapsed G = buildfull(sh, L)
        f, mins, _ = valueiter(G, 12)
        println("$L build $(round(t,digits=1))s |layer|=$(length(G.layers[1])) per-cycle weight ", (mins[end] - mins[end-4]) ÷ 4)
    end
end
