include(joinpath(@__DIR__,"search.jl"))
@eval Minimax begin
function chain_beam(dag,out;relax_budget=60000,width=8,budget=100000,chain_width=2,cases=(3,2,1,4))
    @assert chain_width>0 && all(i in 1:4 for i in cases)
    mkpath(out);proof=P.replay_dag(dag);action=proof.action;a=Algebra(action)
    source=P.read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    cache=cached_catalogues(action,a;relax_budget)
    open(joinpath(out,"attempts.tsv"),"w") do log
        println(log,"chain\tedge\tvariant\tstatus\thtm\tseconds\treason")
        for i in cases
            input=V.read_chain(joinpath(@__DIR__,"..","continuous","evidence","chain-$i.moves.tsv"))
            first=P.signed_perm(proof.registers,proof.targets[input.root])
            paths=[(state=first,words=Vector{Int}[],hashes=Tuple{String,String}[],costs=Int[])]
            for (j,e) in enumerate(input.edges)
                next=Any[];seen=Set{Tuple}()
                for (n,path) in enumerate(paths),weight in (1,2)
                    started=time_ns()
                    try
                        result=solve_month(source,path.state,P.macro_calendar_target(e.year,e.month),action,cache,a;width,budget,weight)
                        @assert P.compose(path.state,P.macro_word_perm(result.word,a.generators))==result.state
                        signature=Tuple(result.state)
                        if signature in seen
                            println(log,join((i,j,"$n/$weight","DUPLICATE",htm(result.word),(time_ns()-started)/1e9,"same complete physical endpoint"),'\t'));flush(log)
                            continue
                        end
                        push!(seen,signature)
                        before=P.state_digest(P.decode_physical(source,path.state,action))
                        after=P.state_digest(P.decode_physical(source,result.state,action))
                        push!(next,(state=result.state,words=vcat(path.words,[result.word]),
                            hashes=vcat(path.hashes,[(before,after)]),costs=vcat(path.costs,htm(result.word))))
                        println(log,join((i,j,"$n/$weight","CANDIDATE",htm(result.word),(time_ns()-started)/1e9,"native verification required"),'\t'));flush(log)
                    catch ex
                        println(log,join((i,j,"$n/$weight","UNKNOWN","",(time_ns()-started)/1e9,replace(sprint(showerror,ex),'\n'=>' ')),'\t'));flush(log)
                    end
                end
                isempty(next) && (empty!(paths);break)
                sort!(next;by=p->(maximum(p.costs),sum(p.costs),Tuple(p.state)))
                paths=next[1:min(chain_width,length(next))]
            end
            # Always retain the complete certified R2 trajectory as an incumbent.
            baseline=[improve_word(expand(e.moves),a) for e in input.edges]
            baseline_costs=htm.(baseline)
            if isempty(paths)
                export_chain(joinpath(out,"chain-$i.moves.tsv"),input,baseline,action)
                println("selection\t",i,"\tR2_FALLBACK_UNKNOWN\t",join(baseline_costs,','))
                continue
            end
            selected=paths[1]
            if (maximum(baseline_costs),sum(baseline_costs)) <= (maximum(selected.costs),sum(selected.costs))
                export_chain(joinpath(out,"chain-$i.moves.tsv"),input,baseline,action)
                println("selection\t",i,"\tR2_ENDPOINT_PRESERVING\t",join(baseline_costs,','))
            else
                export_chain(joinpath(out,"chain-$i.moves.tsv"),input,selected.words,action;hashes=selected.hashes)
                println("selection\t",i,"\tMINIMAX_CANDIDATE\t",join(selected.costs,','))
            end
        end
    end
end
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS) in (5,6) "DAG OUT WIDTH NODE_BUDGET CHAIN_WIDTH [CASE]"
    stats=@timed Minimax.chain_beam(ARGS[1],ARGS[2];width=parse(Int,ARGS[3]),budget=parse(Int,ARGS[4]),chain_width=parse(Int,ARGS[5]),cases=length(ARGS)==6 ? (parse(Int,ARGS[6]),) : (3,2,1,4))
    println("resources\t",stats.time,'\t',stats.bytes,'\t',stats.gctime,'\t',Sys.maxrss())
end
