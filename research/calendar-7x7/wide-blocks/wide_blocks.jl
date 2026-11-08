#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Wide / inner-wide block-move counting for the 7x7 calendar cube (research, read-only
# measurement: no solver, chain or app change). See README.md for the rules and results.
#
#   wide_blocks.jl RUN  OUTDIR [CHAIN_MOVES_TSV]   all sets, replay-checked, writes OUTDIR
#   wide_blocks.jl WORD "7,21,-1,-2,-3"             one signed generator word, prints plans
#   wide_blocks.jl GEOM OUTFILE                    layer geometry check, writes OUTFILE
#
# Model. A layer of axis a is the slab pos[a] = L, L in -3..3 (physical index p = L+4,
# 1..7; layer 0 = p 4 exists physically but has no generator). All layers of one axis turn
# in the SAME lab direction (engine.ts: one positive quarter turn per axis), so an
# "equal-angle block" of adjacent layers p=lo..hi is one rigid slab turn. A block that
# spans p=1..7 is a whole-cube rotation: free. Moves of one axis commute.
#
# Semantic preservation BY CONSTRUCTION (each step is a group identity):
#  S1 same generator twice: g^a g^b = g^(a+b mod 4)       (the existing HTM merge)
#  S2 layer turns of one axis (and that axis' rotation) commute pairwise
#  S3 block(lo..hi,t) := product over p in lo..hi of layer(p,t) (disjoint slabs commute)
#  S4 rotation(t) = block(1..7,t); so block(lo..hi,t) = rotation(t) * block(1..lo-1,-t)
#     * block(hi+1..7,-t), the complement form, whenever it is needed for a gens replay
#  S5 frame trick (columns "F"): R m = (R m R^-1) R, and R m R^-1 is a layer turn of the
#     axis R^-1(axis), layer sign*L, angle sign*t; so all rotations move to the end
# Independent checks (replay_check): digest of (a) the original word with the existing
# verify_moves.jl apply_word, (b) the blocks applied as direct slab turns by own geometry,
# (c) the blocks expanded to generators 1..21 (complement form for blocks that contain
# layer 0) replayed with verify_moves.jl apply_word. All must be equal.
using SHA, Printf, Statistics
include(joinpath(@__DIR__, "..", "upright-moves", "verify_moves.jl"))   # read_print, apply_word, htm

module WB
using SHA, Printf, Statistics
import ..read_print, ..apply_word
const VHTM = Main.htm

# ---------------------------------------------------------------- words and items
const Tok = Tuple{Int,Int}               # (generator 1..21, quarter turns 1..3)
const Item = Tuple{Int,Int,Int}          # (axis 1..3, p 1..7 or 0 = rotation, quarters 1..3)
const Blk = NTuple{4,Int}                # (axis, lo, hi, quarters); lo=1,hi=7 = rotation

tokens(signed::Vector{Int}) = Tok[(abs(g), g > 0 ? 1 : 3) for g in signed]
function normalize(toks)                 # S1; identical to verify_moves.jl htm grouping
    out = Tok[]
    for (g, t) in toks
        if !isempty(out) && out[end][1] == g
            n = mod(out[end][2] + t, 4); pop!(out); n != 0 && push!(out, (g, n))
        else
            push!(out, (g, t))
        end
    end
    out
end
function items(toks)
    map(toks) do (g, t)
        a = div(g - 1, 7) + 1; s = mod(g - 1, 7) + 1
        (a, s == 7 ? 0 : (s <= 3 ? s : s + 1), t)
    end
end
qcost(t) = t == 2 ? 2 : 1
htm_of(toks) = count(x -> x[1] % 7 != 0, toks)
qtm_of(toks) = sum((qcost(t) for (g, t) in toks if g % 7 != 0); init=0)
isfull(b::Blk) = b[2] == 1 && b[3] == 7
plan_cost(plan, metric) = sum((metric == :htm ? 1 : qcost(b[4]) for b in plan if !isfull(b)); init=0)

