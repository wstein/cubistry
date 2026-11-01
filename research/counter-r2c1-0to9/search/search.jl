# Generator and exact analyzer for the 2x2x2 r2c1 (LL) 0..9 single-digit counter.
#
# Model:
# - 2x2x2 cube in fixed frame: Front = +z, Up = +y.
# - Cells on +z: UL=(-1,1,1), UR=(1,1,1), LL=(-1,-1,1) [r2c1], LR=(1,-1,1).
# - At every settled display d in 0..9:
#     UL, UR, LR must show blank ('_'),
#     LL (r2c1) must show digit d ('0'..'9') upright (up = (0,1,0)).
# - Move partition relative to r2c1 = (-1,-1,1):
#     Touching moves T (9):     L, L', L2, D, D', D2, F, F', F2
#     Preparing moves P (9):    R, R', R2, U, U', U2, B, B', B2
#     Back-only prep P_B (3):   B, B', B2 (touch zero front cells: UL, UR, LL, LR all stay fixed)
# - Transition rule:
#     Each increment (and inverse decrement) uses exactly 1 move in T
#     and 0, 1, or 2 preparing moves in P.

const Vec = NTuple{3,Int}
dotp(a, b) = a[1]*b[1] + a[2]*b[2] + a[3]*b[3]
crossp(a, b) = (a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1])
cw(v, a) = (d = dotp(v, a); c = crossp(a, v); (d*a[1]-c[1], d*a[2]-c[2], d*a[3]-c[3]))

const FACE = Dict('R'=>(1,0,0), 'L'=>(-1,0,0), 'U'=>(0,1,0), 'D'=>(0,-1,0), 'F'=>(0,0,1), 'B'=>(0,0,-1))
const CORNERS = [
    (-1, 1, 1), ( 1, 1, 1), (-1,-1, 1), ( 1,-1, 1),
    (-1, 1,-1), ( 1, 1,-1), (-1,-1,-1), ( 1,-1,-1)
]
const CELLS = [(-1,1,1), (1,1,1), (-1,-1,1), (1,-1,1)] # UL, UR, LL (r2c1), LR
const Z = (0,0,1)
const Y = (0,1,0)

# 24 facelets in canonical order (cubie 0..7, axis x, y, z)
const FACELETS = Tuple{Int,Vec,Vec}[]
for (ci, p) in enumerate(CORNERS)
    for a in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]
        if dotp(p, a) == 1
            push!(FACELETS, (ci - 1, p, a))
        end
    end
end
@assert length(FACELETS) == 24
const FACELET_IDX = Dict((p, n) => i for (i, (_, p, n)) in enumerate(FACELETS))

const IDX_UL = FACELET_IDX[((-1,1,1), Z)]
const IDX_UR = FACELET_IDX[((1,1,1), Z)]
const IDX_LL = FACELET_IDX[((-1,-1,1), Z)]
const IDX_LR = FACELET_IDX[((1,-1,1), Z)]

struct Move
    name::String
    face::Char
    axis::Vec
    q::Int
    touches_r2c1::Bool
    touches_front_blank::Bool
    pull::NTuple{24,Int}
end

function build_moves()
    mvs = Move[]
    for (fc, ax) in pairs(FACE)
        for (q, suf) in [(1, ""), (2, "2"), (3, "'")]
            nm = string(fc) * suf
            touches = dotp((-1, -1, 1), ax) > 0
            touches_fb = any(c -> dotp(c, ax) > 0, [(-1,1,1), (1,1,1), (1,-1,1)])
            pull = zeros(Int, 24)
            for (i, (_, p, n)) in enumerate(FACELETS)
                p2, n2 = p, n
                if dotp(p, ax) > 0
                    for _ in 1:q
                        p2 = cw(p2, ax)
                        n2 = cw(n2, ax)
                    end
                end
                dest = FACELET_IDX[(p2, n2)]
                pull[dest] = i
            end
            push!(mvs, Move(nm, fc, ax, q, touches, touches_fb, Tuple(pull)))
        end
    end
    sort!(mvs, by = m -> m.name)
    return mvs
end

const MOVES = build_moves()
const MOVE_BY_NAME = Dict(m.name => m for m in MOVES)
const TOUCH_MOVES = [m for m in MOVES if m.touches_r2c1]
const PREP_MOVES = [m for m in MOVES if !m.touches_r2c1]

@inline function apply_pull(at::NTuple{24,Int}, pull::NTuple{24,Int})
    ntuple(i -> @inbounds(at[pull[i]]), 24)
end

const HOME_STATE = ntuple(i -> i, 24)
@inline bit(s::Int) = UInt32(1) << (s - 1)

