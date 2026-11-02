# Independent native Julia checker for the 2x2x2 r2c1 (0-9) counter.
# Vector model: every sticker carries (position, outward normal, up vector) and is rotated
# by face turns. Shares no code with ../search.
# Usage:
#   julia check.jl PRINT.tsv MODE ROUTES.tsv SETUP.tsv     (MODE = closed | wrap1)
const Vec = NTuple{3,Int}
fail(msg) = (println("invalid\t", msg); exit(1))
req(ok, msg) = ok || fail(msg)

function int(s)
    ok = !isempty(s) && all(c -> c in "0123456789-", s); req(ok, "bad integer: $s")
    n = tryparse(Int32, s); req(n !== nothing && string(n) == s, "bad integer: $s"); Int(n)
end
vecstr(v) = join(v, ",")
function vec3(s)
    p = split(s, ","); req(length(p) == 3, "vector needs 3 fields: $s")
    v = Tuple(int.(p)); req(all(x -> -1 <= x <= 1, v), "vector component out of range: $s"); v
end
dotp(a, b) = a[1]*b[1] + a[2]*b[2] + a[3]*b[3]
crossp(a, b) = (a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1])
isunit(v) = count(!=(0), v) == 1

struct Sticker
    pos::Vec
    nrm::Vec
    art::String
    up::Vec
end

function readprint(path)
    rows = readlines(path)
    req(!isempty(rows) && rows[1] == "sticker\tposition\tnormal\tartwork\tup", "print header")
    st = Sticker[]; seen = Set{Tuple{Vec,Vec}}()
    for (i, r) in enumerate(rows[2:end])
        f = split(r, "\t"); req(length(f) == 5, "print row fields")
        req(f[1] == string(i - 1), "sticker ids must be 0..23 in order")
        p = vec3(f[2]); n = vec3(f[3])
        req(all(x -> abs(x) == 1, p), "position must be a corner")
        req(isunit(n), "normal must be a unit axis")
        req(dotp(p, n) == 1, "normal must point outward from its corner")
        req(!((p, n) in seen), "facelet printed twice"); push!(seen, (p, n))
        art = String(f[4]); req(art == "blank" || art in string.(0:9), "artwork must be blank or 0-9")
        if art == "blank"
            req(f[5] == "-", "blank stickers carry no up vector")
            push!(st, Sticker(p, n, art, (0,0,0)))
        else
            u = vec3(f[5])
            req(isunit(u) && dotp(u, n) == 0, "up must be a unit axis tangent to the sticker")
            push!(st, Sticker(p, n, art, u))
        end
    end
    req(length(st) == 24, "print needs 24 stickers")
    return st
end

# clockwise quarter turn about outward axis a: v -> (v.a)a - a x v
cw(v, a) = (d = dotp(v, a); c = crossp(a, v); (d*a[1]-c[1], d*a[2]-c[2], d*a[3]-c[3]))
const FACE = Dict('R'=>(1,0,0), 'L'=>(-1,0,0), 'U'=>(0,1,0), 'D'=>(0,-1,0), 'F'=>(0,0,1), 'B'=>(0,0,-1))
const R2C1 = (-1, -1, 1)

function parsemove(m)
    req(1 <= length(m) <= 2 && haskey(FACE, m[1]), "bad move $m")
    q = length(m) == 1 ? 1 : m[2] == '2' ? 2 : m[2] == '\'' ? 3 : fail("bad move suffix $m")
    (FACE[m[1]], q, m)
end
parseword(w) = w == "" ? Tuple{Vec,Int,String}[] : [parsemove(String(m)) for m in split(w, " ")]
touches_r2c1(mv) = dotp(R2C1, mv[1]) > 0

function turn(state, mv)
    a, q, _ = mv
    map(state) do (p, n, u)
        if dotp(p, a) > 0
            for _ in 1:q; p = cw(p, a); n = cw(n, a); u = cw(u, a); end
        end
        (p, n, u)
    end
end
play(state, word) = foldl(turn, word; init = state)
invword(w) = join(reverse([length(m) == 1 ? m * "'" : m[2] == '\'' ? m[1:1] : m for m in split(w, " ")]), " ")

const CELLS = [(-1,1,1), (1,1,1), (-1,-1,1), (1,-1,1)]   # UL UR LL(r2c1) LR
const CELLNAME = ["UL", "UR", "LL", "LR"]
const Z = (0,0,1); const Y = (0,1,0)

