# Constant Final Touching Move Analysis (`Always L'` vs `Always L` vs `Always L2`)
#
# Analyzes whether a 2x2x2 cube displaying 0..9 in r2c1 (LL = (-1, -1, 1))
# with UL, UR, LR blank can use the EXACT SAME final touching move T on every
# step (where each step has 0..2 preparing moves in {R, U, B} followed by T).

include("search.jl")

function invert_pull(p::NTuple{24,Int})::NTuple{24,Int}
    ip = zeros(Int, 24)
    for i in 1:24
        ip[p[i]] = i
    end
    return Tuple(ip)
end

function build_const_touch_steps(touch_name::String; max_preps::Int = 2)
    t = MOVE_BY_NAME[touch_name]
    steps = CompoundStep[]
    push!(steps, CompoundStep(t.name, 1, 0, t.face, true, occursin('2', t.name), t.pull, inv_tok(t.name)))
    if max_preps >= 1
        for p1 in PREP_MOVES
            pull1 = apply_pull(p1.pull, t.pull)
            w1 = p1.name * " " * t.name
            push!(steps, CompoundStep(w1, 2, 1, t.face, p1.face == 'B', occursin('2', w1), pull1, inv_w([p1.name, t.name])))
            if max_preps >= 2
                for p2 in PREP_MOVES
                    p1.face == p2.face && continue
                    pull2 = apply_pull(apply_pull(p1.pull, p2.pull), t.pull)
                    w2 = p1.name * " " * p2.name * " " * t.name
                    push!(steps, CompoundStep(w2, 3, 2, t.face, false, occursin('2', w2), pull2, inv_w([p1.name, p2.name, t.name])))
                end
            end
        end
    end
    sort!(steps, by = s -> (s.prep_count, !s.only_B_prep, s.has_half_turn, s.word))
    return steps
end

function verify_always_L_prime_impossibility()
    println("\n=== 1. Theorem Verification: Always-L' (and by symmetry Always-D) is UNSAT ===")
    cands_Lp = build_const_touch_steps("L'"; max_preps = 2)
    idx_ll_bottom = FACELET_IDX[((-1, -1, 1), (0, -1, 0))]

    all_send_ll_bottom_to_ul_front = all(s.pull[IDX_UL] == idx_ll_bottom for s in cands_Lp)
    println("  Every (0..2)-prep step `P* L'` sends LL-bottom ((-1,-1,1),(0,-1,0)) to UL-front ((-1,1,1),(0,0,1)): ",
            all_send_ll_bottom_to_ul_front)
    @assert all_send_ll_bottom_to_ul_front

    # Check chiral 3-cycles on each of the 8 corner cubies across all 3D rotations R in SO(3)
    sigma = Dict{Int, Int}()
    for (f_idx, (ci, p, n)) in enumerate(FACELETS)
        c_target = (-1, -1, 1)
        Rs = [R for R in ROTS if applyR(R, p) == c_target && applyR(R, n) == (0, 0, 1)]
        @assert length(Rs) == 1
        R = Rs[1]
        # Find which facelet of the same cubie `ci` lands at bottom normal (0, -1, 0) of LL
        bot_candidates = [
            j for (j, (cj, pj, nj)) in enumerate(FACELETS)
            if cj == ci && applyR(R, pj) == c_target && applyR(R, nj) == (0, -1, 0)
        ]
        @assert length(bot_candidates) == 1
        sigma[f_idx] = bot_candidates[1]
    end
    # Verify sigma is a union of eight 3-cycles (one per corner cubie)
    eight_3cycles = all(sigma[sigma[sigma[i]]] == i && sigma[i] != i for i in 1:24)
    println("  Unique chiral successor sigma(f) at LL-bottom verified as eight 3-cycles (one per cubie): ",
            eight_3cycles)
    @assert eight_3cycles

    # Exhaustive check that Always-L' with 0-prep or 1-prep reaches at most 8 transitions (0..8)
    cands_Lp_1 = build_const_touch_steps("L'"; max_preps = 1)
    b0 = bit(HOME_STATE[IDX_UL]) | bit(HOME_STATE[IDX_UR]) | bit(HOME_STATE[IDX_LR])
    l0 = bit(HOME_STATE[IDX_LL])
    max_edges = 0
    count_9edges = 0
    function dfs_max(d::Int, st::NTuple{24,Int}, ll_m::UInt32, bl_m::UInt32)
        edges = d - 1
        edges > max_edges && (max_edges = edges)
        if edges == 9
            count_9edges += 1
            return
        end
        for s in cands_Lp_1
            nxt = apply_pull(st, s.pull)
            b_ll = bit(nxt[IDX_LL])
            (b_ll & (ll_m | bl_m)) != 0 && continue
            b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
            ll_m2 = ll_m | b_ll
            (b_bl & ll_m2) != 0 && continue
            dfs_max(d + 1, nxt, ll_m2, bl_m | b_bl)
        end
    end
    dfs_max(1, HOME_STATE, l0, b0)
    println("  Exhaustive Always-L' tree search: max transitions = $max_edges (values 0..$max_edges), 9-edge (0..9) solutions = $count_9edges (UNSAT!)")
    @assert max_edges == 8 && count_9edges == 0
