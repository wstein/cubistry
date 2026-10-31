# Independent native Julia checker for the blank-top 00-99 counter print.
# Vector model: every sticker carries (position, outward normal, up vector) and is rotated
# by face turns. Shares no code with ../search. Usage:
#   julia check.jl PRINT.tsv MODE ROUTES.tsv SETUP.tsv     (MODE = lz | nz)
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
struct Sticker; pos::Vec; nrm::Vec; art::String; up::Vec; end   # up = (0,0,0) for blank
function readprint(path)
    rows = readlines(path)
    req(rows[1] == "sticker\tposition\tnormal\tartwork\tup", "print header")
    st = Sticker[]; seen = Set{Tuple{Vec,Vec}}()
    for (i, r) in enumerate(rows[2:end])
        f = split(r, "\t"); req(length(f) == 5, "print row fields")
        req(f[1] == string(i - 1), "sticker ids must be 0..23 in order")
        p = vec3(f[2]); n = vec3(f[3])
        req(all(x -> abs(x) == 1, p), "position must be a corner"); req(isunit(n), "normal must be a unit axis")
        req(dotp(p, n) == 1, "normal must point outward from its corner")
        req(!((p, n) in seen), "facelet printed twice"); push!(seen, (p, n))
        art = String(f[4]); req(art == "blank" || art in string.(0:9), "artwork must be blank or 0-9")
        if art == "blank"
            req(f[5] == "-", "blank stickers carry no up vector"); push!(st, Sticker(p, n, art, (0,0,0)))
        else
            u = vec3(f[5]); req(isunit(u) && dotp(u, n) == 0, "up must be a unit axis tangent to the sticker")
            push!(st, Sticker(p, n, art, u))
        end
    end
    req(length(st) == 24, "print needs 24 stickers"); st
end
# clockwise quarter turn about outward axis a: v -> (v.a)a - a x v
cw(v, a) = (d = dotp(v, a); c = crossp(a, v); (d*a[1]-c[1], d*a[2]-c[2], d*a[3]-c[3]))
const FACE = Dict('R'=>(1,0,0), 'L'=>(-1,0,0), 'U'=>(0,1,0), 'D'=>(0,-1,0), 'F'=>(0,0,1), 'B'=>(0,0,-1))
function parsemove(m)
    req(1 <= length(m) <= 2 && haskey(FACE, m[1]), "bad move $m")
    q = length(m) == 1 ? 1 : m[2] == '2' ? 2 : m[2] == '\'' ? 3 : fail("bad move suffix $m")
    (FACE[m[1]], q, m)
end
parseword(w) = w == "" ? Tuple{Vec,Int,String}[] : [parsemove(String(m)) for m in split(w, " ")]
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
const CELLS = [(-1,1,1), (1,1,1), (-1,-1,1), (1,-1,1)]   # UL UR LL LR
const CELLNAME = ["UL", "UR", "LL", "LR"]
const Z = (0,0,1); const Y = (0,1,0)
# required artwork per cell for value v in mode
function required(v, mode)
    t, u = divrem(v, 10)
    ["blank", "blank", (mode == "nz" && t == 0) ? "blank" : string(t), string(u)]
end
label(v, mode) = mode == "nz" && v < 10 ? "_" * string(v) : lpad(string(v), 2, '0')
function checkdisplay(print, state, v, mode, ctx)
    need = required(v, mode)
    for (k, c) in enumerate(CELLS)
        idx = findall(s -> s[1] == c && s[2] == Z, state); req(length(idx) == 1, "cell occupancy")
        s = idx[1]; got = print[s].art
        req(got == need[k], "$ctx: $(CELLNAME[k]) shows $(got) (sticker $(s-1)), display $(label(v, mode)) needs $(need[k])")
        need[k] == "blank" || req(state[s][3] == Y, "$ctx: $(CELLNAME[k]) sticker $(s-1) glyph $(got) not upright (up $(vecstr(state[s][3])))")
    end
end
# all 24 proper rotations as images of x,y,z
const ROTS = [(ex, ey, crossp(ex, ey)) for ex in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
              for ey in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)] if dotp(ex, ey) == 0]
applyR(R, v) = (R[1] .* v[1] .+ R[2] .* v[2] .+ R[3] .* v[3])
# would sticker (currently p,n,u) show `need` correctly if brought to cell c facing front?
function acceptable(art, p, n, u, c, need)
    art == need || return false
    need == "blank" && return true
    Rs = [R for R in ROTS if applyR(R, p) == c && applyR(R, n) == Z]
    req(length(Rs) == 1, "rotation uniqueness"); applyR(Rs[1], u) == Y