# Compute the exact home up-vector for a sticker at home facelet `s` so that when
# `s` sits at LL = (-1,-1,1) with normal +Z = (0,0,1), its rotated up-vector is +Y = (0,1,0).
const ROTS = [
    (ex, ey, crossp(ex, ey))
    for ex in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    for ey in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    if dotp(ex, ey) == 0
]
applyR(R, v) = (R[1] .* v[1] .+ R[2] .* v[2] .+ R[3] .* v[3])

function home_up_for_LL(p::Vec, n::Vec)::Vec
    c = (-1, -1, 1)
    Rs = [R for R in ROTS if applyR(R, p) == c && applyR(R, n) == Z]
    @assert length(Rs) == 1
    R = Rs[1]
    for u in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
        if dotp(u, n) == 0 && applyR(R, u) == Y
            return u
        end
    end
    error("unreachable")
end

# Inspect all 38 B-only 13-HTM exact-closed cycles
struct CompoundStep
    word::String
    htm::Int
    prep_count::Int
    touch_face::Char
    only_B_prep::Bool
    has_half_turn::Bool
    pull::NTuple{24,Int}
    inv_word::String
end

inv_tok(m::String) = length(m) == 1 ? m * "'" : m[2] == '\'' ? m[1:1] : m
inv_w(w::Vector{String}) = join(reverse([inv_tok(x) for x in w]), " ")

function build_pre_steps()
    steps = CompoundStep[]
    for t in TOUCH_MOVES
        t.face == 'F' && continue
        push!(steps, CompoundStep(t.name, 1, 0, t.face, true, occursin('2', t.name), t.pull, inv_tok(t.name)))
    end
    for p in PREP_MOVES, t in TOUCH_MOVES
        t.face == 'F' && continue
        pull_pt = apply_pull(p.pull, t.pull)
        w = p.name * " " * t.name
        push!(steps, CompoundStep(w, 2, 1, t.face, p.face == 'B', occursin('2', w), pull_pt, inv_w([p.name, t.name])))
    end
    sort!(steps, by = s -> (s.prep_count, !s.only_B_prep, s.has_half_turn, s.word))
    return steps
end

const STEPS_B = [s for s in build_pre_steps() if s.only_B_prep]

function find_all_13htm_B_cycles()
    b0 = bit(HOME_STATE[IDX_UL]) | bit(HOME_STATE[IDX_UR]) | bit(HOME_STATE[IDX_LR])
    l0 = bit(HOME_STATE[IDX_LL])
    fwd = Dict{NTuple{24,Int}, Vector{Tuple{Int,UInt32,UInt32,NTuple{5,Int}}}}()
    path = zeros(Int, 5)

    function dfs_fwd(depth::Int, st::NTuple{24,Int}, ll_mask::UInt32, blank_mask::UInt32, preps::Int)
        if depth == 6
            vec = get!(fwd, st, Tuple{Int,UInt32,UInt32,NTuple{5,Int}}[])
            push!(vec, (preps, ll_mask ⊻ l0, blank_mask, (path[1], path[2], path[3], path[4], path[5])))
            return
        end
        for (si, s) in enumerate(STEPS_B)
            preps + s.prep_count > 3 && continue
            nxt = apply_pull(st, s.pull)
            ll_s = nxt[IDX_LL]
            b_ll = bit(ll_s)
            (b_ll & (ll_mask | blank_mask)) != 0 && continue
            b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
            ll_mask2 = ll_mask | b_ll
            (b_bl & ll_mask2) != 0 && continue
            path[depth] = si
            dfs_fwd(depth + 1, nxt, ll_mask2, blank_mask | b_bl, preps + s.prep_count)
        end
    end
    dfs_fwd(1, HOME_STATE, l0, b0, 0)

    inv_pulls = [begin
        ip = zeros(Int, 24)
        for i in 1:24; ip[s.pull[i]] = i; end
        Tuple(ip)
    end for s in STEPS_B]

    cycles = Vector{Vector{Int}}()
    bwd_path = zeros(Int, 5)
    function dfs_bwd(depth::Int, st::NTuple{24,Int}, ll_mask::UInt32, blank_mask::UInt32, preps::Int)
        if depth == 6
            if haskey(fwd, st)
                b_st_ll = bit(st[IDX_LL])
                bwd_ll_only = ll_mask ⊻ l0 ⊻ b_st_ll
                for (f_preps, fwd_ll_only, fwd_bl, f_path) in fwd[st]
                    f_preps + preps != 3 && continue
                    (fwd_ll_only & bwd_ll_only) != 0 && continue
                    all_ll = l0 | fwd_ll_only | bwd_ll_only
                    all_bl = fwd_bl | blank_mask
                    (all_ll & all_bl) != 0 && continue
                    push!(cycles, [f_path[1], f_path[2], f_path[3], f_path[4], f_path[5],
                                   bwd_path[5], bwd_path[4], bwd_path[3], bwd_path[2], bwd_path[1]])
                end
            end
            return
        end
        for (si, s) in enumerate(STEPS_B)
            preps + s.prep_count > 3 && continue
            prev_st = apply_pull(st, inv_pulls[si])
            ll_s = prev_st[IDX_LL]
            b_ll = bit(ll_s)
            (b_ll & (ll_mask | blank_mask)) != 0 && continue
            b_bl = bit(prev_st[IDX_UL]) | bit(prev_st[IDX_UR]) | bit(prev_st[IDX_LR])
            ll_mask2 = ll_mask | b_ll
            (b_bl & ll_mask2) != 0 && continue
            bwd_path[depth] = si
            dfs_bwd(depth + 1, prev_st, ll_mask2, blank_mask | b_bl, preps + s.prep_count)
        end
    end
    dfs_bwd(1, HOME_STATE, l0, b0, 0)
    println("Found $(length(cycles)) exact-closed 13-HTM B-only cycles:")
    for (idx, c) in enumerate(cycles)
        words = [STEPS_B[k].word for k in c]
        n_qtr = count(w -> !occursin('2', w), words)
        if idx <= 15 || n_qtr == 10
            println("  #$idx (quarter-only steps=$n_qtr/10): ", join(words, " | "))
        end
    end
    return cycles
