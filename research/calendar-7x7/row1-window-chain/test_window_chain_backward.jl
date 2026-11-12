#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Logic tests of the backward mode of window_chain.jl that need no solver (window_chain_lib.jl): plan and root, the export of a search-order
# chain (identity pose = latest month, edges go to earlier months) to the forward-reading chain.v3 (free start = the search words in order,
# edges = reversed inverse words, ends at the identity pose), the import for `prior=`, state numbering and the month records of a
# decreasing plan. Julia 1.11.5: julia --startup-file=no test_window_chain_backward.jl (about 5 s).
using Test
const LIB=get(ENV,"CAL7_BACKWARD_LIB",joinpath(@__DIR__,"window_chain_lib.jl"))   # a mutated copy of the library in tests of this test
include(LIB)
using .WindowChainLib
ym=parse_ym
# A search-order chain: root (identity) 2041-01, three edges to 2037-02 (best-effort, wrong cell 7,1), 2037-01, 2036-12.
const SEARCH=["cubistry.calendar7.chain.v2","source\t1\t2041\t1\tD0",
    "edge\t2037\t2\t10\t12\t1\t2\tD0\tD1","wrong\t7\t1","hall\t7,1;7,7","move\t3\t1","move\t5\t2","end",
    "edge\t2037\t1\t4\t5\t0\t0\tD1\tD2","move\t2\t-1","end",
    "edge\t2036\t12\t6\t7\t0\t0\tD2\tD3","move\t9\t1","move\t4\t2","end","finish"]
const FORWARD=["cubistry.calendar7.chain.v3","source\t12\t2036\t12\tD3","start\t5","move\t3\t1","move\t5\t2","move\t2\t-1","move\t9\t1","move\t4\t2",
    "edge\t2037\t1\t6\t7\t0\t0\tD3\tD2","move\t4\t2","move\t9\t-1","end",
    "edge\t2037\t2\t4\t5\t0\t0\tD2\tD1","wrong\t7\t1","hall\t7,1;7,7","move\t2\t1","end",
    "edge\t2041\t1\t10\t12\t1\t2\tD1\tD0","move\t5\t2","move\t3\t-1","end","finish"]