end

function search_always_L()
    b0 = bit(HOME_STATE[IDX_UL]) | bit(HOME_STATE[IDX_UR]) | bit(HOME_STATE[IDX_LR])
    l0 = bit(HOME_STATE[IDX_LL])

    for max_p in (1, 2)
        cands = build_const_touch_steps("L"; max_preps = max_p)
        println("\n=== 2.$(max_p) Always-'L' with <=$max_p prep(s)/step ($(length(cands)) step candidates) ===")
        states = Vector{NTuple{24,Int}}(undef, 11)
        states[1] = HOME_STATE
        path10 = zeros(Int, 10)

        found_open = false
        for budget in 0:10
            open_w = ""
            wrap_w = ""
            function dfs_ow(d::Int, ll_m::UInt32, bl_m::UInt32, pr::Int)
                if d == 10
                    isempty(open_w) && (open_w = join([cands[path10[k]].word for k in 1:9], " | "))
                    st = states[10]
                    for (si, s) in enumerate(cands)
                        pr + s.prep_count > budget && break
                        nxt = apply_pull(st, s.pull)
                        if nxt[IDX_LL] == HOME_STATE[IDX_LL]
                            b_new = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
                            if (b_new & ll_m) == 0 && isempty(wrap_w)
                                path10[10] = si
                                wrap_w = join([cands[path10[k]].word for k in 1:10], " | ")
                                return true
                            end
                        end
                    end
                    return false
                end
                st = states[d]
                for (si, s) in enumerate(cands)
                    pr + s.prep_count > budget && break
                    nxt = apply_pull(st, s.pull)
                    b_ll = bit(nxt[IDX_LL])
                    (b_ll & (ll_m | bl_m)) != 0 && continue
                    b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
                    ll_m2 = ll_m | b_ll
                    (b_bl & ll_m2) != 0 && continue
                    states[d + 1] = nxt
                    path10[d] = si
                    dfs_ow(d + 1, ll_m2, bl_m | b_bl, pr + s.prep_count) && return true
                end
                return false
            end
            dfs_ow(1, l0, b0, 0)
            if !isempty(open_w) && !found_open
                println("  Tight min Open 0..9 (9 edges): $budget preps ($(9 + budget) HTM) -> $open_w")
                found_open = true
            end
            if !isempty(wrap_w)
                println("  Tight min Wrapped 0..9->0 (10 edges): $budget preps ($(10 + budget) HTM) -> $wrap_w")
                break
            end
        end
    end

    # Check if an exact-closed 10-cycle exists for Always-L using B/U-only preps (25 candidates) up to 12 preps
    cands2 = build_const_touch_steps("L"; max_preps = 2)
    cands_ub = [s for s in cands2 if !occursin('R', s.word)]
    println("\n=== 3. Exact Full-State Closed 10-Cycle Search for Always-'L' (U/B preps, $(length(cands_ub)) candidates) ===")
    max_half = 6
    fwd = Dict{NTuple{24,Int}, Vector{Tuple{UInt32,UInt32,Int,NTuple{5,Int}}}}()
    path_f = zeros(Int, 5)
    function dfs_f(d::Int, st::NTuple{24,Int}, ll_m::UInt32, bl_m::UInt32, pr::Int)
        if d == 6
            vec = get!(fwd, st) do
                Tuple{UInt32,UInt32,Int,NTuple{5,Int}}[]
            end
            push!(vec, (ll_m, bl_m, pr, (path_f[1], path_f[2], path_f[3], path_f[4], path_f[5])))
            return
        end
        for (si, s) in enumerate(cands_ub)
            pr + s.prep_count > max_half && break
            nxt = apply_pull(st, s.pull)
            b_ll = bit(nxt[IDX_LL])
            (b_ll & (ll_m | bl_m)) != 0 && continue
            b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
            ll_m2 = ll_m | b_ll
            (b_bl & ll_m2) != 0 && continue
            path_f[d] = si
            dfs_f(d + 1, nxt, ll_m2, bl_m | b_bl, pr + s.prep_count)
        end
    end
    dfs_f(1, HOME_STATE, l0, b0, 0)
    println("  Indexed $(length(fwd)) forward 5-step states (U/B half-budget <= $max_half preps)")

    inv_pulls = [invert_pull(s.pull) for s in cands_ub]
    best_preps = 999
    best_w = ""
    path_b = zeros(Int, 5)
    function dfs_b(d::Int, st::NTuple{24,Int}, ll_m::UInt32, bl_m::UInt32, pr::Int)
        if d == 6
            if haskey(fwd, st)
                for (f_ll, f_bl, f_pr, f_path) in fwd[st]
                    tot = f_pr + pr
                    tot >= best_preps && continue
                    (f_ll & ll_m) != l0 && continue
                    all_ll = f_ll | ll_m
                    all_bl = f_bl | bl_m
                    if (all_ll & all_bl) == 0
                        words = [cands_ub[f_path[k]].word for k in 1:5]
                        append!(words, [cands_ub[path_b[k]].word for k in 5:-1:1])
                        best_preps = tot
                        best_w = join(words, " | ")
                        println("  Found Always-L exact-closed 10-cycle with $best_preps preps ($(10 + best_preps) HTM): $best_w")
                    end
                end
            end
            return
        end
        for (si, s) in enumerate(cands_ub)
            pr + s.prep_count > max_half && break
            pr + s.prep_count >= best_preps && break
            prv = apply_pull(st, inv_pulls[si])
            b_ll = bit(prv[IDX_LL])
            b_bl = bit(prv[IDX_UL]) | bit(prv[IDX_UR]) | bit(prv[IDX_LR])
            path_b[d] = si
            if d < 5
                (b_ll & (ll_m | bl_m)) != 0 && continue
                ll_m2 = ll_m | b_ll
                (b_bl & ll_m2) != 0 && continue
                dfs_b(d + 1, prv, ll_m2, bl_m | b_bl, pr + s.prep_count)
            else
                (b_bl & ll_m) != 0 && continue
                dfs_b(d + 1, prv, ll_m, bl_m | b_bl, pr + s.prep_count)
            end
        end
    end
    dfs_b(1, HOME_STATE, l0, b0, 0)
    println("  Best exact-closed 10-cycle (U/B half-budget <= $max_half): ",
            isempty(best_w) ? "none" : "$best_preps preps ($(10 + best_preps) HTM) -> $best_w")
