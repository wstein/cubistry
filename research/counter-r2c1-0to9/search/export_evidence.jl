# Export evidence files (print, setup, routes, and exact bound tables)
# for the 2x2x2 r2c1 (LL) 0..9 counter study.
include("search.jl")

# Build the tracked 4-front-corner BFS graph (136,080 states, diameter 7)
# identically to counter-99-blank-top/julia/check.jl
function trackedbfs()
    start = Tuple((c, Z) for c in CELLS)
    dist = Dict(start => 0)
    fr = [start]
    moves = [(a, q) for a in values(FACE) for q in 1:3]
    while !isempty(fr)
        nx = typeof(start)[]
        for t in fr, (a, q) in moves
            s = map(t) do (p, n)
                if dotp(p, a) > 0
                    for _ in 1:q; p = cw(p, a); n = cw(n, a); end
                end
                (p, n)
            end
            haskey(dist, s) || (dist[s] = dist[t] + 1; push!(nx, s))
        end
        fr = nx
    end
    return dist
end

struct StickerSpec
    pos::Vec
    nrm::Vec
    art::String
    up::Vec
end

function build_print_from_words(words::Vector{String})
    st = HOME_STATE
    states = Vector{NTuple{24,Int}}(undef, 10)
    for d in 1:10
        states[d] = st
        for tok in split(words[d], " ")
            st = apply_pull(st, MOVE_BY_NAME[tok].pull)
        end
    end
    digit_map = Dict{Int,String}()
    for d in 1:10
        s_id = states[d][IDX_LL]
        @assert !haskey(digit_map, s_id)
        digit_map[s_id] = string(d - 1)
    end
    specs = StickerSpec[]
    for i in 1:24
        _, p, n = FACELETS[i]
        if haskey(digit_map, i)
            u = home_up_for_LL(p, n)
            push!(specs, StickerSpec(p, n, digit_map[i], u))
        else
            push!(specs, StickerSpec(p, n, "blank", (0,0,0)))
        end
    end
    return specs
end

function acceptable(art::String, p::Vec, n::Vec, u::Vec, c::Vec, need::String)
    art == need || return false
    need == "blank" && return true
    Rs = [R for R in ROTS if applyR(R, p) == c && applyR(R, n) == Z]
    @assert length(Rs) == 1
    return applyR(Rs[1], u) == Y
end

function shortest_dist(dist, print::Vector{StickerSpec}, state::Vector{Tuple{Vec,Vec,Vec}}, v::Int)
    need = ["blank", "blank", string(v), "blank"]
    cands = [
        [(state[s][1], state[s][2]) for s in 1:24 if acceptable(print[s].art, state[s][1], state[s][2], state[s][3], CELLS[k], need[k])]
        for k in 1:4
    ]
    best = typemax(Int)
    for a in cands[1], b in cands[2], c in cands[3], d in cands[4]
        x = get(dist, (a, b, c, d), typemax(Int))
        x < best && (best = x)
    end
    return best
end

function turn_vec_state(state::Vector{Tuple{Vec,Vec,Vec}}, tok::AbstractString)
    fc = tok[1]
    a = FACE[fc]
    q = length(tok) == 1 ? 1 : tok[2] == '2' ? 2 : 3
    map(state) do (p, n, u)
        if dotp(p, a) > 0
            for _ in 1:q
                p = cw(p, a); n = cw(n, a); u = cw(u, a)
            end
        end
        (p, n, u)
    end
end

play_vec_word(state, w::AbstractString) = isempty(w) ? state : foldl(turn_vec_state, split(w, " "); init = state)

vecstr(v::Vec) = "$(v[1]),$(v[2]),$(v[3])"

