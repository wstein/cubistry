#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Logic tests of window_chain.jl that need no solver: month list, root month, chain plan, month status records (incl. skipped
# months, bridge edges, best-effort months), claims, resume bookkeeping and the deadline rule (window_chain_lib.jl).
# The hours-long run itself is not tested here.
using Test, SHA
include(joinpath(@__DIR__,"window_chain_lib.jl"))
using .WindowChainLib
ym=parse_ym
st(rows,m)=only(r for r in rows if r[1]==m)
meth(n)=[i==3 ? "greedy" : "beam" for i in 1:n]   # edge 3 used the greedy fallback
list_file(d,months;name="s.tsv")=(p=joinpath(d,name);write(p,join(months,'\n')*"\n");(p,bytes2hex(sha256(read(p)))))
@testset "window chain logic" begin
    @testset "month syntax and range 1900-01 .. 2100-01" begin
        @test ym_str(ym("2026-05"))=="2026-05" && ym_str(ym("1900-01"))=="1900-01" && ym("2100-01")==(2100,1)
        @test_throws "outside 1900-01" ym("1899-12")
        @test_throws "outside 1900-01" ym("2100-02")
        @test_throws "YYYY-MM" ym("2026-13")
        @test_throws "YYYY-MM" ym("2026-5")
    end
    @testset "month list file (same rules as the checkers)" begin
        mktempdir() do d
            p,h=list_file(d,["2026-03","2026-05","2100-01"])
            @test read_month_list(p,h)==[(2026,3),(2026,5),(2100,1)]
            p1,h1=list_file(d,["1900-01","1980-01"];name="a.tsv");@test read_month_list(p1,h1)[1]==(1900,1)
            @test_throws "month list pin" read_month_list(p,"0"^64)
            @test_throws "64 lowercase hex" read_month_list(p,uppercase(h))
            q,hq=list_file(d,["2026-05","2026-05"];name="b.tsv");@test_throws "strictly increasing" read_month_list(q,hq)
            q,hq=list_file(d,["2026-06","2026-05"];name="c.tsv");@test_throws "strictly increasing" read_month_list(q,hq)
            q,hq=list_file(d,["1899-12","2026-05"];name="e.tsv");@test_throws "outside 1900-01" read_month_list(q,hq)
            q,hq=list_file(d,["2026-05","2100-02"];name="f.tsv");@test_throws "outside 1900-01" read_month_list(q,hq)
            q=joinpath(d,"g.tsv");write(q,"2026-05\r\n2026-06\r\n");@test_throws "LF" read_month_list(q,bytes2hex(sha256(read(q))))
            q=joinpath(d,"h.tsv");write(q,"2026-05\n2026-06");@test_throws "LF" read_month_list(q,bytes2hex(sha256(read(q))))
            q=joinpath(d,"i.tsv");write(q,"2026-05\n\n2026-06\n");@test_throws "YYYY-MM" read_month_list(q,bytes2hex(sha256(read(q))))
            q=joinpath(d,"j.tsv");write(q,"\n");@test_throws "empty" read_month_list(q,bytes2hex(sha256(read(q))))
        end
    end
    @testset "root month is separate from the month list" begin
        S=[(2026,3),(2026,4),(2026,6)]
        @test root_month("",S)==(2026,3)                    # default: first member, no root edge
        @test root_month("1980-01",S)==(1980,1)
        @test root_month("2100-01",S)==(2100,1) && root_month("1900-01",S)==(1900,1)
        @test_throws "outside 1900-01" root_month("1899-12",S)
        @test_throws "YYYY-MM" root_month("1980-1",S)
        @test chain_plan(S,(2026,3))==S                      # root = first member
        @test chain_plan(S,(1980,1))==vcat([(1980,1)],S)     # root edge in front
        @test chain_flags(S,(2026,3))==["","BRIDGE"]         # 2026-04 -> 2026-06 skips May
        @test chain_flags(S,(1980,1))==["ROOTEDGE","","BRIDGE"]
        @test chain_flags([(2026,3)],(2026,3))==String[]
    end
    @testset "gap records for a complete chain (rooted at 1980-01, bridges over skipped months)" begin
        S=[m for m in month_range(ym("2026-03"),ym("2037-04")) if m!=(2037,2)]   # 2037-02 is skipped
        plan=chain_plan(S,(1980,1));n=length(plan)
        rows=month_records(ym("2026-01"),ym("2037-06"),plan,plan,nothing;methods=meth(n-1),rooted=true)
        @test length(rows)==length(month_range(ym("2026-01"),ym("2037-06")))
        @test st(rows,"2026-01")==("2026-01","unknown","skipped_gap","-","-","-")        # between the root and the first member
        @test st(rows,"2026-03")[2:5]==("valid","root_edge","1","beam")          # first member, reached by the root edge
        @test st(rows,"2026-04")[2:3]==("valid","chain_edge")
        @test st(rows,"2037-01")[2:3]==("valid","chain_edge")
        @test st(rows,"2037-02")==("2037-02","unknown","skipped_gap","-","-","-")  # in the range, not in the list
        @test st(rows,"2037-03")[2:3]==("valid","bridge_edge")                      # the edge over the gap
        @test st(rows,"2037-05")==("2037-05","unknown","after_month_list","-","-","-")
        @test st(rows,"2026-02")[3]=="skipped_gap"
    end
    @testset "root month inside the range gets the root row" begin
        S=[(2026,3),(2026,4)];plan=chain_plan(S,(1980,1))
        rows=month_records((1979,12),(2026,5),plan,plan,nothing;methods=["beam","beam"],rooted=true)
        @test st(rows,"1979-12")[3]=="before_chain_root"
        @test st(rows,"1980-01")==("1980-01","valid","root","0","-","-")
        @test st(rows,"1980-02")[3]=="skipped_gap"       # between the root and the first member
        @test st(rows,"2026-03")[2:5]==("valid","root_edge","1","beam") && st(rows,"2026-04")[2:5]==("valid","chain_edge","2","beam")
        @test st(rows,"2026-05")[3]=="after_month_list"
    end
    @testset "root equals first member" begin
        S=[(2026,5),(2026,6)];plan=chain_plan(S,(2026,5))
        rows=month_records((2026,5),(2026,6),plan,plan,nothing;methods=["beam"])
        @test st(rows,"2026-05")==("2026-05","valid","root","0","-","-") && st(rows,"2026-06")[2:5]==("valid","chain_edge","1","beam")
    end
    @testset "partial chain names the stop reason" begin
        S=month_range(ym("2026-05"),ym("2030-01"));plan=chain_plan(S,(2026,5))
        rows=month_records(ym("2026-05"),ym("2030-01"),plan,plan[1:4],"deadline";methods=meth(3))
        @test count(r->r[2]=="valid",rows)==4 && st(rows,"2026-09")[2:3]==("unknown","deadline")
        @test_throws "stop reason" month_records(ym("2026-05"),ym("2030-01"),plan,plan[1:4],nothing;methods=meth(3))
        @test_throws "one solver method" month_records(ym("2026-05"),ym("2030-01"),plan,plan[1:4],"deadline";methods=meth(2))
        @test_throws "chain prefix" month_records(ym("2026-05"),ym("2030-01"),plan,plan[2:4],"deadline";methods=meth(3))
    end
    @testset "best-effort months are declared, never claimed valid by the producer" begin
        S=month_range(ym("2037-01"),ym("2037-04"));plan=chain_plan(S,(2037,1))
        best=Dict(ym("2037-02")=>("best_effort_unverified","7,7","february-hall-S2.tsv"))
        rows=month_records(ym("2037-01"),ym("2037-04"),plan,plan[1:1],"deadline";methods=String[],best)
        @test st(rows,"2037-02")==("2037-02","unknown","deadline","-","-","february-hall-S2.tsv")
        @test st(rows,"2037-03")[2:3]==("unknown","deadline")       # not reached behind the stop
        @test_throws "not a chain month" month_records(ym("2037-01"),ym("2037-04"),plan,plan[1:1],"deadline";methods=String[],best=Dict(ym("2030-01")=>("best_effort","1,1","x")))
        mktempdir() do d
            hdr="month\tstatus\twrong_cells\tevidence\n";p=joinpath(d,"b.tsv")
            write(p,hdr*"2037-02\tbest_effort_unverified\t7,7\tfebruary-hall-S2.tsv\n2043-02\tbest_effort\t7,1\te\n")
            b=read_best_effort(p);@test b[ym("2037-02")]==("best_effort_unverified","7,7","february-hall-S2.tsv") && length(b)==2
            write(p,"month\tstatus\n");@test_throws "best-effort header" read_best_effort(p)
            write(p,hdr*"2037-02\texact\t7,7\te\n");@test_throws "best-effort status" read_best_effort(p)
            write(p,hdr*"2037-02\tbest_effort\t7,7\te\n2037-02\tbest_effort\t7,7\te\n");@test_throws "duplicate month" read_best_effort(p)
            write(p,hdr*"2037-02\tbest_effort\t7,7\n");@test_throws "fields" read_best_effort(p)
        end
    end
    @testset "claims" begin
        S=month_range(ym("2026-05"),ym("2037-01"));plan=chain_plan(S,(2026,5))
        claims=Dict(ym("2037-02")=>("unavailable_unsat","corner_lemma","receipt-x","both"),
                    ym("2026-04")=>("unavailable_nomatch","no_front_matching","match-y","julia_only"),
                    ym("2037-03")=>("best_effort","hall","receipt-z","none"))
        rows=month_records(ym("2026-04"),ym("2037-03"),plan,plan,nothing;claims,methods=meth(length(plan)-1))
        @test st(rows,"2037-02")==("2037-02","unavailable_unsat","corner_lemma","-","-","receipt-x")
        # a claim confirmed by one checker only stays unknown (no UNSAT without both checkers)
        @test st(rows,"2026-04")[2:3]==("unknown","claimed_unavailable_nomatch_julia_only")
        @test st(rows,"2037-03")[2:3]==("unknown","claimed_best_effort_none")
        ok=Dict(ym("2037-03")=>("best_effort","hall","receipt-z","both"))
        @test st(month_records(ym("2037-03"),ym("2037-03"),plan,plan,nothing;claims=ok,methods=meth(length(plan)-1)),"2037-03")==("2037-03","best_effort","hall","-","-","receipt-z")
        @test_throws "chain month" month_records(ym("2026-05"),ym("2026-06"),plan,plan,nothing;claims=Dict(ym("2026-06")=>("unknown","x","y","none")),methods=meth(length(plan)-1))
        @test_throws "never a claim" mktempdir() do d
            p=joinpath(d,"c.tsv");write(p,"month\tstatus\treason\tevidence\tconfirmed\n2030-01\tvalid\tx\ty\tboth\n");read_claims(p)
        end
    end
    @testset "claims file" begin
        mktempdir() do d
            hdr="month\tstatus\treason\tevidence\tconfirmed\n"
            claims(body)=(p=joinpath(d,"c.tsv");write(p,hdr*body);read_claims(p))
            @test length(claims("2037-02\tunavailable_unsat\tcorner_lemma\tr\tboth\n"))==1
            @test length(claims("1950-03\tbest_effort\thall\tr\tboth\n"))==1
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
        @test stop_reason(0,5,0,0,100,nothing)===nothing
        @test stop_reason(5,5,0,0,100,nothing)=="max_edges"
        @test stop_reason(0,5,90,40,100,nothing)=="deadline"
        # a declared best-effort month as the next target is no reason to stop: the producer writes its edge (test_window_chain_best_effort.jl)
        @test stop_reason(0,5,0,0,100,ym("2037-02"))===nothing
        @test stop_reason(5,5,0,0,100,ym("2037-02"))=="max_edges"
    end
    @testset "resume bookkeeping against the plan (source month = root month, bridges and root edge allowed)" begin
        h="cubistry.calendar7.chain.v1"
        e(y,m)=["edge\t$y\t$m\t1\t1\t0\t0\ta\tb","move\t1\t1","end"]
        S=[(2026,3),(2026,4),(2026,6)];plan=chain_plan(S,(1980,1))
        src="source\t1\t1980\t1\taa"
        ok=vcat([h,src],e(2026,3),e(2026,4),e(2026,6),["finish"])
        ms,n=chain_progress(ok,plan);@test n==3 && ms==plan
        ms,n=chain_progress(vcat([h,src],e(2026,3),["finish"]),plan);@test n==1 && ms[end]==(2026,3)
        @test_throws "does not follow the plan" chain_progress(vcat([h,src],e(2026,3),e(2026,5),["finish"]),plan)   # 2026-05 is not a member
        @test_throws "does not follow the plan" chain_progress(vcat([h,src],e(2026,4),["finish"]),plan)             # the root edge is missing
        @test_throws "more edges" chain_progress(vcat([h,src],e(2026,3),e(2026,4),e(2026,6),e(2026,7),["finish"]),plan)
        @test_throws "chain source" chain_progress(vcat([h,"source\t5\t2026\t5\taa"],["finish"]),plan)
        @test_throws "chain source" chain_progress(vcat([h,"source\t6\t1980\t1\taa"],["finish"]),plan)   # first field is the month too
        @test_throws "finish row" chain_progress(vcat([h,src],e(2026,3)),plan)
        @test_throws "chain.v1 or chain.v2" chain_progress(vcat(["cubistry.calendar7.chain.v3",src],e(2026,3),["finish"]),plan)   # v2 resumes (best-effort edges), v3 does not
        # the old May 2026 root still resumes
        old=chain_plan(month_range(ym("2026-05"),ym("2026-08")),(2026,5))
        ms,n=chain_progress(vcat([h,"source\t5\t2026\t5\taa"],e(2026,6),e(2026,7),["finish"]),old);@test n==2 && ms[end]==(2026,7)
    end
    @testset "deadline rule" begin
        @test may_start_edge(100,40,200)         # 100 + 50 <= 200
        @test !may_start_edge(160,40,200)        # 160 + 50 > 200: stop cleanly before the limit
        @test may_start_edge(0,0,0)              # no edge measured yet and a zero deadline: the first edge is allowed by elapsed time only
        @test DEFAULT_DEADLINE_S==3000.0         # segments of about one hour: 3000 s edge loop (the job limit adds the library build and slack)
    end
    @testset "months file" begin
        mktempdir() do d
            plan=chain_plan(month_range(ym("2026-05"),ym("2026-06")),(2026,5))
            rows=month_records(ym("2026-04"),ym("2026-06"),plan,plan,nothing;methods=["beam"])
            p=joinpath(d,"months.tsv");write_months(p,rows)
            @test readlines(p)==["month\tstatus\treason\tedge\tmethod\tevidence","2026-04\tunknown\tbefore_chain_root\t-\t-\t-","2026-05\tvalid\troot\t0\t-\t-","2026-06\tvalid\tchain_edge\t1\tbeam\t-"]
        end
    end
    @testset "segment provenance record" begin
        r=segment_row(run_id="123",research_ref="a"^40,library="L5",width="40",lambda="3",print_sha="b"^64,months_sha="c"^64,root="1980-01",edges_from=0,edges_to=7,layout_sha="d"^64)
        @test r==join(("123","a"^40,"L5","40","3","b"^64,"c"^64,"1980-01","0","7","d"^64),'\t')
        @test SEGMENTS_HEADER=="run_id\tresearch_ref\tlibrary\twidth\tlambda\tprint_sha256\tmonths_sha256\troot_month\tedges_from\tedges_to\tlayout_sha256"
        @test_throws "tab" segment_row(run_id="1\t2",research_ref="a"^40,library="L5",width="40",lambda="3",print_sha="b"^64,months_sha="c"^64,root="1980-01",edges_from=0,edges_to=7,layout_sha="d"^64)
        mktempdir() do d
            p=joinpath(d,"segments.tsv");r2=segment_row(run_id="124",research_ref="d"^40,library="L4",width="60",lambda="2",print_sha="b"^64,months_sha="c"^64,root="1980-01",edges_from=7,edges_to=14,layout_sha="d"^64)
            write(p,join([SEGMENTS_HEADER,r,r2],'\n')*"\n");@test read_segments(p)==[r,r2]
            write(p,"run_id\n");@test_throws "segments.tsv header" read_segments(p)
            write(p,SEGMENTS_HEADER*"\n1\t2\n");@test_throws "has 2 fields" read_segments(p)
        end
    end
end
println("mutations: not run (opt-in); see PR text for the targeted mutations")