@testset "backward mode logic" begin
    @testset "plan and root" begin
        S=[(2037,1),(2037,2),(2041,1)]
        @test backward_plan(S)==[(2041,1),(2037,2),(2037,1)]
        @test backward_root(S,"")==(2041,1)
        @test_throws "root_month must be empty" backward_root(S,"2041-01")
        @test_throws "root_month must be empty" backward_root(S,"2019-01")
        @test backward_plan([(2019,1)])==[(2019,1)]
    end
    @testset "export: forward-reading chain.v3" begin
        @test backward_export(SEARCH)==FORWARD
        v1=["cubistry.calendar7.chain.v1","source\t1\t2019\t1\tE0","edge\t2018\t12\t1\t1\t0\t0\tE0\tE1","move\t1\t1","end","finish"]
        e=backward_export(v1)
        @test e==["cubistry.calendar7.chain.v3","source\t12\t2018\t12\tE1","start\t1","move\t1\t1","edge\t2019\t1\t1\t1\t0\t0\tE1\tE0","move\t1\t-1","end","finish"]
        @test backward_export(vcat(v1[1:end-1],["edge\t2018\t11\t2\t2\t0\t0\tE1\tE2","move\t2\t2","end","finish"]))[2]=="source\t11\t2018\t11\tE2"
    end
    @testset "exponents: 1 -> -1, -1 -> 1, 2 -> 2" begin
        s=["cubistry.calendar7.chain.v1","source\t1\t2019\t1\tE0","edge\t2018\t12\t3\t4\t0\t0\tE0\tE1","move\t1\t1","move\t2\t-1","move\t3\t2","end","finish"]
        @test [l for l in backward_export(s) if startswith(l,"move")][4:6]==["move\t3\t2","move\t2\t1","move\t1\t-1"]
        @test [l for l in backward_export(s) if startswith(l,"move")][1:3]==["move\t1\t1","move\t2\t-1","move\t3\t2"]   # the start word keeps the search order
    end
    @testset "import is the inverse of the export" begin
        @test backward_import(FORWARD)==SEARCH
        @test backward_export(backward_import(FORWARD))==FORWARD
        @test backward_import(backward_export(SEARCH))==SEARCH
        v1=["cubistry.calendar7.chain.v1","source\t1\t2019\t1\tE0","edge\t2018\t12\t1\t1\t0\t0\tE0\tE1","move\t1\t1","end","finish"]
        @test backward_import(backward_export(v1))==v1          # no best-effort edge: header v1 comes back
    end
    @testset "state snapshot numbering" begin
        @test [backward_state_index(3,j) for j in 1:4]==[4,3,2,1]      # forward state-01 is the start (last search snapshot), state-04 the identity
        @test backward_state_index(1,1)==2 && backward_state_index(1,2)==1
        @test_throws "outside" backward_state_index(3,0)
        @test_throws "outside" backward_state_index(3,5)
    end
    @testset "export rejections" begin
        @test_throws "chain.v1 or chain.v2" backward_export(vcat(["cubistry.calendar7.chain.v3"],SEARCH[2:end]))
        @test_throws "finish" backward_export(SEARCH[1:end-1])
        @test_throws "no edge" backward_export(["cubistry.calendar7.chain.v1","source\t1\t2019\t1\tE0","finish"])
        # the earliest month is the free start state, whose front must be exact: a best-effort first member is no valid start
        bad=["cubistry.calendar7.chain.v2","source\t1\t2041\t1\tD0","edge\t2037\t2\t10\t12\t1\t2\tD0\tD1","wrong\t7\t1","hall\t7,1;7,7","move\t3\t1","end","finish"]
        @test_throws "best-effort month" backward_export(bad)
        @test_throws "source" backward_export(["cubistry.calendar7.chain.v1","edge\t2037\t2\t1\t1\t0\t0\tD0\tD1","move\t3\t1","end","finish"])
        @test_throws "edge record" backward_export(["cubistry.calendar7.chain.v1","source\t1\t2041\t1\tD0","edge\t2037\t2\t1\t1\t0\t0\tD0","move\t3\t1","end","finish"])
        @test_throws "continuity" backward_export(["cubistry.calendar7.chain.v1","source\t1\t2041\t1\tD0","edge\t2037\t2\t1\t1\t0\t0\tD0\tD1","move\t3\t1","end","edge\t2037\t1\t1\t1\t0\t0\tXX\tD2","move\t3\t1","end","finish"])
    end
    @testset "import rejections" begin
        @test_throws "chain.v3" backward_import(SEARCH)
        no_start=vcat(FORWARD[1:2],FORWARD[9:end])
        @test_throws "start block" backward_import(no_start)
        # the start word must be the search words in order: one move changed
        @test_throws "start word" backward_import(replace(FORWARD,"move\t2\t-1"=>"move\t2\t1";count=1))
        @test_throws "start word" backward_import(vcat(FORWARD[1:2],["start\t4"],FORWARD[4:7],FORWARD[9:end]))
        @test_throws "continuity" backward_import(replace(FORWARD,"\tD3\tD2"=>"\tD4\tD2";count=1))
        @test_throws "source" backward_import(replace(FORWARD,"source\t12\t2036\t12\tD3"=>"source\t11\t2036\t11\tD3";count=1))
        @test_throws "source" backward_import(replace(FORWARD,"source\t12\t2036\t12\tD3"=>"source\t12\t2036\t12\tD9";count=1))
        @test_throws "best-effort month" backward_import(vcat(FORWARD[1:2],FORWARD[3:8],["edge\t2037\t1\t6\t7\t0\t0\tD3\tD2","wrong\t7\t1","hall\t7,1;7,7"],FORWARD[10:end]))
    end
    @testset "month records of a decreasing plan" begin
        plan=backward_plan([(2037,1),(2037,2),(2041,1)])
        rows=month_records((2037,1),(2041,1),plan,plan,nothing;methods=["beam","beam"],best_edges=Set([(2037,2)]),best=Dict((2037,2)=>("best_effort_unverified","7,1","h.tsv")),backward=true)
        r(m)=only(x for x in rows if x[1]==m)
        @test r("2041-01")==("2041-01","valid","root","0","-","-")
        @test r("2037-02")[2:4]==("unknown","best_effort_edge_unconfirmed","1") && r("2037-02")[6]=="h.tsv"
        @test r("2037-01")[2:4]==("valid","chain_edge","2")
        @test r("2040-06")[2:3]==("unknown","skipped_gap")
        b=month_records((2037,1),(2041,1),backward_plan([(2037,1),(2041,1)]),backward_plan([(2037,1),(2041,1)]),nothing;methods=["beam"],backward=true)
        @test only(x for x in b if x[1]=="2037-01")[3]=="bridge_edge"        # the edge across the gap is a bridge edge in either direction
        p=month_records((2037,1),(2041,1),plan,plan[1:2],"max_edges";methods=["beam"],best_edges=Set{Tuple{Int,Int}}(),best=Dict((2037,2)=>("best_effort_unverified","7,1","h.tsv")),backward=true)
        @test only(x for x in p if x[1]=="2037-01")[2:3]==("unknown","max_edges")
        o=month_records((2036,11),(2041,3),plan,plan,nothing;methods=["beam","beam"],best_edges=Set([(2037,2)]),best=Dict((2037,2)=>("best_effort_unverified","7,1","h.tsv")),backward=true)
        @test only(x for x in o if x[1]=="2036-11")[3]=="before_month_list" && only(x for x in o if x[1]=="2041-03")[3]=="after_chain_root"
        f=month_records((2036,11),(2041,3),[(2037,1),(2037,2),(2041,1)],[(2037,1)],"max_edges";methods=String[])
        @test only(x for x in f if x[1]=="2036-11")[3]=="before_chain_root" && only(x for x in f if x[1]=="2041-03")[3]=="after_month_list"   # forward defaults unchanged
    end
    @testset "a best-effort tip is no stop" begin
        best=Dict((2037,2)=>("best_effort_unverified","7,1","h.tsv"))
        @test backward_must_continue((2037,2),best)
        @test !backward_must_continue((2037,1),best) && !backward_must_continue((2041,1),best)
        @test !backward_must_continue((2037,2),Dict{Tuple{Int,Int},NTuple{3,String}}())
    end
end
