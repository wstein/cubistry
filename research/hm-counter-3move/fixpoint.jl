# Exact max-3 decision for a fixed print and mode (generator-side tool; its
# verdicts are reported as generator results unless a witness is checked).
#
# U = every full state showing the mode's 00 display (blank upper-left in any
# orientation, upright letter, tens 0, units 0). Lap3(X) = states showing 00
# reachable from X by one lap whose every edge is <= 3 HTM. X0 = U and
# X(k+1) = Lap3(X(k)) is a decreasing chain; its limit F is nonempty iff an
# infinite (hence eventually periodic) <= 3 HTM up run exists for this print.
include("periodic.jl")

# twist of cubie c with rotation r: which home axis (in the corner's cyclic
# order) now points along +-y. Checked invariant mod 3 under all moves below.
function cyc(c)
    p = POS[c]; s = p[1] * p[2] * p[3]
    s > 0 ? (1, 2, 3) : (1, 3, 2)
end
function twist(c, r)
    m = ROT[r]; order = cyc(c)
    for (i, a) in enumerate(order)
        v = m[:, a]                       # image of home axis a
        v[2] != 0 && return i - 1
    end
    error("no y axis")
end
twistsum(s::State) = mod(sum(twist(c, s[c]) for c in 1:8), 3)

function checktwist()
    rng = MersenneTwister(1); s = IDSTATE
    for _ in 1:20000
        s = applymove(s, rand(rng, 1:18)); twistsum(s) == 0 || error("twist not invariant")
    end
    true
end

# all reachable states showing need (blank UL any orientation)
function enumerate_display(sh, need::Target)
    # rotations of cubie c that put it at position index pi
    rotsat(c, pi) = [r for r in 1:NR if PIDX[c, r] == pi]
    out = UInt64[]
    cells = CELLIDX
    choices = [[(c, r) for c in 1:8 for r in rotsat(c, cells[k]) if sh[c, r] == need[k]] for k in 1:4]
    for a in choices[1], b in choices[2], c3 in choices[3], d in choices[4]
        used = [a[1], b[1], c3[1], d[1]]
        length(unique(used)) == 4 || continue
        rest = [c for c in 1:8 if !(c in used)]
        backpos = [pi for pi in 1:8 if !(pi in cells)]
        for perm in permutations4(rest)
            opts = [rotsat(perm[i], backpos[i]) for i in 1:4]
            for r1 in opts[1], r2 in opts[2], r3 in opts[3], r4 in opts[4]
                st = zeros(UInt8, 8)
                st[a[1]] = a[2]; st[b[1]] = b[2]; st[c3[1]] = c3[2]; st[d[1]] = d[2]
                st[perm[1]] = r1; st[perm[2]] = r2; st[perm[3]] = r3; st[perm[4]] = r4
                s = Tuple(st)
                twistsum(s) == 0 && push!(out, key(s))
            end
        end
    end
    sort!(out); unique!(out)
end
function permutations4(v)
    out = Vector{Vector{Int}}()
    for i in 1:4, j in 1:4, k in 1:4, l in 1:4
        length(unique((i, j, k, l))) == 4 && push!(out, v[[i, j, k, l]])
    end
    out
end

# one lap with radius-3 edges from a whole set
function lapset3(X::Vector{UInt64}, L, r, sh)
    tg = laptargets(L, r); n = r + 1
    R = X
    for step in 1:n
        R = get(ENV, "HM_FPR", "3") == "4" ? stepset(R, sh, tg[step % n + 1], B4, C4, W4) :
            stepset(R, sh, tg[step % n + 1], B3, C3, W3)
        isempty(R) && return R
    end
    R
end

function fixpoint3(sh, L, r; maxiter = 200)
    X = enumerate_display(sh, target(L, 0, true))
    sizes = [length(X)]
    for it in 1:maxiter
        Y = lapset3(X, L, r, sh)
        Y = filter(k -> insorted(X, k), Y)   # Lap3 image is a subset in exact arithmetic; keep it safe
        push!(sizes, length(Y))
        (isempty(Y) || Y == X) && return (F = Y, sizes = sizes)
        X = Y
    end
    (F = X, sizes = sizes, unresolved = true)
end

if abspath(PROGRAM_FILE) == (@__FILE__) && !startswith(ARGS[1], "anneal")
    checktwist()
    for pf in ARGS
        pr = readprinttxt(pf); sh = showtable(pr)
        for (L, r) in MODES
            fp = fixpoint3(sh, L, r)
            println(basename(pf), "\t$L$r\t|U|=$(fp.sizes[1])\titer=$(length(fp.sizes)-1)\t|F|=$(length(fp.F))\tsizes=$(join(fp.sizes[1:min(end,8)], ","))")
            flush(stdout)
        end
    end
end

# edges survived by radius-3 set propagation from U (up to `laps` laps)
function survive3(sh, L, r; laps = 2)
    tg = laptargets(L, r); n = r + 1
    R = enumerate_display(sh, target(L, 0, true))
    for step in 1:laps*n
        R = stepset(R, sh, tg[step % n + 1], B3, C3, W3)
        isempty(R) && return step - 1
    end
    laps * n
