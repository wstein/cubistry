#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests of the best-effort edge of the producer window_chain.jl (rule: window_chain_lib.jl, helpers: best_effort_edge.jl).
#   julia --startup-file=no --threads=4 test_window_chain_best_effort.jl       # units, print C checks and the real edge (see below)
#   CAL7_BE_REAL=0 julia --startup-file=no test_window_chain_best_effort.jl    # units and print C checks only (about 30 s)
# The real edge test runs window_chain.jl with print C on the list [2026-01, 2026-02, 2026-03], root 2019-01 (the solved cube): a beam edge
# into January 2026 (the real predecessor state), the best-effort edge into February 2026 (February/Sunday/28 shows 29 in (7,1)) and an
# exact edge into March 2026 that starts from the best-effort state. check.jl and verify_chain.jl must accept the chain with the verdict
# BEST_EFFORT. Several minutes on a loaded host (the library build alone took 111 s at load 35); no Flix here (run_checks.sh does that).
using Test, SHA
include(joinpath(@__DIR__,"window_chain_lib.jl"))
using .WindowChainLib
const CAL=normpath(joinpath(@__DIR__,".."))
const PC=joinpath(@__DIR__,"evidence","print-c")
sha(p)=bytes2hex(sha256(read(p)))
ym=parse_ym
st(rows,m)=only(r for r in rows if r[1]==m)
@testset "best-effort edge of the producer" begin
    @testset "wrong cell: file, switch, corner cells only" begin
        @test best_effort_cell("7,1")==(7,1)                       # the file says (7,1): the default
        @test best_effort_cell("7,1","")==(7,1)
        @test best_effort_cell("7,7")==(7,7)                       # a file that says (7,7)
        @test best_effort_cell("7,1","7,7")==(7,7)                 # the switch best_effort_cell=7,7 is the only way to the fallback
        @test best_effort_cell("7,7","7,1")==(7,1)
        @test BEST_EFFORT_CORNERS==((7,1),(7,7))
        for bad in ("4,4","1,1","7,2","7","7,1;7,7","7,1,2","0,1","7,8","")
            @test_throws "best-effort cell" best_effort_cell(bad)
        end
        @test_throws "best-effort cell" best_effort_cell("7,1","4,4")      # a switch outside the corner cells
        @test_throws "best-effort cell" best_effort_cell("7,1;7,7","7,7")  # a list in the file is not one cell
    end
    @testset "what counts as 29: text and ink, every sticker that carries it" begin
        @test best_effort_ink(1)=="red" && best_effort_ink(7)=="red" && all(c->best_effort_ink(c)=="dark",2:6)
        @test best_effort_art((7,1))==("29","red") && best_effort_art((7,7))==("29","red") && BEST_EFFORT_TEXT=="29"
        S(id,t,i)=(id=id,text=t,ink=i)
        src=[S(1,"28","red"),S(2,"29","red"),S(3,"29","red"),S(4,"29","dark"),S(5,"62","red"),S(6,"2","red"),S(7,"9","red"),S(8,"","blank"),S(9,"29/36","red")]
        @test art_stickers(src,("29","red"))==[2,3]                # both red 29 stickers (two faces of one corner in print C), not the dark one
        @test art_stickers(src,("29","dark"))==[4]
        @test art_stickers([S(1,"28","red")],("29","red"))==Int[]
        @test shows_art(S(2,"29","red"),("29","red")) && shows_art(S(3,"29","red"),("29","red"))
        @test !shows_art(S(1,"28","red"),("29","red"))             # another day number is not 29
        @test !shows_art(S(4,"29","dark"),("29","red"))            # the ink of the column is part of the rule
        @test !shows_art(S(5,"62","red"),("29","red")) && !shows_art(S(8,"","blank"),("29","red"))
    end
    @testset "target board: the true board with 29 in the one wrong cell" begin
        board=fill(("","blank"),7,7);board[6,1]=("22","red");board[2,3]=("Feb","month")
        b=best_effort_board(board,(7,1))
        @test b[7,1]==("29","red") && count(i->b[i]!=board[i],eachindex(b))==1 && board[7,1]==("","blank")   # input untouched
        b7=best_effort_board(board,(7,7));@test b7[7,7]==("29","red") && b7[7,1]==("","blank") && count(i->b7[i]!=board[i],eachindex(b7))==1
        @test_throws "not empty" best_effort_board(board,(6,1))
        full=copy(board);full[7,1]=("29","red");@test_throws "already shows" best_effort_board(full,(7,1))
    end
    @testset "edge lines and header (chain.v2 as the three checkers read it)" begin
        @test best_effort_edge_lines((7,1))==["wrong\t7\t1","hall\t7,1;7,7"]
        @test best_effort_edge_lines((7,7))==["wrong\t7\t7","hall\t7,1;7,7"]
        @test chain_header(false)=="cubistry.calendar7.chain.v1" && chain_header(true)=="cubistry.calendar7.chain.v2"
    end
    @testset "month records, stop rule and resume bookkeeping" begin
        S=month_range(ym("2026-01"),ym("2026-04"));plan=chain_plan(S,(2019,1))
        best=Dict(ym("2026-02")=>("best_effort_unverified","7,1","ev.tsv"))
        edges=Set([ym("2026-02")])
        rows=month_records(ym("2026-01"),ym("2026-04"),plan,plan[1:3],"max_edges";methods=["beam","beam"],rooted=true,best_edges=edges,best)
        @test st(rows,"2026-01")[2:3]==("valid","root_edge")
        @test st(rows,"2026-02")==("2026-02","unknown","best_effort_edge_unconfirmed","2","beam","ev.tsv")   # produced, but only the checkers can confirm it
        @test st(rows,"2026-03")[2:3]==("unknown","max_edges")
        # declared and not reached: the stop reason, not a special reason
        rows=month_records(ym("2026-01"),ym("2026-04"),plan,plan[1:2],"deadline";methods=["beam"],rooted=true,best)
        @test st(rows,"2026-02")==("2026-02","unknown","deadline","-","-","ev.tsv")
        @test_throws "without a best-effort row" month_records(ym("2026-01"),ym("2026-04"),plan,plan[1:3],"max_edges";methods=["beam","beam"],rooted=true,best_edges=Set([ym("2026-01")]),best)
        # the producer does not stop before a declared month
        @test stop_reason(0,5,0,0,100,ym("2026-02"))===nothing
        # a chain with a best-effort edge (chain.v2) is a valid prior chain; v3 and others are not
        e(y,m)=["edge\t$y\t$m\t1\t1\t0\t0\ta\tb","move\t1\t1","end"]
        src="source\t1\t2019\t1\taa";be=["edge\t2026\t2\t1\t1\t0\t0\ta\tb","wrong\t7\t1","hall\t7,1;7,7","move\t1\t1","end"]
        ls=vcat(["cubistry.calendar7.chain.v2",src],e(2026,1),be,["finish"])
        @test chain_progress(ls,plan)==(plan[1:3],2)
        @test_throws "chain.v1 or chain.v2" chain_progress(vcat(["cubistry.calendar7.chain.v3"],ls[2:end]),plan)
    end
