#!/usr/bin/env julia
# Candidate generation only. Continuous raw chains need independent native replay.
include(joinpath(@__DIR__,"..","practical","solver_macros.jl"))

function chain_alphabet(action)
    words = [[i] for i in 1:21]
    generators = [UInt16.(g) for g in action.generators]
    for axis in 1:3
        global_index = findfirst(==((axis,99)),action.moves)
        word = vcat(global_index,[-i for (i,(ax,layer)) in enumerate(action.moves) if ax == axis && layer != 99])
        push!(words,word); push!(generators,macro_word_perm(word,generators))
    end
    (;words,generators)
end

function chain_catalogues(action)
    alphabet = chain_alphabet(action); catalogs = Dict(k => Dict{MacroKey,Vector{Int}}() for k in 1:10)
    for a in 1:24, b in 1:24, c in 1:24
        length(unique((a,b,c))) == 3 || continue
        word = [a,b,-a,c,a,-b,-a,-c]
        p = macro_word_perm(word,alphabet.generators)
        affected = [k for k in 1:11 if any(p[i] != i for i in (24k-23):24k)]
        length(affected) == 1 || continue
        k = only(affected); k <= 10 || continue
        support = count(i -> p[i] != i,(24k-23):24k)
        support == (k == 1 ? 9 : k == 4 ? 6 : 3) || continue
        key = Tuple(UInt8.(p[(24k-23):24k] .- (24k-24)))
        expanded = reduce(vcat,(g < 0 ? macro_inverse(alphabet.words[-g]) : alphabet.words[g] for g in word);init=Int[])
        if !haskey(catalogs[k],key) || macro_htm(expanded) < macro_htm(catalogs[k][key])
            catalogs[k][key] = expanded
        end
    end
    legal = [i for i in 1:24 if !(i in (7,14,21))]
    for k in 1:10
        catalog = catalogs[k]; @assert !isempty(catalog) "UNSUPPORTED: no seed for orbit $k"
        queue = sort!(collect(keys(catalog))); cursor = 1
        localgens = [Tuple(Int.(g[(24k-23):24k] .- (24k-24))) for g in alphabet.generators]
        localinverses = [invperm(collect(g)) for g in localgens]
        while cursor <= length(queue)
            key = queue[cursor]; cursor += 1
            for g in legal, s in (-1,1)
                setup = s == 1 ? localgens[g] : localinverses[g]
                back = s == 1 ? localinverses[g] : localgens[g]
                conjugate = ntuple(i -> UInt8(back[key[setup[i]]]),24)
                haskey(catalog,conjugate) && continue
                setupword = s == 1 ? alphabet.words[g] : macro_inverse(alphabet.words[g])
                catalog[conjugate] = vcat(setupword,catalog[key],macro_inverse(setupword))
                push!(queue,conjugate)
            end
        end
        println(stderr,"chain catalog orbit=",k," count=",length(catalog))
    end
    catalogs
end

function chain_core_prefix(source,start,target,action)
    generators = [UInt16.(g) for g in action.generators]
    core = macro_front_constraints(source,target,action,11)
    queue = [(identity_perm(),Int[])]
    seen = Set{Tuple}(); choices = Any[]; cursor = 1
    target_keys = [image_normal(target.board[r,c][1],0,target.board[r,c][2]) for r in 1:7 for c in 1:7]
    while cursor <= length(queue)
        p,word = queue[cursor]; cursor += 1
        signature = Tuple(p[241:264]); signature in seen && continue; push!(seen,signature)
        state = compose(start,p); occupants = invert(state)[241:264]
        if all(occupants[i] in allowed for (i,allowed) in core)
            decoded = decode_physical(source,state,action)
            score = 0
            for r in 1:7,c in 1:7
                pos = (c-4,4-r,3); sticker = only(filter(s -> s.pos == pos && s.normal == FRONT_NORMAL,decoded))
                q = findfirst(==(sticker.up),IMAGE_UPS)-1
                score += image_normal(sticker.text,q,sticker.ink) == target_keys[(r-1)*7+c]
            end
            push!(choices,(score=score,word=word,state=state))
        end
        for g in (7,14,21);push!(queue,(compose(p,generators[g]),vcat(word,g)));end
    end
    @assert length(seen) == 24
    isempty(choices) && error("UNSUPPORTED: no whole-cube frame matches target core artwork")
    first(sort!(choices;by=x -> (-x.score,length(x.word),x.word)))
