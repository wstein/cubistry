#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Second chain: month list 2019-01 .. 2100-01 (973 months, root = S[1] = 2019-01, 972 edges), the continuation of the verified
# first chain 2019-01 .. 2036-01 (204 edges, list months-chain-2019-01-2036-01.tsv). Data only: no chain, solver or checker is run.
# Checks: pin and format, strictly increasing calendar-consecutive months, the first 205 rows equal the first list byte for byte, the
# months that print C cannot show exactly (recomputed: every month board is matched against the print), the best-effort file (exactly
# those months, wrong cell 7,1), the Hall witness table, the stage plan and the coverage.
# Julia 1.11.5: julia --startup-file=no test_month_chain_2100.jl (about 40 s). The files may be replaced by mutated copies through
# CAL7_CHAIN2100_DIR (tests of this test: run_chain2100_mutants.sh).
using Test, SHA, Dates
const EV=joinpath(@__DIR__,"evidence")
const ML=get(ENV,"CAL7_CHAIN2100_DIR",joinpath(EV,"month-list"))
const OLDML=joinpath(EV,"month-list")
const LIST="months-chain-2019-01-2100-01.tsv"
const PIN="05691e207922d28669b9eb12ee99c666a13d076312eff1a049fc9b4430504ad1"
const OLD_LIST="months-chain-2019-01-2036-01.tsv"
const OLD_PIN="4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3"
const OLD_BEST="best-effort-chain-2019-01-2036-01.tsv"
const OLD_BEST_PIN="00b721b107cb7ad64c5b1d2ae90c0f7cbda6930f8d306492b5f98b2c3b33fbbe"
const BEST="best-effort-chain-2019-01-2100-01.tsv"
const HALL="february-hall-C-2100.tsv"
const STAGES="stages-chain-2036-01-2100-01.tsv"
const COV="coverage-chain-2019-01-2100-01"
const NOT_EXACT=["2026-02","2037-02","2043-02","2054-02","2065-02","2071-02","2082-02","2093-02","2099-02"]   # February, Sunday, 28 days
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
ym(s)=(parse(Int,s[1:4]),parse(Int,s[6:7]))
idx((y,m))=y*12+m
ckey(y,m)=(m,dayofweek(Date(y,m,1)),daysinmonth(Date(y,m,1)))
text=read(joinpath(ML,LIST),String)
lines=split(chop(text;tail=1),'\n')
ms=ym.(lines)
include(joinpath(EV,"config-coverage","config_table.jl"))   # ConfigTable.board_of / match_config (the repository print checker code); no top-level run
const PC=get(ENV,"CAL7_CHAIN2100_PRINTC",joinpath(EV,"print-c"))   # a mutated copy of print C in the print-mutant test
@testset "month list 2019-01 .. 2100-01" begin
    @testset "pin and format" begin
        @test sha(joinpath(ML,LIST))==PIN
        @test any(l->l==PIN*"  "*LIST,readlines(joinpath(ML,"sha256.txt")))
        @test endswith(text,"\n") && !occursin('\r',text) && !occursin("\n\n",text)
        @test all(l->occursin(r"^\d{4}-(0[1-9]|1[0-2])$",l),lines)
    end
    @testset "range, order, count" begin
        @test length(lines)==973 && length(Set(lines))==973
        @test all(idx(b)>idx(a) for (a,b) in zip(ms[1:end-1],ms[2:end]))
        @test all(idx(b)==idx(a)+1 for (a,b) in zip(ms[1:end-1],ms[2:end]))   # calendar-consecutive: no gap, no bridge
        @test lines[1]=="2019-01" && lines[end]=="2100-01" && !("2100-02" in lines)
        @test length(lines)-1==972                                            # edges: root is S[1], no root edge
        @test 972-204==768 && length(lines)-205==768                          # new edges after the first chain (204 edges)
        @test sha(joinpath(OLDML,OLD_LIST))==OLD_PIN && lines[1:205]==split(chop(read(joinpath(OLDML,OLD_LIST),String);tail=1),'\n')
        @test lines[205]=="2036-01" && lines[206]=="2036-02"                   # the continuation starts at the end of the first chain
        @test isleapyear(2096) && !isleapyear(2100) && isleapyear(2036)   # 2100 is no leap year; February 2100 is not a member anyway
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
        @test length([l for l in NOT_EXACT if l>"2036-01"])==8 && length(NOT_EXACT)==9   # eight in the new range, 2026-02 in the first chain
        # the 29-day Februaries (2036, 2040, ..., 2096) and the other 28-day Februaries are exact
        @test all(exact[string(y,"-02")] for y in 2020:4:2096 if string(y,"-02") in lines)
        @test exact["2100-01"] && exact["2036-02"] && exact["2099-01"]
        # the root board is the identity front of print C: January, Tuesday, 31
        @test ckey(2019,1)==(1,2,31) && exact["2019-01"]
        # every non-exact month has the board of 2026-02, so the Hall table row of 2026-02 (february-hall-C.tsv) holds for all of them
        sig=ConfigTable.bsig(ConfigTable.board_of(labels,2026,2))
        @test all(ConfigTable.bsig(ConfigTable.board_of(labels,ym(l)...))==sig for l in NOT_EXACT)
    end
    @testset "best-effort file" begin
        b=rows(joinpath(ML,BEST))
        @test b[1]==["month","status","wrong_cells","evidence"] && length(b)==1+length(NOT_EXACT)
        @test [r[1] for r in b[2:end]]==NOT_EXACT                              # exactly the months that are not exact, in order
        @test all(r[2:4]==["best_effort_unverified","7,1",HALL] for r in b[2:end])   # wrong cell (7,1) only: the workflow has no best_effort_cell input
        @test sha(joinpath(OLDML,OLD_BEST))==OLD_BEST_PIN && b[2][1:3]==rows(joinpath(OLDML,OLD_BEST))[2][1:3]   # the 2026-02 row of the first chain's best-effort file (its evidence names the older table)
        @test issorted([r[1] for r in b[2:end]]) && all(r[1] in lines for r in b[2:end])
        @test any(l->l==sha(joinpath(ML,BEST))*"  "*BEST,readlines(joinpath(ML,"sha256.txt")))
        h=rows(joinpath(ML,HALL))
        @test h[1]==["month","class","deficiency","wrong_cells","hall_cells","neighbor_bodies"]
        d=[r for r in h[2:end] if r[1]!="#total"];t=[r for r in h[2:end] if r[1]=="#total"]
        @test [r[1] for r in d]==NOT_EXACT && all(r[2:6]==["-3,-3,-3","1","7,1","7,1;7,7","1"] for r in d)   # class, deficiency 1, wrong cell (7,1)
        @test t==[["#total",m,"1"] for m in NOT_EXACT] && length(h)==1+2*length(NOT_EXACT)
        @test rows(joinpath(OLDML,"february-hall-C.tsv"))[2]==d[1]            # the 2026-02 row of the first chain's table
    end
    @testset "stage plan" begin
        s=rows(joinpath(ML,STAGES))
        @test s[1]==["stage","first_edge","last_edge","edges","expect_prior_edges","start_month","end_month","max_edges"] && length(s)==1+13
        st=[(parse(Int,r[1]),parse(Int,r[2]),parse(Int,r[3]),parse(Int,r[4]),parse(Int,r[5]),r[6],r[7],parse(Int,r[8])) for r in s[2:end]]
        @test [x[1] for x in st]==6:18                                         # stages 1-5 are the first chain
        @test st[1][2]==205 && st[end][3]==972 && all(st[i+1][2]==st[i][3]+1 for i in 1:length(st)-1)   # contiguous, complete
        @test all(x[4]==x[3]-x[2]+1 && x[8]==x[4] for x in st) && sum(x[4] for x in st)==768
        @test all(x[5]==x[2]-1 for x in st) && st[1][5]==204                   # expect_prior_edges = edges of the prior chain
        @test [x[4] for x in st]==vcat([3],fill(64,11),[61])
        @test all(x[4]<=64 for x in st)                                        # 64 edges * about 37.5 s = 2400 s < 3000 s edge-loop limit
        @test all(x[6]==lines[x[2]] && x[7]==lines[x[3]+1] for x in st)        # edge i leads from S[i] to S[i+1]
        @test all(st[i][7]==st[i+1][6] for i in 1:length(st)-1) && st[1][6]=="2036-01" && st[end][7]=="2100-01"
    end
    @testset "coverage" begin
        julia=Base.julia_cmd();gen(k)=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $k $(joinpath(ML,LIST)) $PIN $(joinpath(OLDML,"status-none.tsv")) 2100-01 2019-01 2019-01 $(joinpath(ML,BEST))`,String)
        tsv=read(joinpath(ML,COV*".tsv"),String)
        @test gen("tsv")==tsv && gen("json")==read(joinpath(ML,COV*".json"),String)
        @test occursin("counts\tchain_members\t973\tplanned_exact_runs\t10\tbest_effort\t9\tgaps\t0\tbridges\t0\tbefore_start\t0\n",tsv)
        err=IOBuffer();cmd=`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $(joinpath(ML,LIST)) $PIN $(joinpath(ML,COV*".tsv")) $(joinpath(ML,COV*".json")) $ML 2019-01 2019-01`
        out=read(pipeline(ignorestatus(cmd);stderr=err),String)
        @test isempty(String(take!(err))) && startswith(out,"coverage verified\tplanned exact 2019-01 .. 2026-01 (85 months)\tplanned exact runs 10\tbest-effort 9\tgaps 0")
    end
end
