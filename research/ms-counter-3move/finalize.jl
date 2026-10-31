# Witness producer (generator side only; the checkers are the proof
# authority). usage: julia finalize.jl POOL18 OUT.tsv [K]
# POOL18 = 18 pool labels ('a'..'f' tens 0..5, '0'..'9' units, ' ' blank).
include("vi.jl")

const B4FULL = makeball(4)
const B5FULL = makeball(5)

function lowerbound_gen(s::State, sh, need::Target)
    best = 99
    for (E, l) in zip(B5FULL.elems, B5FULL.len)
        l >= best && continue
        shows(applyelem(s, E), sh, need) && (best = l)
    end
    best
end

# twist about a cubie's own home diagonal mapping home axis a to home axis b
function owntwist(c, a, b)
    for r in 1:NR
        PIDX[c, r] == PIDX[c, 1] || continue
        r == 1 && continue
        n = zeros(Int, 3); n[a] = POS[c][a]
        m = ROT[r] * n
        m[b] != 0 && return r
    end
    error("no twist")
end

function wordfor(D::State)
    F = Dict{UInt64,Int}()
    for (i, E) in enumerate(B5FULL.elems)
        F[key(E)] = i
    end
    best = nothing
    for (j, E) in enumerate(B5FULL.elems)
        w = B5FULL.words[j]
        inv = reverse([invmove(m) for m in w])
        A = applyword(D, inv)
        i = get(F, key(A), 0)
        if i > 0
            cand = vcat(B5FULL.words[i], w)
            (best === nothing || length(cand) < length(best)) && (best = cand)
        end
    end
    best === nothing && error("no word within 10")
    @assert applyword(IDSTATE, best) == D
    best
end

vecs(v) = join(string.(Int.(v)), ",")

function stickerrows(lab, s::State)
    pr = mkprint(lab)
    rows = String[]
    for c in 1:8, a in 1:3
        sid = 3 * (c - 1) + a
        n0 = zeros(Int, 3); n0[a] = POS[c][a]
        g = pr.glyph[sid]; k = g == ' ' ? 1 : pr.cell[sid]
        # rotation that puts this sticker facing front at cell k
        rk = findfirst(r -> PIDX[c, r] == CELLIDX[k] && ROT[r] * n0 == [0, 0, 1], 1:NR)
        u0 = ROT[rk]' * [0, 1, 0]
        R = ROT[s[c]]
        p = R * collect(POS[c]); n = R * n0; u = R * u0
        gl = g == ' ' ? '_' : g == 'X' ? 'H' : g   # X = printed H (never shown)
        push!(rows, "sticker\t$(sid-1)\t$(c-1)\t$(vecs(p))\t$(vecs(n))\t$(vecs(u))\t$gl")
    end
    rows
end
wtext(w) = isempty(w) ? "-" : join(MOVENAMES[w], " ")

function finalize(pool::Vector{Char}, out; K = 30)
    lab = poollab(pool)
    sh = showtable(mkprint(lab))
    G = buildlayered(sh, 'M')
    f, mins, back = valueiter(G, K)
    println("mins diffs ", diff(mins))
    path, runin, period = extractperiod(G, f, back, K)
    period > 0 || error("no period found")
    println("run-in cycles $runin, period cycles $period")
    seg = path[60runin+1:60(runin+period)+1]
    states = State[]; words = Vector{Vector{Int}}()
    for i in 1:60period
        li = mod(i - 1, 60) + 1
        a = seg[i]; b = seg[i+1]
        w, e = arcof(G, li, a, b)
        push!(words, PB4.words[e])
    end
    s0 = unkey(G.layers[1][seg[1]])
    # S run start: letter corner turned to show S (home x to front), blank
    # corner counter-twisted so the state stays legal.
    tUR = owntwist(URC, 1, 3)
    s1 = nothing
    for tw in 2:NR
        PIDX[ULC, tw] == PIDX[ULC, 1] || continue
        cand = ntuple(c -> c == URC ? UInt8(COMP[s0[c], tUR]) : c == ULC ? UInt8(COMP[s0[c], tw]) : s0[c], 8)
        twsum(cand) == 0 && (s1 = cand)
    end
    D = ntuple(c -> begin
            q = c  # positions of UL/UR are their home cubies' positions
            c == URC ? UInt8(COMP[s1[URC], INV[s0[URC]]]) :
            c == ULC ? UInt8(COMP[s1[ULC], INV[s0[ULC]]]) : UInt8(1)
        end, 8)
    sw = wordfor(D)
    @assert applyword(s0, sw) == s1
    println("S setup ", wtext(sw), " (", length(sw), " HTM)")
    lines = ["cubistry.ms-counter.v1", "profile\tblank", "letters\tMS"]
    append!(lines, stickerrows(lab, s0))
    lens = Int[]
    for (L, st, setup) in (('M', s0, Int[]), ('S', s1, sw))
        push!(lines, "run\t$L\tsetup\t$(wtext(setup))\tperiod\t$period")
        tg = targets(L)
        s = st
        for i in 0:60period-1
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
    finalize(collect(ARGS[1]), ARGS[2]; K = length(ARGS) >= 3 ? parse(Int, ARGS[3]) : 30)
end