end

function chain_metrics(word,action)
    moves = macro_moves(word)
    rotations = [(g,q) for (g,q) in moves if action.moves[g][2] == 99]
    turns = [(g,q) for (g,q) in moves if action.moves[g][2] != 99]
    (htm=length(turns),qtm=sum(abs(q) for (_,q) in turns;init=0),rotations=length(rotations),rotation_qtm=sum(abs(q) for (_,q) in rotations;init=0))
end

function chain_failure_class(exception)
    message = sprint(showerror,exception)
    startswith(message,"UNSUPPORTED:") && return "UNSUPPORTED_SOLVER"
    occursin("Bounded macro search stalled",message) && return "SEARCH_BUDGET_EXHAUSTED"
    exception isa AssertionError && return "CANDIDATE_VERIFICATION_FAILURE"
    "IMPLEMENTATION_ERROR"
end

function chain_generate(dag_path,outdir;cases=[[(2026,1),(2026,2),(2026,3)],[(2026,2),(2026,3),(2026,4)],[(2026,11),(2026,12),(2027,1)],[(2028,2),(2028,3),(2028,4)]])
    mkpath(outdir)
    replay = replay_dag(dag_path); action = replay.action
    source = read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    goals = physical_targets("EN"); catalogs = chain_catalogues(action)
    open(joinpath(outdir,"attempts.tsv"),"w") do attempts
        println(attempts,"chain\tfrom\tto\tstatus\thtm\tqtm\trotations\tseconds\tsource-sha256\tend-sha256\treason")
        for (case_id,dates) in enumerate(cases)
            initial = macro_calendar_target(dates[1]...)
            source_id = findfirst(t -> t.board == initial.board,goals); @assert !isnothing(source_id)
            state = signed_perm(replay.registers,replay.targets[source_id])
            validate_front(decode_physical(source,state,action),initial)
            initial_sha = state_digest(decode_physical(source,state,action))
            rows = String["cubistry.calendar7.chain.v1","source\t$source_id\t$(dates[1][1])\t$(dates[1][2])\t$initial_sha"]
            successful = 0
            for edge in 2:length(dates)
                target = macro_calendar_target(dates[edge]...)
                start_sha = state_digest(decode_physical(source,state,action)); started = time_ns()
                try
                    prefix = chain_core_prefix(source,state,target,action)
                    solution = macro_solve(source,prefix.state,target,action,catalogs)
                    word = macro_normalize(vcat(prefix.word,solution.word))
                    result = compose(state,macro_word_perm(word,[UInt16.(g) for g in action.generators]))
                    @assert result == solution.state
                    @assert compose(result,macro_word_perm(macro_inverse(word),[UInt16.(g) for g in action.generators])) == state
                    validate_front(decode_physical(source,result,action),target)
                    end_sha = state_digest(decode_physical(source,result,action)); metrics = chain_metrics(word,action)
                    elapsed = (time_ns()-started)/1e9
                    println(attempts,join([case_id,join(dates[edge-1],'-'),join(dates[edge],'-'),"CANDIDATE",metrics.htm,metrics.qtm,metrics.rotations,elapsed,start_sha,end_sha,"independent native replay required"],'\t'))
                    push!(rows,join(["edge",dates[edge]...,metrics.htm,metrics.qtm,metrics.rotations,metrics.rotation_qtm,start_sha,end_sha],'\t'))
                    append!(rows,["move\t$g\t$q" for (g,q) in macro_moves(word)]);push!(rows,"end")
                    state = result; successful += 1
                catch exception
                    reason = chain_failure_class(exception)*": "*sprint(showerror,exception)
                    println(attempts,join([case_id,join(dates[edge-1],'-'),join(dates[edge],'-'),"UNKNOWN","","","",(time_ns()-started)/1e9,start_sha,"",replace(reason,'\n'=>' ')],'\t'))
                    break
                end
            end
            if successful >= 2
                push!(rows,"finish")
                write(joinpath(outdir,"chain-$case_id.moves.tsv"),join(rows,'\n')*"\n")
            end
        end
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    @assert length(ARGS) == 2 "Usage: solver_chain.jl BASELINE_DAG OUTPUT_DIRECTORY"
    chain_generate(ARGS...)
end
