#!/usr/bin/env julia
using Test
include(joinpath(@__DIR__, "verify.jl"))
include(joinpath(@__DIR__, "analyze_domain.jl"))

@testset "Executable protocol rejects malformed records" begin
    mktempdir() do dir
        path=joinpath(dir,"sequence.tsv")
        valid="cubistry.calendar7.practical.v1\nsource\t2\ndestination\t2026\t3\nmove\t1\t1\n"
        write(path,valid)
        @test read_sequence(path).moves == [(1,1)]
        for corrupt in (
            replace(valid,"v1"=>"v2"),
            replace(valid,"source\t2"=>"source\t0"),
            replace(valid,"source\t2"=>"source\t92"),
            replace(valid,"2026"=>"2100"),
            replace(valid,"2026\t3"=>"2026\t13"),
            replace(valid,"move\t1\t1"=>"move\t22\t1"),
            replace(valid,"move\t1\t1"=>"move\t1\t0"),
            replace(valid,"move\t1\t1"=>"move\t1\t3"),
            replace(valid,"move\t1\t1"=>"move\t01\t1"),
            replace(valid,"\n"=>"\r\n"),
            chop(valid), valid*"\n", valid*"source\t2\n")
            write(path,corrupt)
            @test_throws Exception read_sequence(path)
        end
    end
end

@testset "Native profile and move conventions" begin
    for goal in physical_targets("EN")
        @test calendar_art(Date(goal.year,goal.month,1)) == goal.board
        @test calendar_goal(goal.year,goal.month).board == goal.board
    end
    source=read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    action=pose_action()
    initial=decode_physical(source,identity_perm(),action)
    for g in 1:21, q in (-1,1,2)
        p=identity_perm()
        for _ in 1:mod(q,4);p=compose(p,UInt16.(action.generators[g]));end
        moved=direct_move(initial,g,q)
        @test moved==decode_physical(source,p,action)
        @test direct_move(moved,g,-q)==initial
    end
end

if !isempty(ARGS)
    @assert length(ARGS)==2 "Expected original DAG and candidate sequence"
    @testset "Finite transition and semantic corruption" begin
        dag,sequence=ARGS
        result=verify_sequence(dag,sequence)
        @test result.htm>0
        mktempdir() do dir
            path=joinpath(dir,"bad.tsv")
            raw=read(sequence,String)
            for corrupt in (
                replace(raw,r"move\t[^\n]+\n"=>"";count=1),
                replace(raw,"destination\t2026\t3"=>"destination\t2026\t4"))
                @test corrupt!=raw
                write(path,corrupt)
                @test_throws Exception verify_sequence(dag,path)
            end
        end
    end
end
