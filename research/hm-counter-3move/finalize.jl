# Turn an annealed print into a closed-walk witness (TSV), candidate only.
# usage: julia finalize.jl <free|blank> <print.jls> <out.tsv> [letters]
include("solve.jl")
using Serialization, Random

const MAXLEN = Ref(0)
const GLYPHOUT(g) = g == ' ' ? "_" : string(g)
vtxt(v) = join(v, ",")

# text print: 24 tokens <glyph><cell>, sticker id order 3c+a; "_0" = blank
function readprinttxt(path)
    toks = split(strip(read(path, String)))
    length(toks) == 24 || error("24 tokens")
    Print([t[1] == '_' ? ' ' : t[1] for t in toks], [parse(Int, t[2:end]) for t in toks])
end

function homeup(sid, cell)
    c = (sid - 1) ÷ 3 + 1; a = (sid - 1) % 3 + 1
    n = zeros(Int, 3); n[a] = POS[c][a]
    for r in 1:NR
        if ROT[r]' * [0, 0, 1] == n && mulv(ROT[r], POS[c]) == CELLPOS[cell]
            return ROT[r]' * [0, 1, 0]
        end
    end
    error("no frame")
end

perfect(res) = maximum(res.radius) == 1 && res.chordradius <= 1
# blank profile: lexicographic (edges beyond radius 3, then total HTM)
quality(res) = (count(>(1), res.radius) + (res.chordradius > 1), only(values(res.layers[end])))

function main(profile, printfile, out; letters = "HM")
    blank = profile == "blank"
    pr = endswith(printfile, ".txt") ? readprinttxt(printfile) : deserialize(printfile)[2]
    sh = showtable(pr)
    b3 = makeball(3); b4 = makeball(4)
    c3 = makeclasses(b3); c4 = makeclasses(b4)
    balls = (b3, b4); cls = (c3, c4); works = (Work(c3.nwords), Work(c4.nwords))
    if blank
        b5 = makeball(5); c5 = makeclasses(b5)
        balls = (b3, b4, b5); cls = (c3, c4, c5); works = (works..., Work(c5.nwords))
        return mainblank(profile, pr, sh, balls, cls, works, out)
    end
    rng = MersenneTwister(11)
    chains = Dict{Char,Any}()
    # minute-like chains (M, optional S): 00..59 closed
    sM = nothing
    for _ in 1:400
        s = IDSTATE
        while true
            s = applymove(s, rand(rng, 1:18)); shows(s, sh, target('M', 0, blank)) && break
        end
        res = costchain(s, [target('M', v, blank) for v in 0:59], sh, balls, cls, works)
        if res !== nothing && perfect(res)
            sM = s; chains['M'] = (s, res); break
        end
    end
    sM === nothing && error("no closed radius-3 M chain found from sampled starts")
    # other letters: start states reached from sM by short setup words
    for L in letters
        L == 'M' && continue
        n = L == 'H' ? 24 : 60
        tg = [target(L, v, blank) for v in 0:n-1]
        found = false
        starts = [(i, applyelem(sM, E)) for (i, E) in enumerate(b4.elems) if shows(applyelem(sM, E), sh, tg[1])]
        for (i, s) in starts
            res = costchain(s, tg, sh, balls, cls, works; chord = L == 'H' ? 12 : nothing)
            if res !== nothing && perfect(res)
                chains[L] = (s, res, b4.words[i]); found = true; break
            end
        end
        tries = 0
        while !found && tries < 3000
            tries += 1
            w0 = rand(rng, 1:18, rand(rng, 1:4)); x = applyword(sM, w0)
            for (j, E) in enumerate(b4.elems)
                s = applyelem(x, E)
                shows(s, sh, tg[1]) || continue
                res = costchain(s, tg, sh, balls, cls, works; chord = L == 'H' ? 12 : nothing)
                if res !== nothing && perfect(res)
                    chains[L] = (s, res, vcat(w0, b4.words[j])); found = true; break
                end
            end
        end
        found || println("WARNING: no closed radius-3 chain for $L")
        found || return nothing
    end
    writewitness(profile, blank, letters, pr, sh, sM, chains, balls, out)
end

