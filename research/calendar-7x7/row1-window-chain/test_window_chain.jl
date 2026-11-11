#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Logic tests of window_chain.jl that need no solver: month plan, gap records, claims, resume bookkeeping and the
# deadline rule (window_chain_lib.jl). The hours-long run itself is not tested here.
using Test
include(joinpath(@__DIR__,"window_chain_lib.jl"))
using .WindowChainLib
ym=parse_ym
st(rows,m)=only(r for r in rows if r[1]==m)
meth(n)=[i==3 ? "greedy" : "beam" for i in 1:n]   # edge 3 used the greedy fallback
@testset "window chain logic" begin
    @testset "month plan" begin
        @test ym_str(ym("2026-05"))=="2026-05"
        @test length(chain_months(ym("2026-01"),ym("2050-01"),ym("2037-01")))==129   # May 2026 .. Jan 2037
        @test chain_months(ym("2026-01"),ym("2030-03"),ym("2037-01"))[end]==(2030,3)  # the range end wins
        @test isempty(chain_months(ym("2026-01"),ym("2026-04"),ym("2037-01")))
        @test_throws "after it" chain_months(ym("2026-06"),ym("2030-01"),ym("2037-01"))
    end
    @testset "gap records for a complete chain" begin
        ch=chain_months(ym("2026-01"),ym("2050-01"),ym("2037-01"))
        rows=month_records(ym("2026-01"),ym("2050-01"),ym("2037-01"),ch,nothing;methods=meth(128))
        @test length(rows)==289                       # Jan 2026 .. Jan 2050
        @test count(r->r[2]=="valid",rows)==129
        @test st(rows,"2026-03")==("2026-03","unknown","before_chain_root","-","-","-")
        @test st(rows,"2026-05")==("2026-05","valid","root","0","-","-")
        @test st(rows,"2026-06")==("2026-06","valid","chain_edge","1","beam","-")
        @test st(rows,"2026-08")==("2026-08","valid","chain_edge","3","greedy","-")   # the fallback is visible per month
        @test st(rows,"2037-01")==("2037-01","valid","chain_edge","128","beam","-")
        @test st(rows,"2037-02")==("2037-02","unknown","after_print_window","-","-","-")
        @test st(rows,"2050-01")[3]=="after_print_window"
    end
    @testset "partial chain names the stop reason" begin
        ch=chain_months(ym("2026-05"),ym("2030-01"),ym("2037-01"))
        rows=month_records(ym("2026-05"),ym("2030-01"),ym("2037-01"),ch[1:4],"deadline";methods=meth(3))
        @test count(r->r[2]=="valid",rows)==4 && st(rows,"2026-09")[2:3]==("unknown","deadline")
        @test_throws "stop reason" month_records(ym("2026-05"),ym("2030-01"),ym("2037-01"),ch[1:4],nothing;methods=meth(3))
        @test_throws "one solver method" month_records(ym("2026-05"),ym("2030-01"),ym("2037-01"),ch[1:4],"deadline";methods=meth(2))
        @test_throws "chain prefix" month_records(ym("2026-05"),ym("2030-01"),ym("2037-01"),ch[2:4],"deadline";methods=meth(3))
    end
    @testset "claims" begin
        ch=chain_months(ym("2026-01"),ym("2037-02"),ym("2037-01"))
        claims=Dict(ym("2037-02")=>("unavailable_unsat","corner_lemma","receipt-x","both"),
                    ym("2026-04")=>("unavailable_nomatch","no_front_matching","match-y","julia_only"))
        rows=month_records(ym("2026-01"),ym("2037-02"),ym("2037-01"),ch,nothing;claims,methods=meth(128))
        @test st(rows,"2037-02")==("2037-02","unavailable_unsat","corner_lemma","-","-","receipt-x")
        # a claim confirmed by one checker only stays unknown (no UNSAT without both checkers)
        @test st(rows,"2026-04")[2:3]==("unknown","claimed_unavailable_nomatch_julia_only")
        @test_throws "never a claim" mktempdir() do d
            p=joinpath(d,"c.tsv");write(p,"month\tstatus\treason\tevidence\tconfirmed\n2030-01\tvalid\tx\ty\tboth\n");read_claims(p)
        end
    end
    @testset "claims file" begin
        mktempdir() do d
            hdr="month\tstatus\treason\tevidence\tconfirmed\n"
            claims(body)=(p=joinpath(d,"c.tsv");write(p,hdr*body);read_claims(p))
            @test length(claims("2037-02\tunavailable_unsat\tcorner_lemma\tr\tboth\n"))==1
            wr(s)=(p=joinpath(d,"x.tsv");write(p,s);p)
            @test_throws "claims header" read_claims(wr("month\tstatus\treason\tconfirmed\tevidence\n2037-02\tunknown\tx\ty\tboth\n"))
            @test_throws "confirmed" claims("2037-02\tunavailable_unsat\tcorner_lemma\tr\tyes\n")
            @test_throws "status" claims("2037-02\tunsat\tcorner_lemma\tr\tboth\n")
            @test_throws "duplicate month" claims("2037-02\tunavailable_unsat\ta\tr\tboth\n2037-02\tunknown\tb\tr\tnone\n")
            @test_throws "fields" claims("2037-02\tunknown\tx\n")
        end
    end
    @testset "solver record (edges.tsv) and greedy count" begin
        mktempdir() do d
            row(i,m)=join((i,2026,i+4,m,10,12,1.0,"a","b"),'\t')
            p=joinpath(d,"edges.tsv");write(p,join(vcat([EDGES_HEADER],[row(2,"beam"),row(3,"greedy"),row(4,"finish1")]),'\n')*"\n")
            ms=read_edges(p,3);@test ms==["beam","greedy","finish1"] && greedy_count(ms)==1
            @test greedy_count(["beam","finish2"])==0
            @test_throws "rows for 2 edges" read_edges(p,2)
            write(p,join(vcat([EDGES_HEADER],[row(2,"beam"),row(4,"greedy")]),'\n')*"\n");@test_throws "has id 4" read_edges(p,2)
            write(p,join(vcat([EDGES_HEADER],[join(("2","2026","6","beam","1"),'\t')]),'\n')*"\n");@test_throws "has 5 fields" read_edges(p,1)
            write(p,join(vcat(["id\tmethod"],[row(2,"beam")]),'\n')*"\n");@test_throws "edges.tsv header" read_edges(p,1)
        end
    end
    @testset "stop rule as the loop uses it" begin
        @test stop_reason(0,5,0,0,100,(2026,6))===nothing
        @test stop_reason(5,5,0,0,100,(2026,6))=="max_edges"
        @test stop_reason(0,5,90,40,100,(2026,6))=="deadline"
        # a stop at 2028-01 is never taken: both limits are overridden
        @test stop_reason(5,5,90,40,100,(2028,1))===nothing
        @test stop_reason(5,5,90,40,100,(2028,2))=="max_edges"
    end
    @testset "resume bookkeeping" begin
        h="cubistry.calendar7.chain.v1";src="source\t5\t2026\t5\taa"
        e(y,m)=["edge\t$y\t$m\t1\t1\t0\t0\ta\tb","move\t1\t1","end"]
        ok=vcat([h,src],e(2026,6),e(2026,7),["finish"])
        ms,n=chain_progress(ok);@test n==2 && ms[end]==(2026,7)
        @test_throws "gap inside the chain" chain_progress(vcat([h,src],e(2026,6),e(2026,8),["finish"]))
        @test_throws "gap inside the chain" chain_progress(vcat([h,src],e(2026,7),["finish"]))
        @test_throws "chain source" chain_progress(vcat([h,"source\t5\t2026\t6\taa"],["finish"]))
        @test_throws "finish row" chain_progress(vcat([h,src],e(2026,6)))
    end
    @testset "deadline rule" begin
        @test may_start_edge(100,40,200)         # 100 + 50 <= 200
        @test !may_start_edge(160,40,200)        # 160 + 50 > 200: stop cleanly before the limit
        @test may_start_edge(0,0,0)              # no edge measured yet and a zero deadline: the first edge is allowed by elapsed time only
    end
    @testset "unsafe stop" begin
        @test unsafe_stop((2028,1)) && !unsafe_stop((2028,2)) && !unsafe_stop((2027,12))
    end
    @testset "months file" begin
        mktempdir() do d
            rows=month_records(ym("2026-04"),ym("2026-06"),ym("2037-01"),chain_months(ym("2026-04"),ym("2026-06"),ym("2037-01")),nothing;methods=["beam"])
            p=joinpath(d,"months.tsv");write_months(p,rows)
            @test readlines(p)==["month\tstatus\treason\tedge\tmethod\tevidence","2026-04\tunknown\tbefore_chain_root\t-\t-\t-","2026-05\tvalid\troot\t0\t-\t-","2026-06\tvalid\tchain_edge\t1\tbeam\t-"]
        end
    end
end
println("mutations: not run (opt-in); see PR text for the targeted mutations")