end

function search_Lprime_plus_D()
    cands_Lp = build_const_touch_steps("L'"; max_preps = 2)
    cands_D  = build_const_touch_steps("D"; max_preps = 2)
    b0 = bit(HOME_STATE[IDX_UL]) | bit(HOME_STATE[IDX_UR]) | bit(HOME_STATE[IDX_LR])
    l0 = bit(HOME_STATE[IDX_LL])

    println("\n=== 4. Testing 8 steps of `P* L'` (0->8) + `P* D` for 8->9 (and 9->0) ===")
    states = Vector{NTuple{24,Int}}(undef, 11)
    states[1] = HOME_STATE
    path10 = zeros(Int, 10)
    found_open = false
    for budget in 0:10
        open_w = ""
        wrap_w = ""
        function dfs(d::Int, ll_m::UInt32, bl_m::UInt32, pr::Int)
            if d == 10
                isempty(open_w) && (open_w = join([(k <= 8 ? cands_Lp[path10[k]].word : cands_D[path10[k]].word) for k in 1:9], " | "))
                st = states[10]
                for (si, s) in enumerate(cands_D)
                    pr + s.prep_count > budget && break
                    nxt = apply_pull(st, s.pull)
                    if nxt[IDX_LL] == HOME_STATE[IDX_LL]
                        b_new = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
                        if (b_new & ll_m) == 0 && isempty(wrap_w)
                            path10[10] = si
                            wrap_w = join([(k <= 8 ? cands_Lp[path10[k]].word : cands_D[path10[k]].word) for k in 1:10], " | ")
                            return true
                        end
                    end
                end
                return false
            end
            st = states[d]
            cands = d <= 8 ? cands_Lp : cands_D
            for (si, s) in enumerate(cands)
                pr + s.prep_count > budget && break
                nxt = apply_pull(st, s.pull)
                b_ll = bit(nxt[IDX_LL])
                (b_ll & (ll_m | bl_m)) != 0 && continue
                b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
                ll_m2 = ll_m | b_ll
                (b_bl & ll_m2) != 0 && continue
                states[d + 1] = nxt
                path10[d] = si
                dfs(d + 1, ll_m2, bl_m | b_bl, pr + s.prep_count) && return true
            end
            return false
        end
        dfs(1, l0, b0, 0)
        if !isempty(open_w) && !found_open
            println("  8x(P* L') + 1x(P* D) Open 0..9: FOUND at $budget preps ($(9 + budget) HTM) -> $open_w")
            found_open = true
        end
        if !isempty(wrap_w)
            println("  8x(P* L') + 2x(P* D) Wrapped 0..9->0: FOUND at $budget preps ($(10 + budget) HTM) -> $wrap_w")
            break
        end
    end

    # Also check if 8x(P* L') + 2x(P* D) has an EXACT FULL-STATE CLOSED 10-CYCLE (Period 1)!
    println("\n=== 5. Exact Full-State Closed 10-Cycle Search for 8x(P* L') (0->8) + 2x(P* D) (8->9, 9->0) ===")
    max_half = 6
    fwd = Dict{NTuple{24,Int}, Vector{Tuple{UInt32,UInt32,Int,NTuple{5,Int}}}}()
    path_f = zeros(Int, 5)
    function dfs_f(d::Int, st::NTuple{24,Int}, ll_m::UInt32, bl_m::UInt32, pr::Int)
        if d == 6
            vec = get!(fwd, st) do
                Tuple{UInt32,UInt32,Int,NTuple{5,Int}}[]
            end
            push!(vec, (ll_m, bl_m, pr, (path_f[1], path_f[2], path_f[3], path_f[4], path_f[5])))
            return
        end
        for (si, s) in enumerate(cands_Lp)
            pr + s.prep_count > max_half && break
            nxt = apply_pull(st, s.pull)
            b_ll = bit(nxt[IDX_LL])
            (b_ll & (ll_m | bl_m)) != 0 && continue
            b_bl = bit(nxt[IDX_UL]) | bit(nxt[IDX_UR]) | bit(nxt[IDX_LR])
            ll_m2 = ll_m | b_ll
            (b_bl & ll_m2) != 0 && continue
            path_f[d] = si
            dfs_f(d + 1, nxt, ll_m2, bl_m | b_bl, pr + s.prep_count)
        end
    end
    dfs_f(1, HOME_STATE, l0, b0, 0)
    println("  Indexed $(length(fwd)) forward 5-step (all P* L') states")

    inv_Lp = [invert_pull(s.pull) for s in cands_Lp]
    inv_D  = [invert_pull(s.pull) for s in cands_D]
    best_preps = 999
    best_w = ""
    path_b = zeros(Int, 5)
    # Backward steps d=1 (edge 9->0: D), d=2 (edge 8->9: D), d=3,4,5 (edges 7->8, 6->7, 5->6: L')
    function dfs_b(d::Int, st::NTuple{24,Int}, ll_m::UInt32, bl_m::UInt32, pr::Int)
        if d == 6
            if haskey(fwd, st)
                for (f_ll, f_bl, f_pr, f_path) in fwd[st]
                    tot = f_pr + pr
                    tot >= best_preps && continue
                    (f_ll & ll_m) != l0 && continue
                    all_ll = f_ll | ll_m
                    all_bl = f_bl | bl_m
                    if (all_ll & all_bl) == 0
                        words = [cands_Lp[f_path[k]].word for k in 1:5]
                        append!(words, [cands_Lp[path_b[k]].word for k in 5:-1:3])
                        append!(words, [cands_D[path_b[k]].word for k in 2:-1:1])
                        best_preps = tot
                        best_w = join(words, " | ")
                        println("  Found 8x(P* L') + 2x(P* D) exact-closed 10-cycle with $best_preps preps ($(10 + best_preps) HTM): $best_w")
                    end
                end
            end
            return
        end
        cands_cur = d <= 2 ? cands_D : cands_Lp
        invs_cur  = d <= 2 ? inv_D   : inv_Lp
        for (si, s) in enumerate(cands_cur)
            pr + s.prep_count > max_half && break
            pr + s.prep_count >= best_preps && break
            prv = apply_pull(st, invs_cur[si])
            b_ll = bit(prv[IDX_LL])
            b_bl = bit(prv[IDX_UL]) | bit(prv[IDX_UR]) | bit(prv[IDX_LR])
            path_b[d] = si
            if d < 5
                (b_ll & (ll_m | bl_m)) != 0 && continue
                ll_m2 = ll_m | b_ll
                (b_bl & ll_m2) != 0 && continue
                dfs_b(d + 1, prv, ll_m2, bl_m | b_bl, pr + s.prep_count)
            else
                (b_bl & ll_m) != 0 && continue
                dfs_b(d + 1, prv, ll_m, bl_m | b_bl, pr + s.prep_count)
            end
        end
    end
    dfs_b(1, HOME_STATE, l0, b0, 0)
    println("  Best exact-closed 10-cycle for 8x(P* L') + 2x(P* D): ",
            isempty(best_w) ? "none" : "$best_preps preps ($(10 + best_preps) HTM) -> $best_w")
end

if abspath(PROGRAM_FILE) == @__FILE__
    verify_always_L_prime_impossibility()
    search_always_L()
    search_Lprime_plus_D()
end
