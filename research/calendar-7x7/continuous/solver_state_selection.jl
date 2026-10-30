#!/usr/bin/env julia
# Bounded one-edge lookahead: three legal hidden-state variants, not optimization proof.
include(joinpath(@__DIR__,"solver_chain.jl"))

function selection_hidden_macro(action,catalogs,k)
    front = [findfirst(p -> p[1] == (c-4,4-r,3),action.points)-24k+24
        for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3)) == action.keys[k]]
    candidates = [(key,word) for (key,word) in catalogs[k] if all(key[i] == i for i in front)]
    @assert !isempty(candidates)
    first(sort!(candidates;by=x -> (chain_metrics(x[2],action).htm,macro_htm(x[2]),x[2])))[2]
end

function selection_solve(source,start,target,action,catalogs)
    prefix = chain_core_prefix(source,start,target,action)
    solved = macro_solve(source,prefix.state,target,action,catalogs)
    word = macro_normalize(vcat(prefix.word,solved.word))
    @assert compose(start,macro_word_perm(word,[UInt16.(g) for g in action.generators])) == solved.state
    (;word,state=solved.state)
end

function selection_experiment(dag_path,outdir)
    mkpath(outdir)
    replay = replay_dag(dag_path);action = replay.action
    source = read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    catalogs = chain_catalogues(action); generators = [UInt16.(g) for g in action.generators]
    initial = signed_perm(replay.registers,replay.targets[2])
    march = macro_calendar_target(2026,3);april = macro_calendar_target(2026,4)
    first_edge = selection_solve(source,initial,march,action,catalogs)
    variants = [("baseline",Int[]),("hidden-corner",selection_hidden_macro(action,catalogs,1)),
        ("hidden-midge",selection_hidden_macro(action,catalogs,4)),
        ("hidden-axial-center",selection_hidden_macro(action,catalogs,7))]
    open(joinpath(outdir,"state-selection.tsv"),"w") do io
        println(io,"variant\tstatus\tfirst-htm\tnext-htm\tworst-htm\ttotal-htm\tseconds\tmarch-sha256\tapril-sha256\treason")
        for (name,hidden) in variants
            started=time_ns()
            state = compose(first_edge.state,macro_word_perm(hidden,generators))
            validate_front(decode_physical(source,state,action),march)
            @assert isempty(hidden) == (state == first_edge.state)
            first_word = macro_normalize(vcat(first_edge.word,hidden))
            first_metrics = chain_metrics(first_word,action)
            open(joinpath(outdir,"$name-prefix.moves.tsv"),"w") do prefix
                println(prefix,"cubistry.calendar7.practical.v1\nsource\t2\ndestination\t2026\t3")
                for (g,q) in macro_moves(first_word);println(prefix,"move\t",g,'\t',q);end
            end
            try
                second_edge = selection_solve(source,state,april,action,catalogs)
                @assert compose(second_edge.state,macro_word_perm(macro_inverse(second_edge.word),generators)) == state
                next_metrics=chain_metrics(second_edge.word,action)
                march_sha=state_digest(decode_physical(source,state,action));april_sha=state_digest(decode_physical(source,second_edge.state,action))
                println(io,join([name,"CANDIDATE",first_metrics.htm,next_metrics.htm,max(first_metrics.htm,next_metrics.htm),first_metrics.htm+next_metrics.htm,(time_ns()-started)/1e9,march_sha,april_sha,"independent native replay required"],'\t'))
                initial_sha=state_digest(decode_physical(source,initial,action))
                rows=String["cubistry.calendar7.chain.v1","source\t2\t2026\t2\t$initial_sha"]
                for (month,word,start_sha,end_sha) in [(3,first_word,initial_sha,march_sha),(4,second_edge.word,march_sha,april_sha)]
                    metrics=chain_metrics(word,action)
                    push!(rows,join(["edge",2026,month,metrics.htm,metrics.qtm,metrics.rotations,metrics.rotation_qtm,start_sha,end_sha],'\t'))
                    append!(rows,["move\t$g\t$q" for (g,q) in macro_moves(word)]);push!(rows,"end")
                end
                push!(rows,"finish");write(joinpath(outdir,"$name.moves.tsv"),join(rows,'\n')*"\n")
            catch exception
                println(io,join([name,"UNKNOWN",first_metrics.htm,"","","",(time_ns()-started)/1e9,state_digest(decode_physical(source,state,action)),"",chain_failure_class(exception)*": "*replace(sprint(showerror,exception),'\n'=>' ')],'\t'))
            end
        end
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    @assert length(ARGS)==2 "Usage: solver_state_selection.jl BASELINE_DAG OUTPUT_DIRECTORY"
    selection_experiment(ARGS...)
end