# ---------------------------------------------------------------- frame trick (S5)
const QM = (Int[1 0 0; 0 0 -1; 0 1 0], Int[0 0 1; 0 1 0; -1 0 0], Int[0 -1 0; 1 0 0; 0 0 1])
mpow(M, t) = foldl((A, _) -> M * A, 1:t; init=Int[1 0 0; 0 1 0; 0 0 1])
function frame_normalize(its::Vector{Item})
    R = Int[1 0 0; 0 1 0; 0 0 1]; out = Item[]
    for (a, p, t) in its
        if p == 0
            R = mpow(QM[a], t) * R
        else
            k = findfirst(!=(0), R[a, :]); s = R[a, k]
            push!(out, (k, s * (p - 4) + 4, s > 0 ? t : 4 - t))
        end
    end
    st = Item[]                           # merge adjacent equal layers again (S1 in the new frame)
    for (a, p, t) in out
        if !isempty(st) && st[end][1] == a && st[end][2] == p
            n = mod(st[end][3] + t, 4); pop!(st); n != 0 && push!(st, (a, p, n))
        else
            push!(st, (a, p, t))
        end
    end
    st, R
end
function rotation_blocks(R)               # shortest rotation word giving matrix R (BFS over 24)
    I3 = Int[1 0 0; 0 1 0; 0 0 1]
    prev = Dict{Matrix{Int},Tuple{Matrix{Int},Blk}}(I3 => (I3, (0, 0, 0, 0)))
    q = [I3]
    while !isempty(q)
        M = popfirst!(q)
        for a in 1:3, t in 1:3
            N = mpow(QM[a], t) * M
            haskey(prev, N) || (prev[N] = (M, (a, 1, 7, t)); push!(q, N))
        end
    end
    out = Blk[]; M = R
    while M != I3; (M, b) = prev[M]; pushfirst!(out, b); end
    out
end

# ---------------------------------------------------------------- Dijkstra tables (rules cn, c)
# state = 7 angles mod 4 (layer p=1..7), moves = intervals lo..hi with angle 1..3.
# weight = 1000 per block (HTM) or 1000/2000 for 1/2 quarters (QTM) + width as tie-break
# (fewest blocks first, then narrowest); the full interval is free in rule c only.
struct Table; dist::Vector{Int}; par::Vector{Int}; pb::Vector{Blk}; end
digits7(s) = [(s >> (2 * (i - 1))) & 3 for i in 1:7]
enc7(d) = sum(d[i] << (2 * (i - 1)) for i in 1:7)
function build_table(rule::Symbol, metric::Symbol)
    n = 4^7; INF = typemax(Int) ÷ 2
    moves = Tuple{Int,Int,Int,Int}[]       # lo hi t weight
    for lo in 1:7, hi in lo:7, t in 1:3
        full = lo == 1 && hi == 7
        (rule == :cn && lo <= 4 <= hi) && continue
        w = full && rule == :c ? 0 : (metric == :htm ? 1000 : 1000 * qcost(t)) + (hi - lo + 1)
        push!(moves, (lo, hi, t, w))
    end
    dist = fill(INF, n); par = fill(-1, n); pb = fill((0, 0, 0, 0), n); dist[1] = 0
    dig = [digits7(s - 1) for s in 1:n]
    changed = true
    while changed
        changed = false
        for s in 0:n-1
            ds = dist[s+1]; ds >= INF && continue
            d = dig[s+1]
            for (lo, hi, t, w) in moves
                e = copy(d); for i in lo:hi; e[i] = (e[i] + t) & 3; end
                s2 = enc7(e) + 1
                if ds + w < dist[s2]
                    dist[s2] = ds + w; par[s2] = s + 1; pb[s2] = (0, lo, hi, t); changed = true
                end
            end
        end
    end
    Table(dist, par, pb)
end
function table_plan(tb::Table, axis, u)
    s = enc7(u) + 1; out = Blk[]
    while tb.par[s] != -1
        (_, lo, hi, t) = tb.pb[s]; push!(out, (axis, lo, hi, t)); s = tb.par[s]
    end
    reverse(out)
end