end

function inspect_cycle_print(words::Vector{String}, name::String)
    println("\n=== Inspecting cycle: $name ===")
    println("  Words: ", join(words, " | "))
    st = HOME_STATE
    states = Vector{NTuple{24,Int}}(undef, 10)
    inter_blank_ok = true
    for d in 1:10
        states[d] = st
        mvs = [MOVE_BY_NAME[t] for t in split(words[d], " ")]
        for (mi, mv) in enumerate(mvs)
            st = apply_pull(st, mv.pull)
            if mi < length(mvs)
                # intermediate state after prep move
                # check if UL, UR, LR are still blank and LL is still digit d-1
            end
        end
    end
    @assert st == HOME_STATE "Cycle did not close on HOME_STATE!"

    digit_stickers = [states[d][IDX_LL] for d in 1:10]
    blank_stickers = Set{Int}()
    for d in 1:10
        push!(blank_stickers, states[d][IDX_UL], states[d][IDX_UR], states[d][IDX_LR])
    end
    @assert isempty(intersect(Set(digit_stickers), blank_stickers))
    free_stickers = setdiff(Set(1:24), union(Set(digit_stickers), blank_stickers))

    println("  10 Digit facelets (0..9): ", digit_stickers)
    println("  Required blank facelets ($(length(blank_stickers))): ", sort(collect(blank_stickers)))
    println("  Completely unvisited facelets ($(length(free_stickers))): ", sort(collect(free_stickers)))

    # Group by corner cubie (0..7)
    for c in 0:7
        f_ids = [i for i in 1:24 if FACELETS[i][1] == c]
        roles = [begin
            d_idx = findfirst(==(i), digit_stickers)
            if d_idx !== nothing
                "digit $(d_idx - 1)"
            elseif i in blank_stickers
                "blank (visited)"
            else
                "blank (unvisited)"
            end
        end for i in f_ids]
        println("  Cubie $c $(CORNERS[c+1]): ", join(["f$(f_ids[k]-1)[$(FACELETS[f_ids[k]][3])]=$(roles[k])" for k in 1:3], ", "))
    end
end

function check_open_on_same_print()
    println("\nNotice on Cycle #15 (L | D | L | B L | D | L | B2 D | L | D | B D):")
    println("  - Edges 0->1..->9 (open 0..9 from printed state, setup=0): 9 edges, 7 at 1 HTM, 2 at 2 HTM = 11 HTM (only 2 preps)!")
    println("  - Edge 9->0 (wrap back to exact printed state): B D (2 HTM, 1 prep), completing the 13-HTM closed cycle!")
end