end
# Print C: the rule on the real print (Julia, a few seconds).
ENV["WINDOW_END"]=get(ENV,"WINDOW_END","2029-12")
include(joinpath(CAL,"row1-window-print","common.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
include(joinpath(@__DIR__,"best_effort_edge.jl"))
@testset "print C, February/Sunday/28" begin
    labels=coupled_labels(read(joinpath(PC,"layout.tsv"),String));source=window_read_print(joinpath(PC,"printing.tsv"))
    g=coupled_month_goal(labels,2026,2)
    @test g.board[7,1]==("","blank") && g.board[7,7]==("","blank") && g.board[6,1]==("22","red")   # 28 days from Sunday: rows 3 to 6, row 7 empty
    @test art_stickers(source,best_effort_art((7,1)))==[2,3]                  # print C: red 29 only on corner piece 1 (stickers 2 and 3)
    @test all(s->s.piece==1,filter(s->s.id in (2,3),source))
    @test count(s->s.text=="29" && s.ink=="dark",source)==6                    # dark 29 stickers exist but are not the art
    @test hall_deficiency(source,g.board,best_effort_hall())==1               # no exact state (Hall set of both corner cells)
    for cell in BEST_EFFORT_CORNERS
        @test hall_deficiency(source,best_effort_board(g.board,cell),best_effort_hall())==0   # with 29 in the corner the corner class can be matched
    end
    @test_throws "one body class" hall_deficiency(source,g.board,[(7,1),(4,4)])
end
# The real edge: the producer as a process, the two checkers as processes.
function state_rows(path)       # a state file as the decoded state of the checkers (id, piece, pos, normal, up, text, ink)
    t(s)=Tuple(parse.(Int,split(s,',')))
    [(id=parse(Int,f[1]),piece=parse(Int,f[2]),pos=t(f[3]),normal=t(f[4]),up=t(f[5]),text=f[6],ink=f[7]) for f in (split(l,'\t';keepempty=true) for l in readlines(path)[2:end])]
end
if get(ENV,"CAL7_BE_REAL","1")!="0"
@testset "real best-effort edge 2026-02 on print C (root 2019-01, edge 1 beam, edge 2 best-effort, edge 3 exact)" begin
    mktempdir() do d
        months=joinpath(d,"months.tsv");write(months,"2026-01\n2026-02\n2026-03\n")
        best=joinpath(d,"best.tsv");write(best,"month\tstatus\twrong_cells\tevidence\n2026-02\tbest_effort_unverified\t7,1\tevidence/config-coverage/best-effort-feb-sunday-28.tsv\n")
        env=Dict("CAL7_WINDOW_MONTHS"=>months,"CAL7_WINDOW_MONTHS_SHA256"=>sha(months),"CAL7_ROOT_MONTH"=>"2019-01","CAL7_WINDOW_PRINT_SHA"=>sha(joinpath(PC,"printing.tsv")),
                 "CAL7_WINDOW_LAYOUT"=>joinpath(PC,"layout.tsv"),"CAL7_WINDOW_LAYOUT_SHA256"=>sha(joinpath(PC,"layout.tsv")))
        out=joinpath(d,"out");log=joinpath(d,"producer.log")
        t0=time();code=run(pipeline(ignorestatus(addenv(`$(Base.julia_cmd()) --startup-file=no --threads=4 $(joinpath(@__DIR__,"window_chain.jl")) $out $(joinpath(PC,"printing.tsv")) best_effort=$best`,env));stdout=log,stderr=log)).exitcode
        println("producer: exit $code, ",round(time()-t0;digits=1)," s");print(read(log,String))
        @test code==0
        prog=Dict(String.(split(l,'='))[1]=>String.(split(l,'='))[2] for l in readlines(joinpath(out,"PROGRESS.txt")))
        @test prog["complete"]=="true" && prog["edges_total"]=="3" && prog["best_effort_edges"]=="1" && prog["greedy_edges"]=="0"
        ls=readlines(joinpath(out,"chain.moves.tsv"))
        @test ls[1]=="cubistry.calendar7.chain.v2"
        ei=findall(l->startswith(l,"edge\t"),ls);@test length(ei)==3
        f(i)=split(ls[ei[i]],'\t')
        @test [(f(i)[2],f(i)[3]) for i in 1:3]==[("2026","1"),("2026","2"),("2026","3")]
        @test ls[ei[2]+1]=="wrong\t7\t1" && ls[ei[2]+2]=="hall\t7,1;7,7" && startswith(ls[ei[2]+3],"move\t")
        @test !startswith(ls[ei[1]+1],"wrong") && !startswith(ls[ei[3]+1],"wrong")          # the other edges are exact
        @test f(3)[8]==f(2)[9] && f(2)[8]==f(1)[9]                                           # the next edge starts from the best-effort state
        htm=parse(Int,f(2)[4]);println("best-effort edge 2026-02: HTM ",htm," QTM ",f(2)[5]," rot ",f(2)[6])
        @test 0<htm<=300                                                                     # a beam-sized edge, not a fixed full state
        eg=readlines(joinpath(out,"edges.tsv"));@test split(eg[3],'\t')[4]!="greedy"
        mo=readlines(joinpath(out,"months.tsv"));@test "2026-02\tunknown\tbest_effort_edge_unconfirmed\t2\t"*split(eg[3],'\t')[4]*"\t"*"evidence/config-coverage/best-effort-feb-sunday-28.tsv" in mo
        # own reading of the state after the best-effort edge: 29 (red, text of the sticker) at R7C1, exactly one cell differs from the board
        labels=coupled_labels(read(joinpath(PC,"layout.tsv"),String));g=coupled_month_goal(labels,2026,2)
        sf=state_rows(joinpath(out,"states","state-03.tsv"))
        @test front_mismatches(sf,g.board)==[(7,1)]
        s71=front_sticker(sf,(7,1));@test s71.text=="29" && s71.ink=="red" && s71.id in (2,3)
        @test front_sticker(sf,(7,7)).text=="" && front_sticker(sf,(6,1)).text=="22"
        @test front_mismatches(state_rows(joinpath(out,"states","state-02.tsv")),coupled_month_goal(labels,2026,1).board)==Tuple{Int,Int}[]
        @test front_mismatches(state_rows(joinpath(out,"states","state-04.tsv")),coupled_month_goal(labels,2026,3).board)==Tuple{Int,Int}[]
        # the checkers decide
        function checker(script)
            o=IOBuffer();e=IOBuffer()
            ok=success(pipeline(addenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(@__DIR__,script)) $(joinpath(PC,"layout.tsv")) $(joinpath(PC,"printing.tsv")) $(joinpath(out,"chain.moves.tsv")) $(joinpath(out,"states"))`,env);stdout=o,stderr=e))
            (ok,String(take!(o)),String(take!(e)))
        end
        ok,o,e=checker("check.jl");println("check.jl: ",ok);ok||println(e)
        @test ok && occursin("\tBEST_EFFORT\t1\t7,1\n",o) && occursin("\nstatus\texact\t2\tbest_effort\t1\n",o) && occursin("\nverdict\tBEST_EFFORT\t",o)
        ok,o,e=checker("verify_chain.jl");println("verify_chain.jl: ",ok);ok||println(e)
        @test ok && occursin("independent-verdict\tACCEPT_BEST_EFFORT_CHAIN",o)
        # a wrong listed cell is refused by both (the producer's own re-check is the first guard, the checkers the second)
        bad=joinpath(d,"bad.tsv");write(bad,replace(read(joinpath(out,"chain.moves.tsv"),String),"wrong\t7\t1\n"=>"wrong\t7\t7\n"))
        for script in ("check.jl","verify_chain.jl")
            o=IOBuffer();e=IOBuffer()
            ok=success(pipeline(addenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(@__DIR__,script)) $(joinpath(PC,"layout.tsv")) $(joinpath(PC,"printing.tsv")) $bad $(joinpath(out,"states"))`,env);stdout=o,stderr=e))
            @test !ok && occursin("strict",String(take!(o))*String(take!(e)))
        end
    end
end
end