# ---------------------------------------------------------------- per-run plans
rotblk(axis, r) = mod(r, 4) == 0 ? Blk[] : Blk[(axis, 1, 7, mod(r, 4))]
function dp_segments(seq, axis, metric)   # rule a: adjacent equal-angle contiguous merging
    n = length(seq); best = fill(typemax(Int) ÷ 2, n + 1); from = zeros(Int, n + 1); best[1] = 0
    for i in 1:n, j in 1:i
        seg = seq[j:i]
        all(x -> x[2] == seg[1][2], seg) || continue
        ps = [x[1] for x in seg]
        (length(unique(ps)) == length(ps) && maximum(ps) - minimum(ps) + 1 == length(ps) && !(minimum(ps) <= 4 <= maximum(ps))) || continue
        c = best[j] + (metric == :htm ? 1 : qcost(seg[1][2]))
        c < best[i+1] && (best[i+1] = c; from[i+1] = j)
    end
    out = Blk[]; i = n
    while i > 0
        j = from[i+1]; seg = seq[j:i]; pushfirst!(out, (axis, minimum(x[1] for x in seg), maximum(x[1] for x in seg), seg[1][2])); i = j - 1
    end
    out
end
function plan_a(run, axis, metric)       # rotations stay in place as barriers (free)
    out = Blk[]; seq = Tuple{Int,Int}[]
    flush!() = (append!(out, dp_segments(seq, axis, metric)); empty!(seq))
    for (_, p, t) in run
        if p == 0; flush!(); push!(out, (axis, 1, 7, t)); else push!(seq, (p, t)); end
    end
    flush!(); out
end
function plan_group(u, axis)             # rule b: net per layer, maximal equal-angle groups
    out = Blk[]; p = 1
    while p <= 7
        if u[p] == 0; p += 1; continue; end
        q = p; while q < 7 && u[q+1] == u[p]; q += 1; end
        push!(out, (axis, p, q, u[p])); p = q + 1
    end
    out
end
function plan_run(run, rule, metric, tabs)
    axis = run[1][1]; u = zeros(Int, 7); r = 0
    for (_, p, t) in run; p == 0 ? (r += t) : (u[p] = mod(u[p] + t, 4)); end
    if rule == :r0
        return vcat(Blk[(axis, p, p, u[p]) for p in 1:7 if u[p] != 0], rotblk(axis, r))
    elseif rule == :a
        return plan_a(run, axis, metric)
    elseif rule == :b
        pa = plan_a(run, axis, metric)
        pg = vcat(plan_group(u, axis), rotblk(axis, r))
        return plan_cost(pg, metric) < plan_cost(pa, metric) ? pg : pa
    else
        return vcat(table_plan(tabs[(rule, metric)], axis, u), rotblk(axis, r))
    end
end
function runs_of(its)
    runs = Vector{Item}[]
    for it in its
        (!isempty(runs) && runs[end][1][1] == it[1]) ? push!(runs[end], it) : push!(runs, Item[it])
    end
    runs
end
function squeeze_rot(plan)       # adjacent rotations of one axis fuse (S2, S1)
    out = Blk[]
    for b in plan
        if isfull(b) && !isempty(out) && isfull(out[end]) && out[end][1] == b[1]
            n = mod(out[end][4] + b[4], 4); pop!(out); n != 0 && push!(out, (b[1], 1, 7, n))
        else
            push!(out, b)
        end
    end
    out
end
function plan_word(toks, mode::Symbol, rule, metric, tabs)
    its = items(toks); tail = Blk[]
    if mode == :F
        its, R = frame_normalize(its); tail = rotation_blocks(R)
    end
    plan = Blk[]
    for run in runs_of(its); append!(plan, plan_run(run, rule, metric, tabs)); end
    append!(plan, tail); squeeze_rot(plan)
end

# ---------------------------------------------------------------- replay (own geometry)
struct Print; piece::Vector{Int}; text::Vector{String}; ink::Vector{String}
    pos::Matrix{Int8}; nor::Matrix{Int8}; up::Matrix{Int8}; end
function load_print(path)
    st = read_print(path); n = length(st)
    m(f) = Int8[getfield(s, f)[k] for k in 1:3, s in st]
    Print([s.piece for s in st], [s.text for s in st], [s.ink for s in st], m(:pos), m(:normal), m(:up))
end
function rot!(v::Matrix{Int8}, i, axis)
    x, y, z = v[1, i], v[2, i], v[3, i]
    if axis == 1; v[2, i] = -z; v[3, i] = y
    elseif axis == 2; v[1, i] = z; v[3, i] = -x
    else; v[1, i] = -y; v[2, i] = x; end
end
function apply_blocks(P::Print, plan)    # direct slab semantics (S3); no generator involved
    pos = copy(P.pos); nor = copy(P.nor); up = copy(P.up)
    for (a, lo, hi, t) in plan, i in 1:size(pos, 2)
        (lo <= pos[a, i] + 4 <= hi) || continue
        for _ in 1:t; rot!(pos, i, a); rot!(nor, i, a); rot!(up, i, a); end
    end
    pos, nor, up