required(v) = ["blank", "blank", string(v), "blank"]

function checkdisplay(print, state, v, ctx)
    need = required(v)
    for (k, c) in enumerate(CELLS)
        idx = findall(s -> s[1] == c && s[2] == Z, state); req(length(idx) == 1, "cell occupancy")
        s = idx[1]; got = print[s].art
        req(got == need[k], "$ctx: $(CELLNAME[k]) shows $(got) (sticker $(s-1)), display $v needs $(need[k])")
        need[k] == "blank" || req(state[s][3] == Y, "$ctx: $(CELLNAME[k]) sticker $(s-1) glyph $(got) not upright (up $(vecstr(state[s][3])))")
    end
end

function check_r2c1_untouched(print, state, v, ctx)
    idx = findall(s -> s[1] == R2C1 && s[2] == Z, state); req(length(idx) == 1, "cell occupancy")
    s = idx[1]; got = print[s].art
    req(got == string(v) && state[s][3] == Y, "$ctx: preparing move disturbed r2c1 digit $v")
end

const ROTS = [
    (ex, ey, crossp(ex, ey))
    for ex in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    for ey in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    if dotp(ex, ey) == 0
]
applyR(R, v) = (R[1] .* v[1] .+ R[2] .* v[2] .+ R[3] .* v[3])

function acceptable(art, p, n, u, c, need)
    art == need || return false
    need == "blank" && return true
    Rs = [R for R in ROTS if applyR(R, p) == c && applyR(R, n) == Z]
    req(length(Rs) == 1, "rotation uniqueness")
    applyR(Rs[1], u) == Y
end

function trackedbfs()
    start = Tuple((c, Z) for c in CELLS)
    dist = Dict(start => 0); fr = [start]
    moves = [(a, q, "") for a in values(FACE) for q in 1:3]
    while !isempty(fr)
        nx = typeof(start)[]
        for t in fr, (a, q, _) in moves
            s = map(t) do (p, n)
                if dotp(p, a) > 0; for _ in 1:q; p = cw(p, a); n = cw(n, a); end; end
                (p, n)
            end
            haskey(dist, s) || (dist[s] = dist[t] + 1; push!(nx, s))
        end
        fr = nx
    end
    dist
end

function shortest(dist, print, state, v)
    need = required(v)
    cands = [
        [(state[s][1], state[s][2]) for s in 1:24 if acceptable(print[s].art, state[s]..., CELLS[k], need[k])]
        for k in 1:4
    ]
    best = typemax(Int)
    for a in cands[1], b in cands[2], c in cands[3], d in cands[4]
        x = get(dist, (a, b, c, d), typemax(Int)); x < best && (best = x)
    end
    best
end

