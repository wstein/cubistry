#!/usr/bin/env julia
using Test
include(joinpath(@__DIR__,"verify.jl"))

@testset "Chain grammar and declared metrics" begin
    mktempdir() do dir
        path=joinpath(dir,"input.tsv");hash=repeat("a",64)
        valid="cubistry.calendar7.chain.v1\nsource\t1\t2026\t1\t$hash\n"*
            "edge\t2026\t2\t1\t2\t1\t1\t$hash\t$hash\nmove\t1\t2\nmove\t7\t-1\nend\n"*
            "edge\t2026\t3\t0\t0\t0\t0\t$hash\t$hash\nend\nfinish\n"
        write(path,valid);parsed=read_chain(path)
        @test length(parsed.edges)==2
        @test chain_metrics(parsed.edges[1].moves)==(1,2,1,1,2)
        for bad in (
            replace(valid,"chain.v1"=>"chain.v2"),
            replace(valid,"source\t1"=>"source\t0"),
            replace(valid,"source\t1"=>"source\t01"),
            replace(valid,"2026\t1\t"=>"2100\t1\t"),
            replace(valid,"edge\t2026\t2"=>"edge\t2026\t13"),
            replace(valid,"2\t1\t2\t1\t1"=>"2\t-1\t2\t1\t1"),
            replace(valid,"move\t1\t2"=>"move\t22\t2"),
            replace(valid,"move\t1\t2"=>"move\t1\t0"),
            replace(valid,"move\t1\t2"=>"move\t1\t-2"),
            replace(valid,hash=>uppercase(hash)),
            replace(valid,hash=>hash[1:63]),
            replace(valid,"finish\n"=>"finish\nsource\t1\n"),
            replace(valid,"\n"=>"\r\n"),chop(valid),valid*"\n")
            @test bad!=valid
            write(path,bad);@test_throws Exception read_chain(path)
        end
    end
end

if !isempty(ARGS)
    @assert length(ARGS)==2 "Expected original DAG and January chain for orientation unit"
    @testset "Synthetic orientation-only corruption at target-validation seam" begin
        proof=replay_dag(ARGS[1];require_full=false);input=read_chain(ARGS[2])
        printing=read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
        state=decode_physical(printing,signed_perm(proof.registers,proof.targets[input.root]),proof.action)
        goal=calendar_goal(input.year,input.month)
        @test isnothing(validate_front(state,goal))
        # Deliberately synthetic: only one actual up vector changes. This is
        # a target-validation unit, not a legal reachability certificate.
        index=only(findall(s->s.pos==(-3,2,3) && s.normal==(0,0,1),state))
        corrupted=copy(state)
        corrupted[index]=merge(state[index],(up=turn_vector(state[index].up,3),))
        @test corrupted[index].up!=state[index].up
        @test all(merge(corrupted[i],(up=state[i].up,))==state[i] for i in eachindex(state))
        @test count(i->corrupted[i]!=state[i],eachindex(state))==1
        @test_throws Exception validate_front(corrupted,goal)
    end
end