end
function digest_arrays(P::Print, pos, nor, up)       # same text as verify_moves.jl state digest
    io = IOBuffer()
    for i in 1:size(pos, 2)
        println(io, join([i, P.piece[i], join(pos[:, i], ','), join(nor[:, i], ','), join(up[:, i], ','), P.text[i], P.ink[i]], '\t'))
    end
    bytes2hex(sha256(take!(io)))
end
function digest_state(state)
    io = IOBuffer()
    for s in state; println(io, join([s.id, s.piece, join(s.pos, ','), join(s.normal, ','), join(s.up, ','), s.text, s.ink], '\t')); end
    bytes2hex(sha256(take!(io)))
end
function signed_of(toks)
    w = Int[]
    for (g, t) in toks; t == 1 ? push!(w, g) : t == 3 ? push!(w, -g) : append!(w, (g, g)); end
    w
end
function expand_gens(plan)               # S4: blocks -> generators 1..21 (no layer 0 needed)
    w = Int[]
    emit(axis, ps, t) = for p in ps
        g = 7 * (axis - 1) + (p <= 3 ? p : p - 1); append!(w, signed_of([(g, t)]))
    end
    for (a, lo, hi, t) in plan
        if lo == 1 && hi == 7
            append!(w, signed_of([(7 * a, t)]))
        elseif lo <= 4 <= hi
            append!(w, signed_of([(7 * a, t)])); emit(a, 1:lo-1, 4 - t); emit(a, hi+1:7, 4 - t)
        else
            emit(a, lo:hi, t)
        end
    end
    w
end
function replay_check(P::Print, st0, toks, plan)
    d0 = digest_state(apply_word(st0, signed_of(toks)))                    # existing replay
    pos, nor, up = apply_blocks(P, plan); d1 = digest_arrays(P, pos, nor, up)   # own slab geometry
    d2 = digest_state(apply_word(st0, expand_gens(plan)))                  # existing replay of expansion
    d0 == d1 == d2, d0
end

# ---------------------------------------------------------------- classification
width(b) = b[3] - b[2] + 1
function category(b::Blk)
    w = width(b); outer = b[2] == 1 || b[3] == 7
    w == 1 ? (outer ? :outer1 : :inner1) : (outer ? :outerwide : :innerwide)
end
blockstr(b::Blk) = isfull(b) ? string("xyz"[b[1]], "[all]", ("+", "2", "-")[b[4]]) :
    string("xyz"[b[1]], b[2] == b[3] ? "[$(b[2]-4)]" : "[$(b[2]-4)..$(b[3]-4)]", ("+", "2", "-")[b[4]])
planstr(plan) = join(blockstr.(plan), ' ')
end # module WB

# ======================================================================= driver
const RULES = (:r0, :a, :b, :cn, :c)
const RULENAME = Dict(:r0 => "r0 single layers after net cancel", :a => "a adjacent equal-angle merge",
    :b => "b reorder in run + cancel + group", :cn => "cn nested intervals, no layer 0, no rotation",
    :c => "c complement + free rotation + layer 0")
const METRICS = (:htm, :qtm)

function read_words(path, wordcol; labelcols=(1,))
    rows = [split(l, '\t') for l in readlines(path)[2:end] if !isempty(l)]
    [(join((r[c] for c in labelcols), '>'), parse.(Int, split(r[wordcol], ','))) for r in rows]
end
function read_chain(path)
    out = []; cur = nothing; label = ""
    for l in eachline(path)
        f = split(l, '\t')
        if f[1] == "edge"
            label = string(f[2], "-", lpad(f[3], 2, '0')); cur = Int[]
        elseif f[1] == "move"
            g = parse(Int, f[2]); q = parse(Int, f[3])
            q == 1 ? push!(cur, g) : q == -1 ? push!(cur, -g) : append!(cur, (g, g))
        elseif f[1] == "end"
            push!(out, (label, cur))
        end
    end
    out
