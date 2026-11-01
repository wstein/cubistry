#!/usr/bin/env julia
# UNTRUSTED state synthesizer (candidate generator only; the checkers decide).
# For each requested month: if the PR #99 state of its display already shows the new
# display under the new print, its root is kept; otherwise the PR #130 global beam
# search (unchanged module, goal = all 49 front cells, don't-care elsewhere) looks for
# a legal word from that state, and the word is appended to the DAG as primitive
# products. Usage: synth.jl DAG PRINT YEAR OUT_DAG OUT_LOG [months...] [key=value search options]
include(joinpath(@__DIR__,"pure_common.jl"))
include(joinpath(@__DIR__,"..","global-search","search.jl"))
include(joinpath(@__DIR__,"orbit_solve.jl"))
const G=GlobalSearch
function synth(dag_path,print_path,year,out_dag,out_log,months,opts)
    goals=stacked_goals(PURE_VARIANT);old=physical_targets("EN")
    index=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(old))
    proof=G.P.replay_dag(dag_path);action=proof.action;a=G.M.Algebra(action)
    source=G.P.read_physical(print_path)
    params,spec,_=G.parse_options(opts)
    library=G.build_library(action,a,spec)
    catalogs=G.P.chain_catalogues(action)
    gens=[UInt16.(g) for g in action.generators]
    nreg=length(proof.registers);appended=String[];roots=copy(proof.targets)
    open(out_log,"w") do log
        println(log,"year\tmonth\ttarget\tstatus\thtm\tword\tseconds")
        found=Dict{Int,Any}()
        for m in months
            id=index[join(string.(wrapped_board(year,m)),"|")];target=(year=year,month=m,board=goals[id].board)
            start=G.P.signed_perm(proof.registers,proof.targets[id])
            ok=try;G.P.validate_front(G.P.decode_physical(source,start,action),target);true;catch;false;end
            if ok
                found[m]=(state=start,ref=proof.targets[id])
                println(log,join([year,m,id,"KEPT",0,"-","-"],'\t'));flush(log);continue
            end
            t0=time()
            # First from the PR #99 state of the same display; if the beam fails, from the
            # new or kept states of the other months handled so far (nearest month first).
            starts=[(0,start,proof.targets[id])]
            for mm in sort(collect(keys(found));by=x->(abs(x-m),x));push!(starts,(mm,found[mm].state,found[mm].ref));end
            r=nothing;origin=0;ref=0;method="GLOBAL"
            for (j,(mm,st,rf)) in enumerate(starts)
                r=G.search_edge(source,st,target,action,a,library,params)
                if !isnothing(r.word);origin=mm;ref=rf;break;end
                println(log,join([year,m,id,"STALLED_FROM_"*(mm==0 ? "PR99" : string(mm)),-1,"wrong="*join(r.stall,','),"-"],'\t'));flush(log)
                if j==1
                    # Fallback: the planner's orbit-by-orbit catalogue solve from the same state.
                    o=orbit_solve(G.P,source,st,target,action,catalogs)
                    if !isnothing(o)
                        r=(word=o.word,state=o.state,htm=G.M.htm(o.word));origin=mm;ref=rf;method="ORBIT";break
                    end
                    println(log,join([year,m,id,"ORBIT_SOLVE_STALLED_FROM_PR99",-1,"-","-"],'\t'));flush(log)
                end
            end
            if isnothing(r.word)
                println(log,join([year,m,id,"UNKNOWN_"*uppercase(string(r.status)),-1,"-","-"],'\t'));flush(log);continue
            end
            for g in r.word
                nreg+=1;push!(appended,"product\t$nreg\t$ref\t$g");ref=nreg
            end
            roots[id]=ref;found[m]=(state=r.state,ref=ref)
            println(log,join([year,m,id,"FOUND_"*method*"_FROM_"*(origin==0 ? "PR99" : string(origin)),r.htm,join(r.word,','),string(round(time()-t0;digits=1))*"s"],'\t'));flush(log)
        end
    end
    lines=readlines(dag_path);prefix=filter(l->!startswith(l,"result\t"),lines)
    open(out_dag,"w") do io
        for l in prefix;println(io,l);end
        for l in appended;println(io,l);end
        for id in 1:91;println(io,"result\t$id\t$(roots[id])");end
    end
end
rest=ARGS[6:end]
synth(ARGS[1],ARGS[2],parse(Int,ARGS[3]),ARGS[4],ARGS[5],[parse(Int,x) for x in rest if !occursin('=',x)],[x for x in rest if occursin('=',x)])