function main(args)
    length(args) == 4 || fail("usage: PRINT MODE ROUTES SETUP")
    print = readprint(args[1]); mode = args[2]; req(mode in ("closed", "wrap1", "constL-closed", "constL-wrap1", "9L1D-closed", "9L1D-wrap1", "2qtm-closed"), "mode")
    home = [(s.pos, s.nrm, s.up) for s in print]
    dist = trackedbfs(); req(length(dist) == 136080, "tracked graph size $(length(dist))")
    println("graph\ttracked-front-corners\t", length(dist), "\tdiameter\t", maximum(values(dist)))

    srows = readlines(args[4]); req(length(srows) == 2 && srows[1] == "mode\tsetup\thtm", "setup header")
    sf = split(srows[2], "\t"); req(length(sf) == 3 && sf[1] == mode, "setup mode")
    sw = parseword(String(sf[2])); req(int(sf[3]) == length(sw), "setup htm")
    state = play(home, sw); checkdisplay(print, state, 0, "setup")
    println("setup\t", mode, "\t", isempty(sf[2]) ? "(none)" : sf[2], "\t", length(sw))

    rows = readlines(args[3])
    req(!isempty(rows) && rows[1] == "mode\tstep\tfrom\tto\tincrement\tinc_htm\tinc_prep\tinc_touch\tinc_shortest\tdecrement\tdec_htm\tdec_prep\tdec_touch\tdec_shortest", "routes header")
    req(length(rows) == 11, "routes need 10 edges")

    start = state
    seen_states = Set{typeof(state)}()
    hist = zeros(Int, 16)
    total_htm = 0; total_prep = 0; worst = 0; incshort = 0; decshort = 0

    for i in 0:9
        push!(seen_states, state)
        f = split(rows[i+2], "\t"); req(length(f) == 14 && f[1] == mode && f[2] == string(i), "route row $i")
        v, w = i, (i + 1) % 10
        req(f[3] == string(v) && f[4] == string(w), "route row $i labels")
        inc = parseword(String(f[5])); dec = parseword(String(f[10]))
        req(int(f[6]) == length(inc) && int(f[11]) == length(dec), "row $i: claimed HTM differs from word length")
        req(String(f[10]) == invword(String(f[5])), "row $i: decrement is not the exact inverse word")

        # Check 1-touch + (0..2)-prep rule
        inc_t = count(touches_r2c1, inc); inc_p = length(inc) - inc_t
        dec_t = count(touches_r2c1, dec); dec_p = length(dec) - dec_t
        req(inc_t == 1, "row $i: increment must use exactly 1 move touching r2c1 (got $inc_t)")
        req(0 <= inc_p <= 2, "row $i: increment allows at most 2 preparing moves (got $inc_p)")
        req(int(f[7]) == inc_p && int(f[8]) == inc_t, "row $i: claimed inc_prep/inc_touch mismatch")
        req(int(f[12]) == dec_p && int(f[13]) == dec_t, "row $i: claimed dec_prep/dec_touch mismatch")

        # Check that all preparing moves in `inc` precede the single touching move
        req(touches_r2c1(inc[end]) && all(m -> !touches_r2c1(m), inc[1:end-1]), "row $i: preparing moves must precede the r2c1 touching move")
        if startswith(mode, "constL-")
            req(inc[end][3] == "L", "row $i: constant-L mode requires final touching move L (got $(inc[end][3]))")
        elseif startswith(mode, "9L1D-")
            want_t = i < 9 ? "L" : "D"
            req(inc[end][3] == want_t, "row $i: 9L1D mode requires final touching move $want_t (got $(inc[end][3]))")
        end

        # Verify r2c1 stays untouched during preparing moves
        cur = state
        for k in 1:(length(inc)-1)
            cur = turn(cur, inc[k])
            check_r2c1_untouched(print, cur, v, "row $i prep $k")
        end

        si = shortest(dist, print, state, w)
        req(si != typemax(Int), "row $i: target display $w is unreachable from the actual state")
        req(int(f[9]) == si, "row $i: claimed increment shortest $(f[9]) but exact distance is $si")
        req(length(inc) >= si, "row $i: impossible")

        next = play(state, inc)
        checkdisplay(print, next, w, "increment $v->$w")

        sd = shortest(dist, print, next, v)
        req(sd != typemax(Int), "row $i: target display $v is unreachable from the actual state")
        req(int(f[14]) == sd, "row $i: claimed decrement shortest $(f[14]) but exact distance is $sd")

        back = play(next, dec)
        req(back == state, "row $i: decrement does not restore the exact previous state")
        checkdisplay(print, back, v, "decrement $w->$v")

        h = length(inc); hist[h] += 1; total_htm += h; total_prep += inc_p
        h > worst && (worst = h)
        h == si && (incshort += 1); length(dec) == sd && (decshort += 1)
        println("edge\t", mode, "\t", v, "\t", w, "\t", f[5], "\t", h, "\t", inc_p, "\t", inc_t, "\t", si, "\t", sd)
        state = next
    end

    req(length(seen_states) == 10, "period states are not pairwise distinct")
    if mode in ("closed", "constL-closed", "9L1D-closed", "2qtm-closed")
        req(state == start, "cycle does not return to the exact full start state")
    end
    closure_tag = state == start ? "exact-closed" : "display-wrapped"
    hb = join(["$k:$(hist[k])" for k in 1:16 if hist[k] > 0], ",")
    println("summary\t", mode, "\tedges=10\tmax_htm=", worst, "\ttotal_htm=", total_htm,
            "\ttotal_prep=", total_prep, "\tmean_htm=", round(total_htm / 10, digits = 3),
            "\thist=", hb, "\tinc_shortest=", incshort, "/10\tdec_shortest=", decshort,
            "/10\tclosure=", closure_tag)
end

main(ARGS)