end
# engine.ts metrics count each (g,q) entry; verify_moves.jl merges adjacent equal generators
function read_chain_engine(path)
    n = 0; per = Int[]; c = 0
    for l in eachline(path)
        f = split(l, '\t')
        f[1] == "edge" && (c = 0)
        f[1] == "move" && parse(Int, f[2]) % 7 != 0 && (c += 1)
        f[1] == "end" && push!(per, c)
    end
    per
end

stats(v) = isempty(v) ? "-" : @sprintf("min %d / med %s / mean %.2f / max %d / total %d", minimum(v),
    string(median(v)), mean(v), maximum(v), sum(v))

function main_run(outdir, chain_path)
    mkpath(outdir)
    root = normpath(joinpath(@__DIR__, "..", "..", ".."))
    pr = joinpath(root, "research/calendar-7x7/upright-feasibility/evidence/print-strict-upright.tsv")
    P = WB.load_print(pr); st0 = read_print(pr)
    t0 = time()
    tabs = Dict((r, m) => WB.build_table(r, m) for r in (:cn, :c) for m in METRICS)
    @printf("tables built in %.1fs\n", time() - t0)
    sets = Any[
        ("moves91", read_words(joinpath(root, "research/calendar-7x7/upright-moves/evidence/moves-strict.tsv"), 6)),
        ("edges98", read_words(joinpath(root, "research/calendar-7x7/upright-beam/evidence/edges-98.tsv"), 10; labelcols=(1, 2))),
        ("smoke-orbit4", read_words(joinpath(root, "research/calendar-7x7/upright-moves/evidence/chain-smoke-edges.tsv"), 8; labelcols=(1, 2))),
        ("smoke-beam4", read_words(joinpath(root, "research/calendar-7x7/upright-beam/evidence/chain-smoke-edges.tsv"), 8; labelcols=(1, 2))),
    ]
    chain_engine = Int[]
    if chain_path !== nothing
        push!(sets, ("chain576", read_chain(chain_path))); chain_engine = read_chain_engine(chain_path)
    end
    known = Dict{String,String}()          # id => digest from the existing evidence/verify-moves.tsv
    for l in readlines(joinpath(root, "research/calendar-7x7/upright-moves/evidence/verify-moves.tsv"))
        f = split(l, '\t'); f[1] == "move-check" && (known[f[2]] = f[9])
    end
    summ = IOBuffer(); runs_out = IOBuffer()
    println(summ, "set\tmode\trule\tmetric\tn\tmin\tmedian\tmean\tmax\ttotal\twords_with_gain\twords_with_wide_block\tbefore_total")
    println(runs_out, "set\truns\truns_ge2_layer_tokens\ttokens\ttokens_in_runs_ge2\tmax_run_tokens\thist_1_to_7plus")
    cls_out = IOBuffer()
    println(cls_out, "set\tmode\trule\tblocks\tw1\tw2\tw3\tw4\tw5\tw6\touter1\tinner1\touter_wide\tinner_wide\tfree_rotations\tblocks_with_layer0")
    total_bad = 0; selfcheck_fail = 0
    for (name, words) in sets
        rows = IOBuffer()
        hdr = ["label", "htm0", "qtm0"]
        for mode in (:W, :F), rule in RULES, m in METRICS; push!(hdr, string(mode, "_", rule, "_", m)); end
        push!(hdr, "replay_ok", "plan_c_W_htm")
        println(rows, join(hdr, '\t'))
        res = Dict{Tuple{Symbol,Symbol,Symbol},Vector{Int}}()
        cls = Dict{Tuple{Symbol,Symbol},Dict{Symbol,Int}}()
        wide = Dict{Tuple{Symbol,Symbol},Int}()
        htm0s = Int[]; qtm0s = Int[]; badn = 0; hist = zeros(Int, 7); nruns = 0; nruns2 = 0; ntok = 0; ntok2 = 0; maxrun = 0
        t1 = time()
        for (wi, (label, signed)) in enumerate(words)
            toks = WB.normalize(WB.tokens(signed))
            h0 = WB.htm_of(toks); q0 = WB.qtm_of(toks)
            h0 == Main.htm(signed) || error("htm mismatch in $name $label")
            push!(htm0s, h0); push!(qtm0s, q0)
            for run in WB.runs_of(WB.items(toks))
                k = count(x -> x[2] != 0, run); k == 0 && continue
                nruns += 1; ntok += k; hist[min(k, 7)] += 1; maxrun = max(maxrun, k)
                k >= 2 && (nruns2 += 1; ntok2 += k)
            end
            vals = Any[label, h0, q0]; ok_all = true; planc = ""
            for mode in (:W, :F), rule in RULES, m in METRICS
                plan = WB.plan_word(toks, mode, rule, m, tabs)
                ok, _ = WB.replay_check(P, st0, toks, plan)
                ok_all &= ok
                c = WB.plan_cost(plan, m)
                push!(get!(res, (mode, rule, m), Int[]), c); push!(vals, c)
                if m == :htm
                    d = get!(cls, (mode, rule), Dict{Symbol,Int}())
                    for b in plan
                        if WB.isfull(b); d[:free] = get(d, :free, 0) + 1
                        else; d[Symbol("w", WB.width(b))] = get(d, Symbol("w", WB.width(b)), 0) + 1
                            d[WB.category(b)] = get(d, WB.category(b), 0) + 1
                            b[2] <= 4 <= b[3] && (d[:has0] = get(d, :has0, 0) + 1); end
                    end
                    any(b -> !WB.isfull(b) && WB.width(b) >= 2, plan) && (wide[(mode, rule)] = get(wide, (mode, rule), 0) + 1)
                end
                mode == :W && rule == :c && m == :htm && (planc = WB.planstr(plan))
            end
            haskey(known, label) && name == "moves91" &&
                (WB.digest_state(apply_word(st0, WB.signed_of(toks))) == known[label] || (selfcheck_fail += 1))
            ok_all || (badn += 1)
            push!(vals, ok_all ? "OK" : "MISMATCH", name == "chain576" ? "-" : planc)
            println(rows, join(vals, '\t'))
            wi % 100 == 0 && @printf("  %s %d/%d (%.0fs)\n", name, wi, length(words), time() - t1)
        end
        total_bad += badn
        write(joinpath(outdir, "words-$name.tsv"), take!(rows))
        println(runs_out, name, '\t', nruns, '\t', nruns2, '\t', ntok, '\t', ntok2, '\t', maxrun, '\t', join(hist, ','))
        println(summ, name, "\t-\tbase\thtm\t", length(words), '\t', join((minimum(htm0s), median(htm0s), round(mean(htm0s); digits=2), maximum(htm0s), sum(htm0s)), '\t'), "\t-\t-\t", sum(htm0s))
        println(summ, name, "\t-\tbase\tqtm\t", length(words), '\t', join((minimum(qtm0s), median(qtm0s), round(mean(qtm0s); digits=2), maximum(qtm0s), sum(qtm0s)), '\t'), "\t-\t-\t", sum(qtm0s))
        if name == "chain576" && !isempty(chain_engine)
            println(summ, name, "\t-\tengine-entries\thtm\t", length(chain_engine), '\t', join((minimum(chain_engine), median(chain_engine), round(mean(chain_engine); digits=2), maximum(chain_engine), sum(chain_engine)), '\t'), "\t-\t-\t", sum(chain_engine))
        end
        for mode in (:W, :F), rule in RULES, m in METRICS
            v = res[(mode, rule, m)]; base = m == :htm ? htm0s : qtm0s
            println(summ, name, '\t', mode, '\t', rule, '\t', m, '\t', length(v), '\t', join((minimum(v), median(v), round(mean(v); digits=2), maximum(v), sum(v)), '\t'),
                '\t', count(i -> v[i] < base[i], eachindex(v)), '\t', get(wide, (mode, rule), 0), '\t', sum(base))
        end
        for mode in (:W, :F), rule in RULES
            d = cls[(mode, rule)]; g(k) = get(d, k, 0)
            nb = g(:outer1) + g(:inner1) + g(:outerwide) + g(:innerwide)
            println(cls_out, name, '\t', mode, '\t', rule, '\t', nb, '\t', join((g(Symbol("w", i)) for i in 1:6), '\t'), '\t',
                join((g(:outer1), g(:inner1), g(:outerwide), g(:innerwide), g(:free), g(:has0)), '\t'))
        end
        @printf("%s: %d words, replay mismatches %d\n", name, length(words), badn)
    end
    # negative controls: damaged plans must be rejected by the replay
    negs = IOBuffer(); println(negs, "control\ttried\trejected")
    toks_all = [WB.normalize(WB.tokens(w)) for (_, w) in sets[1][2]]
    for (cname, damage) in (("drop last block", p -> p[1:end-1]), ("angle changed on first block (t to t mod 3 + 1)", p -> (b = p[1]; vcat([(b[1], b[2], b[3], mod(b[4], 3) + 1)], p[2:end]))),
                            ("widen or narrow last block by one layer", p -> (b = p[end]; b[3] < 7 ? vcat(p[1:end-1], [(b[1], b[2], b[3] + 1, b[4])]) : vcat(p[1:end-1], [(b[1], b[2] + 1, b[3], b[4])]))))
        tried = 0; rej = 0
        for toks in toks_all[1:20]
            plan = WB.plan_word(toks, :W, :c, :htm, tabs); plan2 = damage(plan)
            plan2 == plan && continue
            tried += 1; ok, _ = WB.replay_check(P, st0, toks, plan2); ok || (rej += 1)
        end
        println(negs, cname, '\t', tried, '\t', rej)
    end
    write(joinpath(outdir, "summary.tsv"), take!(summ)); write(joinpath(outdir, "run-structure.tsv"), take!(runs_out))
    write(joinpath(outdir, "block-classes.tsv"), take!(cls_out)); write(joinpath(outdir, "negative-controls.tsv"), take!(negs))
    println("existing-digest mismatches (moves91 vs verify-moves.tsv): ", selfcheck_fail)
    println("TOTAL replay mismatches: ", total_bad)
    verdict = total_bad == 0 && selfcheck_fail == 0 ? "ALL_DIGESTS_EQUAL" : "MISMATCH"
    println("verdict\t", verdict)
    exit(verdict == "ALL_DIGESTS_EQUAL" ? 0 : 1)
