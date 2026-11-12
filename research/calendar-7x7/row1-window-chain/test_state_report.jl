#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests of state_report.jl (state report of a chain: identical start/end states, repeated pairs, repeated configuration transitions).
# Julia 1.11.5: julia --startup-file=no test_state_report.jl   (about 10 s)
using Test
include(joinpath(@__DIR__,"state_report.jl"))
const R19=joinpath(@__DIR__,"evidence","root-2019")
h(c)=repeat(string(c),64)
# chain text with fake digests (the report reads digests only): months = chain months after the root, hashes = digests of states 0..n
function chain_text(root,months,hashes)
    ls=["cubistry.calendar7.chain.v1","source\t$(root[2])\t$(root[1])\t$(root[2])\t$(hashes[1])"]
    for (i,(y,m)) in enumerate(months);push!(ls,"edge\t$y\t$m\t1\t1\t0\t0\t$(hashes[i])\t$(hashes[i+1])","move\t1\t1","end");end
    join(vcat(ls,["finish"]),"\n")*"\n"
end
function run_report(raw;kw...)
    io=IOBuffer();r=report(raw;io=io,kw...);(r,String(take!(io)))
end
@testset "state report" begin
    @testset "counts on a chain with repeats" begin
        # states a b c d b c: edges a>b, b>c, c>d, d>b, b>c; months Feb/Fri/28 and Mar/Fri/31 of 2019 and 2030 have the same configurations
        raw=chain_text((2019,1),[(2019,2),(2019,3),(2030,1),(2030,2),(2030,3)],[h('a'),h('b'),h('c'),h('d'),h('b'),h('c')])
        r,txt=run_report(raw)
        @test r==(edges=5,starts=4,ends=3,pairs=4,repeated_pairs=1,transitions=3,repeated_transitions=2)
        @test occursin("edges\t5\n",txt) && occursin("states_distinct\t4\tof\t6\tstates_revisited\t2\n",txt)
        @test occursin("start_states_distinct\t4\tshared_by_several_edges\t1\tedges_involved\t2\n",txt)
        @test occursin("end_states_distinct\t3\tshared_by_several_edges\t2\tedges_involved\t4\n",txt)
        @test occursin("pairs_distinct\t4\trepeated_pairs\t1\tedges_involved\t2\n",txt)
        @test occursin("pair_repeated\t$(h('b'))\t$(h('c'))\t2\tedges\t2,5\n",txt)
        @test occursin("transitions_distinct\t3\trepeated_transitions\t2\tedges_involved\t4\n",txt)
        @test occursin("transition_repeated\tJan/Tue/31\tFeb/Fri/28\t2\tedges\t1,4\n",txt) && occursin("transition_repeated\tFeb/Fri/28\tMar/Fri/31\t2\tedges\t2,5\n",txt)
        @test occursin("transition_repeat_counts\t2 edges: 2 transitions\n",txt) && occursin("configs_occurring\t3\tof\t91\n",txt)
        @test occursin("null_edges\t0\t",txt)
        # an edge whose start equals its end
        r2,t2=run_report(chain_text((2019,1),[(2019,2),(2019,3)],[h('a'),h('a'),h('b')]))
        @test occursin("null_edges\t1\t",t2) && r2.repeated_pairs==0
    end
    @testset "fixtures of print C" begin
        for (name,last,cfgs) in (("exact-2019-03","2019-03",("Jan/Tue/31","Feb/Fri/28","Mar/Fri/31")),("best-effort-2026-02","2026-03",("Jan/Tue/31","Feb/Sun/28","Mar/Sun/31")))
            d=joinpath(R19,name);r,txt=run_report(read(joinpath(d,"moves.tsv"),String);statesdir=joinpath(d,"states"))
            @test r==(edges=2,starts=2,ends=2,pairs=2,repeated_pairs=0,transitions=2,repeated_transitions=0)
            @test occursin("months\t3\troot\t2019-01\tlast\t$last\n",txt) && occursin("states_distinct\t3\tof\t3\tstates_revisited\t0\n",txt)
            @test occursin("configs_occurring\t3\tof\t91\n",txt) && !occursin("transition_repeated",txt) && !occursin("pair_repeated",txt)
        end
    end
    @testset "command line" begin
        d=joinpath(R19,"best-effort-2026-02");julia=Base.julia_cmd()
        out=read(`bash $(joinpath(@__DIR__,"state_report.sh")) $(joinpath(d,"moves.tsv")) $(joinpath(d,"states")) $(first(julia.exec))`,String)
        @test out==run_report(read(joinpath(d,"moves.tsv"),String);statesdir=joinpath(d,"states"))[2]
        err=IOBuffer();ok=success(pipeline(ignorestatus(`$julia --startup-file=no $(joinpath(@__DIR__,"state_report.jl")) /nonexistent`);stdout=devnull,stderr=err))
        @test !ok && occursin("INVALID",String(take!(err)))
    end
    @testset "states directory" begin
        d=joinpath(R19,"exact-2019-03");raw=read(joinpath(d,"moves.tsv"),String)
        mktempdir() do t
            for f in readdir(joinpath(d,"states"));cp(joinpath(d,"states",f),joinpath(t,f));end
            s=read(joinpath(t,"state-02.tsv"),String);write(joinpath(t,"state-02.tsv"),replace(s,"\n1\t"=>"\n9\t";count=1))
            @test_throws "state file 2 differs" report(raw;statesdir=t,io=IOBuffer())
            rm(joinpath(t,"state-03.tsv"));write(joinpath(t,"state-02.tsv"),s)
            @test_throws "missing state file" report(raw;statesdir=t,io=IOBuffer())
        end
    end
    @testset "continuity" begin
        raw=chain_text((2019,1),[(2019,2),(2019,3)],[h('a'),h('b'),h('c')])
        @test_throws "starts where edge 1 ends" report(replace(raw,"\t$(h('b'))\t$(h('c'))"=>"\t$(h('d'))\t$(h('c'))");io=IOBuffer())
        @test_throws "no edge" report("cubistry.calendar7.chain.v1\nsource\t1\t2019\t1\t$(h('a'))\nfinish\nfinish\n";io=IOBuffer())
    end
end
