# Usage: julia verify_w.jl PADDED_WITNESS.json "W TOKENS"   (prints the report that flix/ reproduces byte for byte)
include(joinpath(@__DIR__, "load.jl"))
using SHA

const ROTATION_WORDS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x z", "x z'", "x z2",
                        "y' x'", "y' x2", "y' z2", "z x'", "z x2", "z y", "z y2", "z' x'"]
const SLICE_TOKENS = ["M", "M'", "M2", "E", "E'", "E2", "S", "S'", "S2"]

perm_parity(p) = (n = 0; for i in eachindex(p), j in i+1:length(p); p[i] > p[j] && (n += 1); end; n % 2)
# parity of the corner and edge cubie permutations produced by a word on the home print
function cubie_parities(w::Replay.Witness, toks)
    st = Cube.replay(w.stk, toks)
    out = Int[]
    for k in (3, 2)
        homes = sort(unique([s.p for s in w.stk if count(!iszero, s.p) == k]))
        ix = Dict(p => i for (i, p) in enumerate(homes)); perm = zeros(Int, length(homes))
        for i in eachindex(w.stk)
            count(!iszero, w.stk[i].p) == k || continue
            perm[ix[w.stk[i].p]] = ix[st[i].p]
        end
        push!(out, perm_parity(perm))
    end
    out
end

function main(path, wtext)
    w = load_witness(path); W = parse_word(wtext)
    io = IOBuffer()
    println(io, "PARITY corner/edge permutation parity of the 24 rotations (0 even, 1 odd)")
    ee = 0
    for r in ROTATION_WORDS
        c, e = cubie_parities(w, parse_word(r))
        println(io, "ROT ", r == "" ? "-" : r, " ", c, " ", e)
        ee += (c == 0 && e == 0 && r != "")
    end
    println(io, "ROT-EVEN-EVEN-NONIDENTITY ", ee)
    d1 = [t for t in w.targets if t["day"] < 10]
    routes = [vcat(parse_word(t["prelude"]), parse_word(t["word"]), parse_word(t["centerCorrection"])) for t in d1]
    states = [Cube.replay(w.stk, r) for r in routes]
    noncenter = [i for i in eachindex(w.stk) if count(!iszero, w.stk[i].p) != 1]
    function front_ok(s0, s1, t)
        all(s0[i] == s1[i] for i in noncenter) || return false
        c = expected_cells(t["weekday"], t["day"], t["month"]; padded = false)
        f = front_cells(s1, w.image)
        all(f[i][1] == c[i] && f[i][2] for i in 1:9)
    end
    # slice words of length 1..4 over M,E,S
    home = w.stk
    for L in 1:4
        total = 0; restored = 0; pure = 0
        words = Vector{Vector{String}}[]
        function rec(prefix)
            if length(prefix) == L
                total += 1
                s = Cube.replay(home, prefix)
                if all(s[i] == home[i] for i in noncenter)
                    restored += 1
                    s != home && (pure += 1; L == 4 && push!(words, [copy(prefix)]))
                end
                return
            end
            for t in SLICE_TOKENS; push!(prefix, t); rec(prefix); pop!(prefix); end
        end
        rec(String[])
        println(io, "SLICE length=$L words=$total cornersEdgesRestored=$restored pureCenterNontrivial=$pure")
        if L == 4
            lines = String[]
            for wl in words
                wd = wl[1]
                cnt = count(k -> front_ok(states[k], Cube.replay(states[k], wd), d1[k]), eachindex(d1))
                push!(lines, "SLICEWORD " * join(wd, " ") * " blankFront=$cnt/$(length(d1))")
            end
            foreach(l -> println(io, l), sort(lines))
        end
    end
    o, r, s = count_moves(W)
    nok = 0; dist = Dict{String,Int}()
    names = Dict((1,0,0)=>"R", (-1,0,0)=>"L", (0,1,0)=>"U", (0,-1,0)=>"D", (0,0,1)=>"F", (0,0,-1)=>"B")
    for k in eachindex(d1)
        s1 = Cube.replay(states[k], W)
        nok += front_ok(states[k], s1, d1[k])
        g = findfirst(i -> w.image[i] == "0", eachindex(s1))
        key = "$(names[s1[g].p]) up=$(s1[g].u)"; dist[key] = get(dist, key, 0) + 1
    end
    println(io, "WCHECK W=", join(W, " "), " outer=$o rotations=$r slices=$s targets=$(length(d1)) ok=$nok")
    for (k, v) in sort(collect(dist)); println(io, "GLYPH0 ", k, " ", v); end
    s = String(take!(io)); print(s); println("REPORT-SHA256 ", bytes2hex(sha256(s)))
    exit(nok == length(d1) ? 0 : 1)
end
main(ARGS[1], ARGS[2])