# rebase: the reference print state is sM, so the M setup is empty
function writewitness(profile, blank, letters, pr, sh, sM, chains, balls, out)
    bmax = balls[end]
    io = IOBuffer()
    println(io, "cubistry.hm-counter.v1")
    println(io, "profile\t", profile)
    println(io, "letters\t", letters)
    for sid in 1:24
        c = (sid - 1) ÷ 3 + 1; a = (sid - 1) % 3 + 1
        R = ROT[sM[c]]
        n = zeros(Int, 3); n[a] = POS[c][a]
        uh = pr.glyph[sid] == ' ' ? (a == 1 ? [0, 1, 0] : [1, 0, 0]) : homeup(sid, pr.cell[sid])
        println(io, "sticker\t", sid - 1, "\t", c - 1, "\t", vtxt(R * collect(POS[c])), "\t",
                vtxt(R * n), "\t", vtxt(R * uh), "\t", GLYPHOUT(pr.glyph[sid]))
    end
    wtxt(w) = isempty(w) ? "-" : join(MOVENAMES[w], " ")
    for L in sort(collect(letters), rev = true)
        n = L == 'H' ? 24 : 60
        tg = [target(L, v, blank) for v in 0:n-1]
        ch = chains[L]
        s, res = ch[1], ch[2]
        println(io, "setup\t", L, "\t", L == 'M' ? "-" : wtxt(ch[3]))
        words = backtrack(res, tg, sh, balls)
        st = s
        for v in 0:n-1
            nv = (v + 1) % n
            lb = lowerbound(st, tg[nv+1], sh, bmax)
            println(io, "edge\t", L, "\t", v, "\t", nv, "\t", wtxt(words[v+1]), "\t", lb)
            MAXLEN[] = max(MAXLEN[], length(words[v+1]))
            st = applyword(st, words[v+1])
            if L == 'H' && v + 1 == 11
                # reset 11 -> 00 to the exact H00 start
                rw = nothing
                for w in bmax.words
                    applyword(st, w) == s && (rw = w; break)
                end
                rw === nothing && error("reset")
                global RESET = (wtxt(rw), lowerbound(st, tg[1], sh, bmax))
            end
        end
        st == s || error("closure")
        L == 'H' && (MAXLEN[] = max(MAXLEN[], count(==(' '), RESET[1]) + 1))
        L == 'H' && println(io, "reset\tH\t11\t0\t", RESET[1], "\t", RESET[2])
    end
    println(io, "claim\tmaxEdgeHTM\t", MAXLEN[])
    println(io, "end")
    write(out, take!(io))
    println("wrote $out")
end

# blank profile: keep the best start found (lexicographic quality)
function mainblank(profile, pr, sh, balls, cls, works, out)
    rng = MersenneTwister(11)
    tm = [target('M', v, true) for v in 0:59]
    best = nothing
    for t in 1:parse(Int, get(ENV, "HM_STARTS", "12"))
        s = IDSTATE
        while true
            s = applymove(s, rand(rng, 1:18)); shows(s, sh, tm[1]) && break
        end
        res = costchain(s, tm, sh, balls, cls, works)
        res === nothing && continue
        q = quality(res)
        println("M start $t quality $q"); flush(stdout)
        (best === nothing || q < best[1]) && (best = (q, s, res))
    end
    sM = best[2]
    chains = Dict{Char,Any}('M' => (sM, best[3]))
    th = [target('H', v, true) for v in 0:23]
    b4 = balls[2]
    hbest = nothing
    for (i, E) in enumerate(b4.elems)
        s = applyelem(sM, E)
        shows(s, sh, th[1]) || continue
        res = costchain(s, th, sh, balls, cls, works; chord = 12)
        res === nothing && continue
        q = (quality(res)..., b4.len[i])
        (hbest === nothing || q < hbest[1]) && (hbest = (q, s, res, b4.words[i]))
    end
    println("H quality ", hbest[1])
    chains['H'] = (hbest[2], hbest[3], hbest[4])
    writewitness(profile, true, "HM", pr, sh, sM, chains, balls, out)
end

main(ARGS[1], ARGS[2], ARGS[3]; letters = length(ARGS) >= 4 ? ARGS[4] : "HM")
