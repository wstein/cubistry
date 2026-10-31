# Witness producer for unrestricted (full-model) prints (generator side only).
# usage: julia finalize-full.jl PRINT24 OUT.tsv [K]
include("finalize.jl")
include("fullvi.jl")

function periodwalk(G, ball, K)
    f, mins, back = valueiter(G, K)
    path, runin, period = extractperiod(G, f, back, K)
    period > 0 || error("no period found")
    seg = path[60runin+1:60(runin+period)+1]
    words = [ball.words[arcof(G, mod(i - 1, 60) + 1, seg[i], seg[i+1])[2]] for i in 1:60period]
    states = [unkey(G.layers[mod(i - 1, 60) + 1][seg[i]]) for i in 1:60period]
    println("diffs ", unique(diff(mins)), " run-in $runin period $period")
    states, words, period
end

# shortest word (<= 10) from a to b by meet in the middle on radius-5 balls
function connect(a::State, b::State, F)
    best = nothing
    for (j, w) in enumerate(B5FULL.words)
        inv = reverse([invmove(m) for m in w])
        x = applyword(b, inv)          # x = state that reaches b by w
        # need word u with applyword(a, u) == x: search u in ball via F keyed on a
        i = get(F, key(x), 0)
        if i > 0
            cand = vcat(B5FULL.words[i], w)
            (best === nothing || length(cand) < length(best)) && (best = cand)
        end
    end
    best
end

function finalizefull(lab::Vector{Char}, out; K = 30)
    sh = showtable(mkprint(lab))
    Ms, Mw, Mp = periodwalk(buildfull(sh, 'M'), FB4, K)
    Ss, Sw, Sp = periodwalk(buildfull(sh, 'S'), FB4, K)
    s0 = Ms[1]
    F = Dict{UInt64,Int}()
    for (i, w) in enumerate(B5FULL.words)
        F[key(applyword(s0, w))] = i
    end
    # rotate the S period so that its start (an S00 state) is reachable
    best = nothing
    for r in 0:Sp-1
        st = Ss[60r+1]
        w = connect(s0, st, F)
        w === nothing && continue
        (best === nothing || length(w) < length(best[2])) && (best = (r, w))
    end
    best === nothing && error("no S00 period state within 10 HTM of M00")
    r, sw = best
    Sw = vcat(Sw[60r+1:end], Sw[1:60r]); s1 = Ss[60r+1]
    @assert applyword(s0, sw) == s1
    println("S setup ", wtext(sw), " (", length(sw), " HTM)")
    lines = ["cubistry.ms-counter.v1", "profile\tblank", "letters\tMS"]
    append!(lines, stickerrows(lab, s0))
    lens = Int[]
    for (L, st, setup, words, p) in (('M', s0, Int[], Mw, Mp), ('S', s1, sw, Sw, Sp))
        push!(lines, "run\t$L\tsetup\t$(wtext(setup))\tperiod\t$p")
        tg = targets(L); s = st
        for i in 0:60p-1
            v = i % 60; nv = (v + 1) % 60
            lb = lowerbound_gen(s, sh, tg[nv+1])
            push!(lines, "edge\t$L\t$i\t$v\t$nv\t$(wtext(words[i+1]))\t$lb")
            s = applyword(s, words[i+1])
            shows(s, sh, tg[nv+1]) || error("generator replay failed at $L $i")
            push!(lens, length(words[i+1]))
        end
        s == st || error("generator closure failed for $L")
    end
    push!(lines, "claim\tmaxEdgeHTM\t$(maximum(lens))")
    push!(lines, "end")
    open(out, "w") do io
        write(io, join(lines, "\n") * "\n")
    end
    println("max ", maximum(lens), " hist ", [count(==(d), lens) for d in 1:4], " total ", sum(lens))
end

if abspath(PROGRAM_FILE) == @__FILE__
    lab = length(ARGS[1]) == 18 ? poollab(collect(ARGS[1])) : collect(ARGS[1])
    finalizefull(lab, ARGS[2]; K = length(ARGS) >= 3 ? parse(Int, ARGS[3]) : 30)
end
