#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Backward chain: month list 1980-01 .. 2019-01 (469 months, 468 edges). The search starts at the identity pose of print C (the solved cube, 2019-01,
# the root of the first chain 2019-01 .. 2036-01) and goes to 1980-01; the exported chain.v3 reads 1980-01 .. 2019-01 and ends at the identity pose.
# Data only: no chain, solver or checker is run. Checks: pin and format, consecutive months, the root month shows the identity front, the months that print C
# cannot show exactly (recomputed: every month board is matched against the print), the best-effort file (exactly those months, wrong cell 7,1), the Hall
# witness table, the stage plan (every stage start is an exact month: a free start shows its month exactly) and the coverage.
# Julia 1.11.5: julia --startup-file=no test_month_chain_back.jl (about 25 s). The files may be replaced by mutated copies through CAL7_CHAINBACK_DIR
# (tests of this test: run_backward_mutants.sh).
using Test, SHA, Dates
const EV=joinpath(@__DIR__,"evidence")
const ML=get(ENV,"CAL7_CHAINBACK_DIR",joinpath(EV,"month-list"))
const OLDML=joinpath(EV,"month-list")
const LIST="months-back-1980-01-2019-01.tsv"
const PIN="d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041"
const BEST="best-effort-back-1980-01-2019-01.tsv"
const HALL="february-hall-C-back.tsv"
const STAGES="stages-back-1980-01-2019-01.tsv"
const COV="coverage-back-1980-01-2019-01"
const NOT_EXACT=["1981-02","1987-02","1998-02","2009-02","2015-02"]   # February, Sunday, 28 days
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
ym(s)=(parse(Int,s[1:4]),parse(Int,s[6:7]))
idx((y,m))=y*12+m
ckey(y,m)=(m,dayofweek(Date(y,m,1)),daysinmonth(Date(y,m,1)))
text=read(joinpath(ML,LIST),String)
lines=split(chop(text;tail=1),'\n')
ms=ym.(lines)
include(joinpath(EV,"config-coverage","config_table.jl"))   # ConfigTable.board_of / match_config (the repository print checker code); no top-level run
const PC=get(ENV,"CAL7_CHAINBACK_PRINTC",joinpath(EV,"print-c"))   # a mutated copy of print C in the print-mutant test
@testset "backward month list 1980-01 .. 2019-01" begin
    @testset "pin and format" begin
        @test sha(joinpath(ML,LIST))==PIN
        @test any(l->l==PIN*"  "*LIST,readlines(joinpath(ML,"sha256.txt")))
        @test endswith(text,"\n") && !occursin('\r',text) && !occursin("\n\n",text)
        @test all(l->occursin(r"^\d{4}-(0[1-9]|1[0-2])$",l),lines)
    end
    @testset "range, order, count" begin
        @test length(lines)==469 && length(Set(lines))==469
        @test all(idx(b)==idx(a)+1 for (a,b) in zip(ms[1:end-1],ms[2:end]))   # increasing, calendar-consecutive (the checkers read the list increasing)
        @test lines[1]=="1980-01" && lines[end]=="2019-01"
        @test length(lines)-1==468                                            # edges of the backward search: the identity pose is S[end]
        # the root of the first chain is the identity pose: the first member of the first chain's list is the last member of this list
        @test split(chop(read(joinpath(OLDML,"months-chain-2019-01-2036-01.tsv"),String);tail=1),'\n')[1]==lines[end]
        @test sha(joinpath(OLDML,"months-chain-2019-01-2036-01.tsv"))=="4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3"
        @test all(isleapyear(y) for y in (1980,1984,1996,2000,2012,2016)) && !isleapyear(1900) && !isleapyear(2018)
    end
    @testset "months print C shows exactly" begin
        labels=coupled_labels(read(joinpath(PC,"layout.tsv"),String));src=window_read_print(joinpath(PC,"printing.tsv"))
        @test sha(joinpath(PC,"printing.tsv"))=="0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc"
        cache=Dict{String,Bool}();exact=Dict{String,Bool}()
        for (l,(y,m)) in zip(lines,ms)
            b=ConfigTable.board_of(labels,y,m);k=ConfigTable.bsig(b)
            haskey(cache,k) || (cache[k]=isempty(ConfigTable.match_config(src,b).unmatched))
            exact[l]=cache[k]
        end
        @test length(cache)==91 && count(values(cache))==90                    # 91 configurations occur, one is not matchable
        @test [l for l in lines if !exact[l]]==NOT_EXACT                       # the months without an exact front: complete list
        @test [l for (l,(y,m)) in zip(lines,ms) if ckey(y,m)==(2,7,28)]==NOT_EXACT   # February, Sunday, 28 days (Dates, no table)
        @test all(l->exact[l],[l for l in lines if !(l in NOT_EXACT)])
        @test exact["1980-01"] && exact["2019-01"] && exact["1980-02"] && exact["2000-02"]
        @test ckey(2019,1)==(1,2,31)==ckey(1980,1)                             # the identity front (root of the first chain) is the January/Tuesday/31 board
        @test exact["2019-01"]
        sig=ConfigTable.bsig(ConfigTable.board_of(labels,2026,2))              # the board of 2026-02, whose Hall row is in february-hall-C.tsv
        @test all(ConfigTable.bsig(ConfigTable.board_of(labels,ym(l)...))==sig for l in NOT_EXACT)
    end
    @testset "best-effort file" begin
        b=rows(joinpath(ML,BEST))
        @test b[1]==["month","status","wrong_cells","evidence"] && length(b)==1+length(NOT_EXACT)
        @test [r[1] for r in b[2:end]]==NOT_EXACT
        @test all(r[2:4]==["best_effort_unverified","7,1",HALL] for r in b[2:end])   # wrong cell (7,1) only: the workflow has no best_effort_cell input
        @test issorted([r[1] for r in b[2:end]]) && all(r[1] in lines for r in b[2:end])
        @test lines[1]!=b[2][1] && !(lines[1] in [r[1] for r in b[2:end]])            # the first member is the free start of the exported chain: it is exact
        @test any(l->l==sha(joinpath(ML,BEST))*"  "*BEST,readlines(joinpath(ML,"sha256.txt")))
        h=rows(joinpath(ML,HALL))
        @test h[1]==["month","class","deficiency","wrong_cells","hall_cells","neighbor_bodies"]
        d=[r for r in h[2:end] if r[1]!="#total"];t=[r for r in h[2:end] if r[1]=="#total"]
        @test [r[1] for r in d]==NOT_EXACT && all(r[2:6]==["-3,-3,-3","1","7,1","7,1;7,7","1"] for r in d)
        @test t==[["#total",m,"1"] for m in NOT_EXACT] && length(h)==1+2*length(NOT_EXACT)
        @test rows(joinpath(OLDML,"february-hall-C.tsv"))[2][2:end]==d[1][2:end]      # the row of 2026-02 in the first chain's table
    end
    @testset "stage plan" begin
        s=rows(joinpath(ML,STAGES))
        @test s[1]==["stage","first_edge","last_edge","edges","expect_prior_edges","max_edges","start_month","end_month"] && length(s)==1+8
        st=[(parse(Int,r[1]),parse(Int,r[2]),parse(Int,r[3]),parse(Int,r[4]),parse(Int,r[5]),parse(Int,r[6]),r[7],r[8]) for r in s[2:end]]
        @test [x[1] for x in st]==1:8
        @test st[1][2]==1 && st[end][3]==468 && all(st[i+1][2]==st[i][3]+1 for i in 1:length(st)-1)   # contiguous, complete
        @test all(x[4]==x[3]-x[2]+1 && x[6]==x[4] for x in st) && sum(x[4] for x in st)==468
        @test [x[4] for x in st]==vcat(fill(64,7),[20]) && all(x[4]<=64 for x in st)    # 64 edges * about 37.5 s = 2400 s < 3000 s edge-loop limit
        @test all(x[5]==x[2]-1 for x in st) && st[1][5]==0                              # expect_prior_edges = edges of the exported chain before the stage
        @test all(x[7]==lines[469-x[3]] for x in st) && all(x[8]=="2019-01" for x in st)   # search edge i leads to S[469-i]
        @test all(!(x[7] in NOT_EXACT) for x in st)                                     # the start month of every artifact is exact
        @test st[end][7]=="1980-01"
    end
    @testset "coverage" begin
        julia=Base.julia_cmd();gen(k)=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $k $(joinpath(ML,LIST)) $PIN $(joinpath(OLDML,"status-none.tsv")) 2019-01 1980-01 1980-01 $(joinpath(ML,BEST))`,String)
        tsv=read(joinpath(ML,COV*".tsv"),String)
        @test gen("tsv")==tsv && gen("json")==read(joinpath(ML,COV*".json"),String)
        @test occursin("counts\tchain_members\t469\tplanned_exact_runs\t6\tbest_effort\t5\tgaps\t0\tbridges\t0\tbefore_start\t0\n",tsv)
        err=IOBuffer();cmd=`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $(joinpath(ML,LIST)) $PIN $(joinpath(ML,COV*".tsv")) $(joinpath(ML,COV*".json")) $ML 1980-01 1980-01`
        out=read(pipeline(ignorestatus(cmd);stderr=err),String)
        @test isempty(String(take!(err))) && startswith(out,"coverage verified\tplanned exact 1980-01 .. 1981-01 (13 months)\tplanned exact runs 6\tbest-effort 5\tgaps 0")
    end
end
