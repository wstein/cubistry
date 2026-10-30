#!/usr/bin/env julia
# Fixture mutation only. Native Julia and Flix independently decide acceptance.
include(joinpath(@__DIR__,"verify.jl"))

function write_chain(path,input,edges=input.edges)
    open(path,"w") do io
        println(io,"cubistry.calendar7.chain.v1")
        println(io,join(("source",input.root,input.year,input.month,input.hash),'\t'))
        for e in edges
            println(io,join(("edge",e.year,e.month,e.htm,e.qtm,e.rot,e.rotq,e.source_hash,e.end_hash),'\t'))
            for (g,q) in e.moves;println(io,"move\t",g,'\t',q);end
            println(io,"end")
        end
        println(io,"finish")
    end
end

function make_controls(dag_path,valid_path,outdir)
    mkpath(outdir);input=read_chain(valid_path)
    @assert (input.year,input.month)==(2026,1) && length(input.edges)==2
    first_edge,second_edge=input.edges
    raw=read(valid_path,String)
    proof=replay_dag(dag_path;require_full=false)
    printing=read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    original=decode_physical(printing,signed_perm(proof.registers,proof.targets[input.root]),proof.action)
    canonical_feb=decode_physical(printing,signed_perm(proof.registers,proof.targets[2]),proof.action)
    @assert state_digest(canonical_feb)!=second_edge.source_hash
    write_chain(joinpath(outdir,"source-substitution.tsv"),input,
        [first_edge,merge(second_edge,(source_hash=state_digest(canonical_feb),))])

    lines=split(raw,'\n');second_header=findlast(s->startswith(s,"edge\t"),lines)
    insert!(lines,second_header,"source\t2\t2026\t2\t"*state_digest(canonical_feb))
    write(joinpath(outdir,"hidden-reset-record.tsv"),join(lines,'\n'))

    r1=read_sequence(joinpath(@__DIR__,"..","practical","evidence","feb-mar-2026.tsv"))
    canonical_end=foldl((s,move)->direct_move(s,move...),r1.moves;init=canonical_feb)
    metrics=chain_metrics(r1.moves)
    tail=merge(second_edge,(moves=r1.moves,htm=metrics[1],qtm=metrics[2],rot=metrics[3],rotq=metrics[4],end_hash=state_digest(canonical_end)))
    write_chain(joinpath(outdir,"canonical-tail-hidden-reset.tsv"),input,[first_edge,tail])

    write_chain(joinpath(outdir,"corrupted-intermediate.tsv"),input,
        [merge(first_edge,(end_hash=repeat("0",64),)),second_edge])
    moved=foldl((s,move)->direct_move(s,move...),first_edge.moves;init=original)
    wrong_up=direct_move(moved,20,1) # Legal front quarter turn; wrong artwork orientation.
    wrong_moves=vcat(first_edge.moves,[(20,1)]);wrong_metrics=chain_metrics(wrong_moves)
    changed=merge(first_edge,(moves=wrong_moves,htm=wrong_metrics[1],qtm=wrong_metrics[2],rot=wrong_metrics[3],rotq=wrong_metrics[4],end_hash=state_digest(wrong_up)))
    write_chain(joinpath(outdir,"incorrect-artwork-orientation.tsv"),input,
        [changed,merge(second_edge,(source_hash=changed.end_hash,))])

    bad_moves=copy(first_edge.moves);index=findfirst(m->m[1]%7!=0 && abs(m[2])==1,bad_moves)
    @assert !isnothing(index)
    g,q=bad_moves[index];bad_moves[index]=(g,-q)
    @assert chain_metrics(bad_moves)==chain_metrics(first_edge.moves)
    write_chain(joinpath(outdir,"incorrect-moves.tsv"),input,
        [merge(first_edge,(moves=bad_moves,)),second_edge])
    write_chain(joinpath(outdir,"incorrect-metrics.tsv"),input,
        [merge(first_edge,(htm=first_edge.htm+1,)),second_edge])
    write_chain(joinpath(outdir,"incorrect-chronology.tsv"),input,
        [merge(first_edge,(month=1,)),second_edge])
    write_chain(joinpath(outdir,"incorrect-initial-root.tsv"),merge(input,(root=2,)))
    println("Generated9 raw rejection controls; independent native decisions required.")
end

if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==3 "Expected DAG, January chain and output directory"
    make_controls(ARGS...)
end
