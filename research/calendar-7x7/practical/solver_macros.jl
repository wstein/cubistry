#!/usr/bin/env julia
# Candidate generator only; replay must be independently checked in Julia and Flix.
include(joinpath(@__DIR__, "..", "english", "replay_legal.jl"))

const MacroKey = NTuple{24,UInt8}
macro_inverse(w) = -reverse(w)
function macro_normalize(w)
    groups = Tuple{Int,Int}[]
    for g in w
        generator = abs(g); turns = sign(g)
        if !isempty(groups) && first(last(groups)) == generator
            turns += last(pop!(groups))
        end
        turns = mod(turns,4)
        turns != 0 && push!(groups,(generator,turns))
    end
    reduce(vcat, (turns == 3 ? [-g] : fill(g,turns) for (g,turns) in groups); init=Int[])
end
function macro_moves(w)
    normalized = macro_normalize(w); result = Tuple{Int,Int}[]; i = 1
    while i <= length(normalized)
        g = normalized[i]
        doubled = i < length(normalized) && g == normalized[i+1]
        push!(result,(abs(g),doubled ? 2 : sign(g)))
        i += doubled ? 2 : 1
    end
    result
end
macro_htm(w) = length(macro_moves(w))
function macro_word_perm(w, generators)
    p = identity_perm()
    for g in w
        p = compose(p, g < 0 ? invert(generators[-g]) : generators[g])
    end
    p
end
function macro_catalogues(action; orbits=[1,2,3])
    generators = [UInt16.(g) for g in action.generators]
    catalogs = Dict(k => Dict{MacroKey,Vector{Int}}() for k in orbits)
    # Every seed is a short legal commutator [a b a^-1, c].
    legal = [i for (i, (_,layer)) in enumerate(action.moves) if layer != 99]
    for a in legal, b in legal, c in legal
        length(unique((a,b,c))) == 3 || continue
        w = [a,b,-a,c,a,-b,-a,-c]
        p = macro_word_perm(w, generators)
        affected = [k for k in 1:11 if any(p[i] != i for i in (24k-23):24k)]
        length(affected) == 1 || continue
        k = only(affected); k in orbits || continue
        support = count(i -> p[i] != i, (24k-23):24k)
        support == (k == 1 ? 9 : 3) || continue
        key = Tuple(UInt8.(p[(24k-23):24k] .- (24k-24)))
        haskey(catalogs[k], key) || (catalogs[k][key] = w)
    end
    for k in orbits
        catalog = catalogs[k]
        queue = sort!(collect(keys(catalog))); cursor = 1
        localgens = [Tuple(Int.(g[(24k-23):24k] .- (24k-24))) for g in generators]
        localinverses = [invperm(collect(g)) for g in localgens]
        while cursor <= length(queue)
            key = queue[cursor]; cursor += 1
            for g in legal, s in (-1,1)
                setup = s == 1 ? localgens[g] : localinverses[g]
                back = s == 1 ? localinverses[g] : localgens[g]
                conjugate = ntuple(i -> UInt8(back[key[setup[i]]]), 24)
                haskey(catalog, conjugate) && continue
                catalog[conjugate] = vcat(s*g, catalog[key], -s*g)
                push!(queue, conjugate)
            end
        end
        println(stderr, "catalog orbit=", k, " count=", length(catalog))
    end
    catalogs
end

function macro_front_constraints(source, target, action, k)
    constraints = Tuple{Int,Set{UInt16}}[]
    for row in 1:7, col in 1:7
        pos = (col-4,4-row,3)
        bodykey(pos) == action.keys[k] || continue
        point = findfirst(p -> p[1] == pos, action.points)
        allowed = Set{UInt16}()
        for home in all_homes()
            bodykey(home) == action.keys[k] || continue
            stickers = filter(s -> s.home == home, source)
            for rotation in piece_options(stickers, home, pos, target.board[row,col])
                origin = tuple((inverse_rotate(v, rotation) for v in action.points[point])...)
                push!(allowed, UInt16(findfirst(==(origin), action.points)))
            end
        end
        @assert !isempty(allowed)
        push!(constraints, (point-24k+24, allowed))
    end
    constraints
end