# Can a SINGLE print support BOTH:
#   Mode 1 (closed): 10-edge exact-closed cycle (0..9->0) in 13 HTM (7x 1-HTM, 3x 2-HTM B-prep)
#   Mode 2 (wrap11 / open10): 10-edge display-wrapped run in 11 HTM (1 prep) OR 9-edge open run in 10 HTM (1 prep)?
# Wait: Let's check! In Mode 1 (13-HTM closed cycle), the 10 digit stickers are at fixed facelets D_0..D_9
# in HOME_STATE.
# If Mode 2 starts from some setup state S_0 (reached from HOME_STATE by a setup word `W_setup`),
# then in S_0, some 24-perm of the home stickers is present.
# Wait: Any valid 10-state walk (T_0, T_1, ..., T_9) defines 10 facelets in S_0 that visit IDX_LL at steps 0..9,
# and a set of facelets in S_0 that visit IDX_UL, IDX_UR, IDX_LR!
# When can the SAME physical print (with 10 digit stickers 0..9 and 14 blank stickers, or with up to 3 extra duplicate digit stickers on unvisited facelets!) serve BOTH walks?
# Walk 1 (from HOME_STATE) requires:
#   facelet a_d has digit `d` (for d = 0..9), and facelets in B_1 are blank.
# Walk 2 (started after setup g in G_2x2) requires:
#   in state g(HOME_STATE), the sticker at b_d has digit `d` (for d = 0..9), and stickers in g(B_2) are blank!
# If there are NO duplicate digits (each digit 0..9 appears on exactly 1 sticker, so a_d is the unique sticker for digit d),
# then Walk 2 works from setup state g iff for every d = 0..9, g sends sticker a_d to facelet b_d (with the right orientation, which is automatic because every facelet has a unique rotation to LL)!
# Wait: 10 facelets on >= 4 cubies being sent to b_0..b_9 by a cube element g means:
# In Walk 2, the tuple of (cubie, facelet_offset) of (b_0..b_9) must be conjugate under the 2x2x2 cube group G to (a_0..a_9)!

function search_dual_mode_print()
    println("\n=== Checking if a single 14-blank print (or with duplicate digits on the 3 free facelets) can run BOTH 13-HTM closed AND 10-HTM open ===")
    #Wait: In Cycle #15 (L | D | L | B L | D | L | B2 D | L | D | B D):
    # What if we check how many unvisited facelets exist in Cycle #15? 3 unvisited facelets!
    # Wait: even simpler! Look at Cycle #15 itself:
    # From the printed state (setup = 0 HTM!):
    #   Steps 0->1->2->3->4->5->6->7->8->9 take:
    #   L | D | L | B L | D | L | B2 D | L | D  (9 edges, 11 HTM: 7 edges at 1 HTM, 2 edges at 2 HTM!)
    #   And then step 9->0 takes:
    #   B D (1 edge, 2 HTM), closing the cycle in 13 HTM!
    # What if we also check all 23,088 1-prep open paths (10 HTM) to see how many stickers they leave free,
    # or check if any 1-prep 10-edge display-wrapped path (11 HTM) has a short return word to HOME_STATE?
    steps_B_all = [s for s in build_pre_steps() if s.only_B_prep]
    b0 = bit(HOME_STATE[IDX_UL]) | bit(HOME_STATE[IDX_UR]) | bit(HOME_STATE[IDX_LR])
    l0 = bit(HOME_STATE[IDX_LL])
    states = Vector{NTuple{24,Int}}(undef, 11)
    states[1] = HOME_STATE
    path = zeros(Int, 10)
    wrap_B = Vector{Vector{String}}()

    function dfs(depth::Int, ll_mask::UInt32, blank_mask::UInt32, preps::Int)
        if depth == 10
            rem = 1 - preps
            st = states[10]
            for (si, s) in enumerate(steps_B_all)
                s.prep_count > rem && continue
                nxt = apply_pull(st, s.pull)
                if nxt[IDX_LL] == HOME_STATE[IDX_LL]
                    b_new = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
                    if (b_new & ll_mask) == 0
                        path[10] = si
                        push!(wrap_B, [steps_B_all[path[k]].word for k in 1:10])
                    end
                end
            end
            return
        end
        st = states[depth]
        for (si, s) in enumerate(steps_B_all)
            preps + s.prep_count > 1 && continue
            nxt = apply_pull(st, s.pull)
            ll_s = nxt[IDX_LL]
            b_ll = bit(ll_s)
            (b_ll & (ll_mask | blank_mask)) != 0 && continue
            b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
            ll_mask2 = ll_mask | b_ll
            (b_bl & ll_mask2) != 0 && continue
            states[depth + 1] = nxt
            path[depth] = si
            dfs(depth + 1, ll_mask2, blank_mask | b_bl, preps + s.prep_count)
        end
    end
    dfs(1, l0, b0, 0)
    println("  Found $(length(wrap_B)) B-only 1-prep display-wrapped 10-edge paths (11 HTM total for 0..9->0)!")
    if !isempty(wrap_B)
        for i in 1:min(5, length(wrap_B))
            println("    Wrap #$i: ", join(wrap_B[i], " | "))
        end
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    find_all_13htm_B_cycles()
    inspect_cycle_print(["L", "D", "L", "B L", "D", "L", "B2 D", "L", "D", "B D"], "B-Prep Cycle #15 (L | D | L | B L | D | L | B2 D | L | D | B D)")
    check_open_on_same_print()
    search_dual_mode_print()
end
