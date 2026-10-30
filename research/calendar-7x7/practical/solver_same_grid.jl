#!/usr/bin/env julia
# Bounded candidate experiment: nonleap February→March, no full-chain claim.
include(joinpath(@__DIR__,"solver_macros.jl"))

function experiment_same_grid(dag_path,outdir)
    mkpath(outdir)
    replay = replay_dag(dag_path)
    source = read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    goals = physical_targets("EN"); catalogs = macro_catalogues(replay.action)
    supported = Set(replay.action.keys[k] for k in keys(catalogs))
    cache = Dict{Int,Any}()
    open(joinpath(outdir,"same-grid-candidates.tsv"),"w") do io
        println(io,"year\tsource-id\tstatus\thtm\tqtm\tfile\treason")
        for year in 2026:2099
            isleapyear(year) && continue
            february = macro_calendar_target(year,2); march = macro_calendar_target(year,3)
            source_id = findfirst(t -> t.board == february.board,goals)
            @assert !isnothing(source_id)
            changed = Set(bodykey((c-4,4-r,3)) for r in 1:7 for c in 1:7 if february.board[r,c] != march.board[r,c])
            if !issubset(changed,supported)
                println(io,"$year\t$source_id\tUNKNOWN\t\t\t\tunsupported changed physical orbit")
                continue
            end
            if !haskey(cache,source_id)
                start = signed_perm(replay.registers,replay.targets[source_id])
                validate_front(decode_physical(source,start,replay.action),february)
                try
                    solution = macro_solve(source,start,march,replay.action,catalogs)
                    @assert compose(solution.state,macro_word_perm(macro_inverse(solution.word),[UInt16.(g) for g in replay.action.generators])) == start
                    cache[source_id] = (;solution,year)
                catch error
                    cache[source_id] = sprint(showerror,error)
                end
            end
            candidate = cache[source_id]
            if candidate isa String
                println(io,"$year\t$source_id\tUNKNOWN\t\t\t\tgreedy search failed")
                continue
            end
            solution = candidate.solution
            validate_front(decode_physical(source,solution.state,replay.action),march)
            filename = "feb-mar-$year.moves.tsv"
            open(joinpath(outdir,filename),"w") do moves
                println(moves,"cubistry.calendar7.practical.v1\nsource\t",source_id,"\ndestination\t",year,"\t3")
                for (g,q) in macro_moves(solution.word);println(moves,"move\t",g,'\t',q);end
            end
            println(io,"$year\t$source_id\tCANDIDATE\t",macro_htm(solution.word),'\t',length(solution.word),'\t',filename,"\tindependent native replay required")
        end
    end
    println("EXPERIMENTAL only: ",length(cache)," distinct supported source templates investigated; see same-grid-candidates.tsv.")
end

if abspath(PROGRAM_FILE) == @__FILE__
    @assert length(ARGS) == 2 "Usage: solver_same_grid.jl BASELINE_DAG OUTPUT_DIRECTORY"
    experiment_same_grid(ARGS...)
end