function macro_solve(source, start, target, action, catalogs)
    state = copy(start); result = Int[]
    for k in sort!(collect(keys(catalogs)))
        constraints = macro_front_constraints(source, target, action, k)
        occupants = invert(state)[(24k-23):24k]
        score(v) = count(v[i] in allowed for (i,allowed) in constraints)
        candidates = [(key, invperm(Int.(collect(key))), macro_normalize(w))
            for (key,w) in sort!(collect(catalogs[k]); by=x -> (macro_htm(x[2]), x[2]))]
        for step in 1:24
            before = score(occupants)
            before == length(constraints) && break
            best = nothing; bestscore = before; bestcost = typemax(Int)
            for (key, inverse, word) in candidates
                after = score(occupants[inverse]); cost = macro_htm(word)
                if after > bestscore || (after == bestscore && after > before && cost < bestcost)
                    best = (key, inverse, word); bestscore = after; bestcost = cost
                end
            end
            # A bounded two-macro escape for corner assignments with shared artwork.
            if isnothing(best) && k == 1
                for (_, first_inverse, first_word) in candidates
                    intermediate = occupants[first_inverse]
                    score(intermediate) >= before-1 || continue
                    for (_, second_inverse, second_word) in candidates
                        cost = macro_htm(vcat(first_word,second_word))
                        cost < bestcost || continue
                        after = score(intermediate[second_inverse])
                        if after > before
                            best = (nothing,first_inverse[second_inverse],vcat(first_word,second_word))
                            bestscore = after; bestcost = cost
                        end
                    end
                end
            end
            isnothing(best) && error("Bounded macro search stalled in orbit $k at $before/$(length(constraints))")
            key, inverse, word = best
            occupants = occupants[inverse]
            state = compose(state, macro_word_perm(word, [UInt16.(g) for g in action.generators]))
            append!(result, word)
            println(stderr, "orbit=", k, " matched=", bestscore, "/", length(constraints), " added_htm=", bestcost)
        end
        @assert score(occupants) == length(constraints)
    end
    validate_front(decode_physical(source,state,action), target)
    (;word=macro_normalize(result), state)
end

function macro_calendar_target(year, month)
    @assert 2026 <= year <= 2099 && 1 <= month <= 12
    display = board(year,month,"EN";merge_six_nine=false)
    start = month <= 9 ? 5 : 1
    letters = collect(MONTHS["EN"][month])
    for col in 1:7
        display[1,col] = start <= col <= start+2 ? (string(letters[col-start+1]),"month") : ("","blank")
        text,ink = display[3,col]
        !isempty(text) && parse(Int,text) > 7 && (display[3,col] = (text*"↶",ink))
    end
    (;year,month,board=display)
end

function main_macros(dag_path, outdir; source_id=2, target_year=2026, target_month=3)
    started = time_ns()
    mkpath(outdir)
    replay = replay_dag(dag_path)
    source = read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    targets = physical_targets("EN")
    @assert haskey(replay.targets,source_id)
    target = macro_calendar_target(target_year,target_month)
    start = signed_perm(replay.registers, replay.targets[source_id])
    validate_front(decode_physical(source,start,replay.action), targets[source_id])
    loaded = time_ns()
    catalogs = macro_catalogues(replay.action)
    cataloged = time_ns()
    solution = macro_solve(source,start,target,replay.action,catalogs)
    filename = source_id == 2 && target_year == 2026 && target_month == 3 ? "feb-mar-2026.moves.tsv" : "transition-$source_id-$target_year-$target_month.moves.tsv"
    open(joinpath(outdir,filename),"w") do io
        println(io,"cubistry.calendar7.practical.v1")
        println(io,"source\t",source_id)
        println(io,"destination\t",target_year,'\t',target_month)
        for (g,q) in macro_moves(solution.word);println(io,"move\t",g,'\t',q);end
    end
    reverse_state = compose(solution.state, macro_word_perm(macro_inverse(solution.word), [UInt16.(g) for g in replay.action.generators]))
    @assert reverse_state == start
    println("Benchmark seconds: load=",(loaded-started)/1e9," catalog=",(cataloged-loaded)/1e9," solve=",(time_ns()-cataloged)/1e9)
    println("EXPERIMENTAL candidate: source=",source_id," destination=",target_year,'-',target_month,"; quarter-turns=",length(solution.word),"; HTM=",macro_htm(solution.word))
    println("Candidate endpoint SHA256=",state_digest(decode_physical(source,solution.state,replay.action)))
    println("UNKNOWN until independent Julia and Flix raw-input replay accept this finite word.")
end

if abspath(PROGRAM_FILE) == @__FILE__
    @assert length(ARGS) in (2,5) "Usage: solver_macros.jl BASELINE_DAG OUTPUT_DIRECTORY [SOURCE_ID YEAR MONTH]"
    if length(ARGS) == 2
        main_macros(ARGS...)
    else
        main_macros(ARGS[1],ARGS[2];source_id=parse(Int,ARGS[3]),target_year=parse(Int,ARGS[4]),target_month=parse(Int,ARGS[5]))
    end
end