function write_witness(ev_dir::String, mode::String, words::Vector{String}, dist)
    print_specs = build_print_from_words(words)
    # Write print-<mode>.tsv
    open(joinpath(ev_dir, "print-$mode.tsv"), "w") do io
        println(io, "sticker\tposition\tnormal\tartwork\tup")
        for (i, s) in enumerate(print_specs)
            up_s = s.art == "blank" ? "-" : vecstr(s.up)
            println(io, "$(i-1)\t$(vecstr(s.pos))\t$(vecstr(s.nrm))\t$(s.art)\t$up_s")
        end
    end
    # Write setup-<mode>.tsv
    open(joinpath(ev_dir, "setup-$mode.tsv"), "w") do io
        println(io, "mode\tsetup\thtm")
        println(io, "$mode\t\t0")
    end
    # Replay and write routes-<mode>.tsv
    state = [(s.pos, s.nrm, s.up) for s in print_specs]
    open(joinpath(ev_dir, "routes-$mode.tsv"), "w") do io
        println(io, "mode\tstep\tfrom\tto\tincrement\tinc_htm\tinc_prep\tinc_touch\tinc_shortest\tdecrement\tdec_htm\tdec_prep\tdec_touch\tdec_shortest")
        for i in 0:9
            v = i
            w = (i + 1) % 10
            inc_w = words[i + 1]
            toks = split(inc_w, " ")
            inc_htm = length(toks)
            inc_touch = count(t -> MOVE_BY_NAME[String(t)].touches_r2c1, toks)
            inc_prep = inc_htm - inc_touch
            @assert inc_touch == 1 && 0 <= inc_prep <= 2
            dec_w = inv_w(String.(toks))
            si = shortest_dist(dist, print_specs, state, w)
            next_state = play_vec_word(state, inc_w)
            sd = shortest_dist(dist, print_specs, next_state, v)
            println(io, "$mode\t$i\t$v\t$w\t$inc_w\t$inc_htm\t$inc_prep\t$inc_touch\t$si\t$dec_w\t$inc_htm\t$inc_prep\t$inc_touch\t$sd")
            state = next_state
        end
    end
    println("Wrote witness files for mode '$mode'.")
end

function main()
    ev_dir = joinpath(@__DIR__, "..", "evidence")
    mkpath(ev_dir)
    println("Building 136,080-state tracked 4-front-corner BFS table...")
    dist = trackedbfs()
    println("Tracked graph size: $(length(dist)), diameter: $(maximum(values(dist)))")

    # 1. Primary witness: `closed` (13 HTM exact-closed 10-cycle, 3 B-preps, 7 steps at 1 HTM, 3 steps at 2 HTM)
    words_closed = ["L", "D", "L", "B L", "D", "L", "B2 D", "L", "D", "B D"]
    write_witness(ev_dir, "closed", words_closed, dist)

    # 2. Secondary witness: `wrap1` (11 HTM display-wrapped 10-edge / 10 HTM open 9-edge, only 1 B-prep!)
    words_wrap1 = ["D", "D", "D", "L", "L", "D", "B D", "L", "L", "D"]
    write_witness(ev_dir, "wrap1", words_wrap1, dist)

    # 3. Write exact bound summary table `bounds-summary.tsv`
    open(joinpath(ev_dir, "bounds-summary.tsv"), "w") do io
        println(io, "prep_budget\tstep_model\tmax_displays_reached\topen_9edge_paths\tdisplay_wrap_10edge_paths\texact_closed_10cycles")
        println(io, "0\tP* T (L/D/F only)\t9\t0\t0\t0")
        println(io, "1\tP* T (B-only prep)\t10\t22368\t1928\t0")
        println(io, "1\tP* T (R/U/B prep)\t10\t23088\t2302\t0")
        println(io, "1\tP* T P* (any order)\t10\t46176\t4604\t0")
        println(io, "2\tP* T (R/U/B prep)\t10\t1577116\t213962\t0")
        println(io, "3\tP* T (B-only prep)\t10\t-\t-\t20")
        println(io, "3\tP* T (R/U/B prep)\t10\t-\t-\t127")
    end
    println("Wrote bounds-summary.tsv.")
end

main()

