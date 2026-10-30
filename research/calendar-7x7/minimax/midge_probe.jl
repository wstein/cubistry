include(joinpath(@__DIR__,"search.jl"))
@eval Minimax begin
function midge_probe(dag,out)
    mkpath(out);proof=P.replay_dag(dag);action=proof.action;a=Algebra(action)
    source=P.read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    cache=cached_catalogues(action,a;relax_budget=60000)
    prefix=V.read_sequence(joinpath(@__DIR__,"..","continuous","evidence","state-selection","hidden-midge-prefix.moves.tsv"))
    start=P.signed_perm(proof.registers,proof.targets[prefix.source])
    first_word=expand(prefix.moves);middle=P.compose(start,P.macro_word_perm(first_word,a.generators))
    P.validate_front(P.decode_physical(source,middle,action),P.macro_calendar_target(2026,3))
    target=P.macro_calendar_target(2026,4)
    frame=P.chain_core_prefix(source,middle,target,action)
    occupants=Tuple(P.invert(frame.state)[73:96])
    constraints=P.macro_front_constraints(source,target,action,4)
    monotonic=greedy(occupants,constraints,cache[4])
    println("midge_greedy\t",isnothing(monotonic) ? "UNKNOWN_LOCAL_PLATEAU" : "CANDIDATE")
    started=time_ns()
    try
        result=solve_month(source,middle,target,action,cache,a;width=8,budget=100000)
        @assert P.compose(middle,P.macro_word_perm(result.word,a.generators))==result.state
        input=V.read_chain(joinpath(@__DIR__,"..","continuous","evidence","chain-2.moves.tsv"))
        hs=[(input.hash,P.state_digest(P.decode_physical(source,middle,action))),
            (P.state_digest(P.decode_physical(source,middle,action)),P.state_digest(P.decode_physical(source,result.state,action)))]
        export_chain(joinpath(out,"midge-recovery.moves.tsv"),input,[first_word,result.word],action;hashes=hs)
        println("probe\tCANDIDATE\t",htm(first_word),'\t',htm(result.word),'\t',(time_ns()-started)/1e9)
    catch ex
        println("probe\tUNKNOWN\t",replace(sprint(showerror,ex),'\n'=>' '))
    end
end
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==2
    Minimax.midge_probe(ARGS...)
end