end
blanksok(pr) = count(==(' '), pr.glyph) == 3   # three blank stickers (HMS: one all-blank corner)
function obj3(pr::Print)
    blanksok(pr) || return (1e9, nothing)
    tall = vcat([laptargets(L, r) for (L, r) in MODES]...)
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1e6 * nbad, nothing)
    sh = showtable(pr)
    s = [survive3(sh, L, r) for (L, r) in MODES]
    caps = [120, 48, 24]
    (sum(caps .- s) / 1.0, Tuple(s))
end
function anneal3max(seed, iters, out, init)
    rng = MersenneTwister(seed); pr = init
    sc, info = obj3(pr); best = (sc, pr, info)
    println("init $sc $info"); flush(stdout)
    for it in 1:iters
        T = 3.0 * (1 - it / iters) + 0.05
        q = mutate(pr, rng, true)
        s2, i2 = obj3(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pr, sc, info = q, s2, i2
            if sc < best[1]
                best = (sc, pr, info)
                open(out, "w") do io
                    println(io, join([string(pr.glyph[i] == ' ' ? '_' : pr.glyph[i], pr.cell[i]) for i in 1:24], " "))
                end
                println("it=$it best=$sc $info"); flush(stdout)
                sc == 0 && break
            end
        end
        it % 200 == 0 && (println("it=$it cur=$sc"); flush(stdout))
    end
end
if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "anneal"
    checktwist()
    anneal3max(parse(Int, ARGS[2]), parse(Int, ARGS[3]), ARGS[4], readprinttxt(ARGS[5]))
end

# ---- hours-only max-3 search with the minutes route frozen ----
# stickers shown (any front cell) along a given route from IDSTATE
function usedstickers(pr, setup, words)
    s = applyword(IDSTATE, setup); used = Set{Int}()
    for w in vcat([Int[]], words)
        s = applyword(s, w)
        cat = cubieat(s)
        for k in 1:4
            c = cat[CELLIDX[k]]; push!(used, FRONT[c, s[c]][2])
        end
    end
    used
end
# fixpoint penalty: 0 if a <= 3 HTM cycle exists, else edges short of `cap`
function fppenalty(sh, L, r; maxiter = 30)
    n = r + 1; tg = laptargets(L, r)
    X = enumerate_display(sh, target(L, 0, true))
    done = 0
    for it in 1:maxiter
        R = X
        for step in 1:n
            R = stepset(R, sh, tg[step % n + 1], B3, C3, W3)
            if isempty(R)
                return max(0, 10n - done - (step - 1))
            end
        end
        Y = filter(k -> insorted(X, k), R)
        isempty(Y) && return max(0, 10n - done - n)
        Y == X && return 0
        X = Y; done += n
    end
    max(0, 10n - done)
end
function objH3(pr::Print)
    count(==(' '), pr.glyph) == 3 || return (1e9, nothing)
    tall = vcat([laptargets(L, r) for (L, r) in MODES]...)
    nbad = count(t -> !realizable(pr, t), unique(tall))
    nbad > 0 && return (1e6 * nbad, nothing)
    sh = showtable(pr)
    p23 = fppenalty(sh, 'H', 23); p11 = fppenalty(sh, 'H', 11)
    (Float64(p23 + p11), (p23, p11))
end
function mutatefree(pr, rng, free)
    while true
        g = copy(pr.glyph); c = copy(pr.cell)
        if rand(rng) < 0.4
            i, j = rand(rng, free, 2)
            g[i], g[j] = g[j], g[i]; c[i], c[j] = c[j], c[i]
        else
            i = rand(rng, free); t = rand(rng, 1:3)
            if t == 1; g[i] = rand(rng, "HM"); c[i] = 2
            elseif t == 2; g[i] = Char('0' + rand(rng, 0:5)); c[i] = 3
            else g[i] = Char('0' + rand(rng, 0:9)); c[i] = 4 end
        end
        q = Print(g, c)
        covered(q, true) && return q
    end
end
function annealH3(seed, iters, out, init, free)
    rng = MersenneTwister(seed); pr = init
    sc, info = objH3(pr); best = (sc, pr, info)
    println("init $sc $info free=$(length(free))"); flush(stdout)
    for it in 1:iters
        T = 3.0 * (1 - it / iters) + 0.05
        q = mutatefree(pr, rng, free)
        s2, i2 = objH3(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            pr, sc, info = q, s2, i2
            if sc < best[1]
                best = (sc, pr, info)
                open(out, "w") do io
                    println(io, join([string(pr.glyph[i] == ' ' ? '_' : pr.glyph[i], pr.cell[i]) for i in 1:24], " "))
                end
                println("it=$it best=$sc $info"); flush(stdout)
                sc == 0 && break
            end
        end
        it % 100 == 0 && (println("it=$it cur=$sc"); flush(stdout))
    end
end
if abspath(PROGRAM_FILE) == (@__FILE__) && ARGS[1] == "annealH3"
    checktwist()
    pr = readprinttxt(ARGS[5]); routes = readroutes(ARGS[6])
    su, P, Q, words = routes[('S', 59)]
    used = usedstickers(pr, su, words)
    free = [i for i in 1:24 if !(i in used) && pr.glyph[i] != ' ']
    println("frozen by the minutes route: ", sort(collect(used)))
    annealH3(parse(Int, ARGS[2]), parse(Int, ARGS[3]), ARGS[4], pr, free)
end