end

function main_word(wstr)
    signed = parse.(Int, split(wstr, ','))
    tabs = Dict((r, m) => WB.build_table(r, m) for r in (:cn, :c) for m in METRICS)
    pr = normpath(joinpath(@__DIR__, "..", "upright-feasibility/evidence/print-strict-upright.tsv"))
    P = WB.load_print(pr); st0 = read_print(pr)
    toks = WB.normalize(WB.tokens(signed))
    println("HTM before ", WB.htm_of(toks), "  QTM before ", WB.qtm_of(toks))
    for mode in (:W, :F), rule in RULES, m in METRICS
        plan = WB.plan_word(toks, mode, rule, m, tabs); ok, _ = WB.replay_check(P, st0, toks, plan)
        println(mode, ' ', rule, ' ', m, " cost ", WB.plan_cost(plan, m), ok ? " replay=OK " : " replay=MISMATCH ", WB.planstr(plan))
    end
end

function main_geom(out)           # layer geometry: slab populations and same-direction check
    pr = normpath(joinpath(@__DIR__, "..", "upright-feasibility/evidence/print-strict-upright.tsv"))
    st = read_print(pr); io = IOBuffer()
    for a in 1:3; println(io, "axis ", a, " stickers in slab pos[axis]=-3..3: ", [count(s -> s.pos[a] == L, st) for L in -3:3]); end
    println(io, "surface bodies: ", length(unique(s.pos for s in st)), " (218 expected)")
    # every single-layer turn of generator 1..21 equals a slab turn in the same lab direction
    P = WB.load_print(pr); ok = true
    for g in 1:21
        g % 7 == 0 && continue
        a = div(g - 1, 7) + 1; s = mod(g - 1, 7) + 1; p = s <= 3 ? s : s + 1
        d0 = WB.digest_state(apply_word(st, [g])); pos, nor, up = WB.apply_blocks(P, [(a, p, p, 1)])
        ok &= d0 == WB.digest_arrays(P, pos, nor, up)
    end
    println(io, "generators 1..21 equal slab turns p=slot->layer, same direction per axis: ", ok)
    write(out, take!(io)); print(String(read(out)))
end

if abspath(PROGRAM_FILE) == @__FILE__
    if ARGS[1] == "RUN"; main_run(ARGS[2], length(ARGS) >= 3 ? ARGS[3] : nothing)
    elseif ARGS[1] == "WORD"; main_word(ARGS[2])
    elseif ARGS[1] == "GEOM"; main_geom(ARGS[2])
    else; error("usage: wide_blocks.jl RUN OUTDIR [CHAIN_TSV] | WORD gens | GEOM OUTFILE"); end
end