end
# tracked graph: images of the four front facelets under words, BFS distance from identity
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
# exact HTM distance from full state to the nearest state showing value v
function shortest(dist, print, state, v, mode)
    need = required(v, mode)
    cands = [[(state[s][1], state[s][2]) for s in 1:24 if acceptable(print[s].art, state[s]..., CELLS[k], need[k])] for k in 1:4]
    best = typemax(Int)
    for a in cands[1], b in cands[2], c in cands[3], d in cands[4]
        x = get(dist, (a, b, c, d), typemax(Int)); x < best && (best = x)
    end
    best
end
function main(args)
    length(args) == 4 || fail("usage: PRINT MODE ROUTES SETUP")
    print = readprint(args[1]); mode = args[2]; req(mode in ("lz", "nz"), "mode")
    home = [(s.pos, s.nrm, s.up) for s in print]
    dist = trackedbfs(); req(length(dist) == 136080, "tracked graph size $(length(dist))")
    println("graph\ttracked-front-corners\t", length(dist), "\tdiameter\t", maximum(values(dist)))
    srows = readlines(args[4]); req(srows[1] == "mode\tsetup\thtm" && length(srows) == 2, "setup header")
    sf = split(srows[2], "\t"); req(length(sf) == 3 && sf[1] == mode, "setup mode")
    sw = parseword(String(sf[2])); req(int(sf[3]) == length(sw), "setup htm")
    state = play(home, sw); checkdisplay(print, state, 0, mode, "setup")
    println("setup\t", mode, "\t", isempty(sf[2]) ? "(none)" : sf[2], "\t", length(sw))
    rows = readlines(args[3])
    req(rows[1] == "mode\tstep\tfrom\tto\tincrement\tinc_htm\tinc_shortest\tdecrement\tdec_htm\tdec_shortest", "routes header")
    req(length(rows) == 101, "routes need 100 edges")
    start = state; hist = zeros(Int, 16); total = 0; worst = 0; incshort = 0; decshort = 0
    for i in 0:99
        f = split(rows[i+2], "\t"); req(length(f) == 10 && f[1] == mode && f[2] == string(i), "route row $i")
        v, w = i, (i + 1) % 100
        req(f[3] == label(v, mode) && f[4] == label(w, mode), "route row $i labels")
        inc = parseword(String(f[5])); dec = parseword(String(f[8]))
        req(int(f[6]) == length(inc) && int(f[9]) == length(dec), "row $i: claimed HTM differs from word length")
        req(String(f[8]) == invword(String(f[5])), "row $i: decrement is not the exact inverse word")
        si = shortest(dist, print, state, w, mode)
        req(si != typemax(Int), "row $i: target display $(label(w, mode)) is unreachable from the actual state")
        req(int(f[7]) == si, "row $i: claimed increment shortest $(f[7]) but exact distance is $si")
        req(length(inc) >= si, "row $i: impossible")
        next = play(state, inc); checkdisplay(print, next, w, mode, "increment $(label(v, mode))->$(label(w, mode))")
        sd = shortest(dist, print, next, v, mode)
        req(sd != typemax(Int), "row $i: target display $(label(v, mode)) is unreachable from the actual state")
        req(int(f[10]) == sd, "row $i: claimed decrement shortest $(f[10]) but exact distance is $sd")
        back = play(next, dec); req(back == state, "row $i: decrement does not restore the exact previous state")
        checkdisplay(print, back, v, mode, "decrement $(label(w, mode))->$(label(v, mode))")
        h = length(inc); hist[h+1] += 1; total += h; worst = max(worst, h)
        incshort += (h == si); decshort += (h == sd)
        println("edge\t", mode, "\t", label(v, mode), "\t", label(w, mode), "\t", f[5], "\t", h, "\t", si, "\t", sd)
        state = next
    end
    req(state == start, "cycle does not return to the exact full start state")
    println("histogram\t", mode, "\t", join(["$(k-1):$(hist[k])" for k in 1:16 if hist[k] > 0], ","))
    println("summary\t", mode, "\tedges\t100\tmax\t", worst, "\ttotal\t", total, "\tinc_shortest\t", incshort, "\tdec_shortest\t", decshort)
    println("status\tVALID\t", mode, "\tMAX_HTM_", worst)
end
main(ARGS)
