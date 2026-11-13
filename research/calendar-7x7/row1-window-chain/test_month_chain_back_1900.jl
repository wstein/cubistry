#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Backward chain, second part: month list 1900-01 .. 2019-01 (1429 months, 1428 edges). The first 468 edges (list 1980-01 .. 2019-01, 469 months) are the verified
# backward chain of run 43414242499; this list continues it to earlier months with the same root (the identity pose of print C, 2019-01) and prior = that artifact.
# Data only: no chain, solver or checker is run. Checks: pin and format, consecutive months, the last 469 rows are the list 1980-01 .. 2019-01 byte for byte,
# Februaries recomputed twice (Zeller and Dates), the months print C cannot show exactly (recomputed against the print), the best-effort file (exactly those months,
# wrong cell 7,1; the five known months unchanged), the Hall table, the stage plan 9 .. 23 (every start month exact, 64 edges each, expect_prior_edges 468, 532, ..)
# and the coverage. Prior compatibility without a solver: the producer's own prefix check (`chain_progress` after `backward_import`) accepts a prior chain on
# the old list for the new plan and refuses a forward-style extension; with CAL7_PRIOR_ARTIFACT=<directory of artifact wc-chain-43414242499> the real chain is read.
# Julia 1.11.5: julia --startup-file=no test_month_chain_back_1900.jl (about 40 s). The files may be replaced by mutated copies through CAL7_CHAINBACK_DIR
# (tests of this test: run_backward_mutants.sh, group data1900).
using Test, SHA, Dates
const EV=joinpath(@__DIR__,"evidence")
const ML=get(ENV,"CAL7_CHAINBACK_DIR",joinpath(EV,"month-list"))
const OLDML=joinpath(EV,"month-list")
const LIST="months-back-1900-01-2019-01.tsv"
const PIN="6f858506f30a3b58ba4e4330234c280d5093908cae5f0e62d093933afa0447d0"
const OLDLIST="months-back-1980-01-2019-01.tsv"
const OLDPIN="d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041"
const OLDBEST="best-effort-back-1980-01-2019-01.tsv"
const OLDBESTPIN="dde09fef9c08575d4a6dbcbb10b2e016d066818b491f2899123816ad744ebdeb"
const BEST="best-effort-back-1900-01-2019-01.tsv"
const HALL="february-hall-C-back-1900.tsv"
const STAGES="stages-back-1900-01-2019-01.tsv"
const COV="coverage-back-1900-01-2019-01"
const OLDFEB=["1981-02","1987-02","1998-02","2009-02","2015-02"]
const NOT_EXACT=["1903-02","1914-02","1925-02","1931-02","1942-02","1953-02","1959-02","1970-02",OLDFEB...]   # February, Sunday, 28 days
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
ym(s)=(parse(Int,s[1:4]),parse(Int,s[6:7]))
idx((y,m))=y*12+m
ckey(y,m)=(m,dayofweek(Date(y,m,1)),daysinmonth(Date(y,m,1)))
# weekday of the 1st by Zeller's congruence (Gregorian): h = 0 Saturday, 1 Sunday, ..., 6 Friday; independent of Dates
function zeller_first(y,m)
    m<3 && ((m,y)=(m+12,y-1))
    k=y%100;j=y÷100
    (1+(13*(m+1))÷5+k+k÷4+j÷4+5*j)%7
end
leap(y)=(y%4==0 && y%100!=0) || y%400==0
text=read(joinpath(ML,LIST),String)
lines=split(chop(text;tail=1),'\n')
ms=ym.(lines)
include(joinpath(EV,"config-coverage","config_table.jl"))   # ConfigTable.board_of / match_config (the repository print checker code); no top-level run
const PC=get(ENV,"CAL7_CHAINBACK_PRINTC",joinpath(EV,"print-c"))   # a mutated copy of print C in the print-mutant test
include(get(ENV,"CAL7_BACKWARD_LIB",joinpath(@__DIR__,"window_chain_lib.jl")))   # a mutated copy of the library in tests of this test
using .WindowChainLib: backward_plan, backward_export, backward_import, chain_progress, read_best_effort, backward_root, backward_must_continue
@testset "backward month list 1900-01 .. 2019-01" begin
    @testset "pin and format" begin
        @test sha(joinpath(ML,LIST))==PIN
        @test any(l->l==PIN*"  "*LIST,readlines(joinpath(ML,"sha256.txt")))
        @test endswith(text,"\n") && !occursin('\r',text) && !occursin("\n\n",text)
        @test all(l->occursin(r"^\d{4}-(0[1-9]|1[0-2])$",l),lines)
    end
    @testset "range, order, count" begin
        @test length(lines)==1429 && length(Set(lines))==1429
        @test all(idx(b)==idx(a)+1 for (a,b) in zip(ms[1:end-1],ms[2:end]))
        @test lines[1]=="1900-01" && lines[end]=="2019-01"
        @test length(lines)-1==1428                                           # edges of the backward search
        old=read(joinpath(OLDML,OLDLIST),String)
        @test sha(joinpath(OLDML,OLDLIST))==OLDPIN
        @test length(split(chop(old;tail=1),'\n'))==469
        @test join(lines[end-468:end],'\n')*"\n"==old                         # the last 469 rows are the list of the verified chain, byte for byte
        @test sha256(join(lines[end-468:end],'\n')*"\n")==sha256(old)
        @test 1429-469==960                                                   # new edges: 1428-468
        @test !leap(1900) && leap(2000) && leap(1904) && !isleapyear(1900) && isleapyear(2000) && !isleapyear(1903)
    end
    @testset "Februaries, two independent recomputations" begin
        zf=[y for y in 1900:2019 if zeller_first(y,2)==1 && !leap(y)]         # Sunday = 1 in Zeller, 28 days
        df=[y for y in 1900:2019 if dayofweek(Date(y,2,1))==7 && daysinmonth(Date(y,2,1))==28]
        @test zf==df && length(zf)==13
        @test ["$y-02" for y in zf]==NOT_EXACT
        @test all(zeller_first(y,m)==((dayofweek(Date(y,m,1))+1)%7) for y in 1900:2019 for m in 1:12)   # Dates: Monday 1 .. Sunday 7; Zeller: Saturday 0, Sunday 1, Monday 2 ..
        @test zeller_first(1900,1)==2 && zeller_first(1900,2)==5 && zeller_first(2000,2)==3  # 1900-01-01 and 1900-02-01 and 2000-02-01 by hand: Monday, Thursday, Tuesday
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
        @test count(values(cache))==length(cache)-1                            # exactly one occurring configuration is not matchable
        @test [l for l in lines if !exact[l]]==NOT_EXACT                       # the months without an exact front: complete list (13)
        @test [l for (l,(y,m)) in zip(lines,ms) if ckey(y,m)==(2,7,28)]==NOT_EXACT
        @test all(l->exact[l],[l for l in lines if !(l in NOT_EXACT)])
        @test exact["1900-01"] && exact["1900-02"] && exact["1900-03"] && exact["1904-02"] && exact["2000-02"] && exact["2019-01"]   # 1900-02 is February/Thursday/28
        @test ckey(1900,1)==(1,1,31) && ckey(1900,2)==(2,4,28) && ckey(2019,1)==(1,2,31)   # 1900-01 is January/Monday/31 (not the identity front January/Tuesday/31), 1900-02 February/Thursday/28
        sig=ConfigTable.bsig(ConfigTable.board_of(labels,2026,2))              # the board of 2026-02, whose Hall row is in february-hall-C.tsv
        @test all(ConfigTable.bsig(ConfigTable.board_of(labels,ym(l)...))==sig for l in NOT_EXACT)
    end
    @testset "best-effort file" begin
        b=rows(joinpath(ML,BEST))
        @test b[1]==["month","status","wrong_cells","evidence"] && length(b)==1+length(NOT_EXACT)
        @test [r[1] for r in b[2:end]]==NOT_EXACT
        @test all(r[2:4]==["best_effort_unverified","7,1",HALL] for r in b[2:end])
        @test issorted([r[1] for r in b[2:end]]) && all(r[1] in lines for r in b[2:end])
        @test lines[1]!=b[2][1] && !(lines[1] in [r[1] for r in b[2:end]])    # the first member is the free start of the exported chain: it is exact
        @test any(l->l==sha(joinpath(ML,BEST))*"  "*BEST,readlines(joinpath(ML,"sha256.txt")))
        o=rows(joinpath(OLDML,OLDBEST))
        @test sha(joinpath(OLDML,OLDBEST))==OLDBESTPIN
        @test [r[1] for r in o[2:end]]==OLDFEB && all(r[2:3]==["best_effort_unverified","7,1"] for r in o[2:end])   # the five months of the verified chain are in the new file
        h=rows(joinpath(ML,HALL))
        @test h[1]==["month","class","deficiency","wrong_cells","hall_cells","neighbor_bodies"]
        d=[r for r in h[2:end] if r[1]!="#total"];t=[r for r in h[2:end] if r[1]=="#total"]
        @test [r[1] for r in d]==NOT_EXACT && all(r[2:6]==["-3,-3,-3","1","7,1","7,1;7,7","1"] for r in d)
        @test t==[["#total",m,"1"] for m in NOT_EXACT] && length(h)==1+2*length(NOT_EXACT)
        @test rows(joinpath(OLDML,"february-hall-C.tsv"))[2][2:end]==d[1][2:end]
        oh=rows(joinpath(OLDML,"february-hall-C-back.tsv"))
        @test [r for r in h[2:end] if r[1] in OLDFEB]==[r for r in oh[2:end] if r[1] in OLDFEB]   # the five rows of the verified chain's table are unchanged
    end
    @testset "stage plan" begin
        s=rows(joinpath(ML,STAGES))
        @test s[1]==["stage","first_edge","last_edge","edges","expect_prior_edges","max_edges","start_month","end_month"] && length(s)==1+15
        st=[(parse(Int,r[1]),parse(Int,r[2]),parse(Int,r[3]),parse(Int,r[4]),parse(Int,r[5]),parse(Int,r[6]),r[7],r[8]) for r in s[2:end]]
        o=rows(joinpath(OLDML,"stages-back-1980-01-2019-01.tsv"))
        @test parse(Int,o[end][3])==468 && parse(Int,o[end][1])==8              # the verified chain's stage 8 ends at edge 468: this plan continues it
        @test [x[1] for x in st]==9:23
        @test st[1][2]==469 && st[end][3]==1428 && all(st[i+1][2]==st[i][3]+1 for i in 1:length(st)-1)
        @test all(x[4]==x[3]-x[2]+1 && x[6]==x[4] for x in st) && sum(x[4] for x in st)==960
        @test all(x[4]==64 for x in st)                                         # 64 edges * about 37.5 s = 2400 s < 3000 s edge-loop limit; 960 = 15 * 64, no remainder stage
        @test [x[5] for x in st]==[468+64*i for i in 0:14] && all(x[5]==x[2]-1 for x in st)   # expect_prior_edges = edges of the exported chain before the stage
        @test all(x[7]==lines[1430-1-x[3]] for x in st) && all(x[8]=="2019-01" for x in st)   # search edge i leads to S[N-i], N=1429
        @test all(!(x[7] in NOT_EXACT) for x in st)                             # the start month of every artifact is exact
        @test st[end][7]=="1900-01" && st[1][7]==lines[1429-532]
    end
    @testset "coverage" begin
        julia=Base.julia_cmd();gen(k)=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $k $(joinpath(ML,LIST)) $PIN $(joinpath(OLDML,"status-none.tsv")) 2019-01 1900-01 1900-01 $(joinpath(ML,BEST))`,String)
        tsv=read(joinpath(ML,COV*".tsv"),String)
        @test gen("tsv")==tsv && gen("json")==read(joinpath(ML,COV*".json"),String)
        @test occursin("counts\tchain_members\t1429\tplanned_exact_runs\t14\tbest_effort\t13\tgaps\t0\tbridges\t0\tbefore_start\t0\n",tsv)
        err=IOBuffer();cmd=`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $(joinpath(ML,LIST)) $PIN $(joinpath(ML,COV*".tsv")) $(joinpath(ML,COV*".json")) $ML 1900-01 1900-01`
        out=read(pipeline(ignorestatus(cmd);stderr=err),String)
        @test isempty(String(take!(err))) && startswith(out,"coverage verified\tplanned exact 1900-01 .. 1903-01 (37 months)\tplanned exact runs 14\tbest-effort 13\tgaps 0")
    end
    @testset "prior compatibility of the producer (no solver)" begin
        # The producer reads prior=DIR (a chain.v3 of the old list), converts it to the search order (backward_import) and requires its months to be the first months of the
        # plan = the new list reversed (chain_progress). A synthetic prior with the real months of the old list and the real best-effort months:
        oldm=[ym(l) for l in split(chop(read(joinpath(OLDML,OLDLIST),String);tail=1),'\n')]
        newm=[ym(l) for l in lines]
        oldbest=Set(ym(r[1]) for r in rows(joinpath(OLDML,OLDBEST))[2:end])
        function search_chain(plan)   # root = plan[1] (identity), one edge per further month, wrong/hall lines after a best-effort month, fake digests D<i>
            out=["cubistry.calendar7.chain.v2","source\t$(plan[1][2])\t$(plan[1][1])\t$(plan[1][2])\tD0"]
            for i in 2:length(plan)
                y,m=plan[i];push!(out,"edge\t$y\t$m\t1\t1\t0\t0\tD$(i-2)\tD$(i-1)")
                plan[i] in oldbest && append!(out,["wrong\t7\t1","hall\t7,1;7,7"])
                push!(out,"move\t1\t1","end")
            end
            push!(out,"finish");out
        end
        @test WindowChainLib.read_month_list(joinpath(ML,LIST),PIN)==newm      # the producer's reader (range 1900-01 .. 2100-01, size, LF) accepts the list
        bf=read_best_effort(joinpath(ML,BEST))
        @test length(bf)==13 && Set(keys(bf))==Set(ym(l) for l in NOT_EXACT) && all(v->v[2]=="7,1",values(bf)) && !haskey(bf,newm[1])
        @test backward_root(newm,"")==(2019,1) && !backward_must_continue((1900,1),bf)   # the root is the identity month; the tip 1900-01 is no best-effort month: a run may stop there
        oldplan=backward_plan(oldm);newplan=backward_plan(newm)
        @test oldplan==newplan[1:469] && oldplan[1]==(2019,1) && newplan[end]==(1900,1)
        fwd=backward_export(search_chain(oldplan))                              # the exported chain.v3 of the old list: what the prior artifact holds
        @test fwd[1]=="cubistry.calendar7.chain.v3" && count(startswith("edge\t"),fwd)==468
        imp=backward_import(fwd)
        months,k=chain_progress(imp,newplan)
        @test k==468 && months==newplan[1:469]                                  # accepted: 468 prior edges, the prior months are the first plan months
        @test chain_progress(imp,oldplan)==(oldplan,468)                        # the old list itself is accepted as before
        # refused: the prior months must be the LAST members of the new list
        fw=[oldm;[(2019,m) for m in 2:12];[(2020,m) for m in 1:12]]            # a forward extension: the prior months are the first members
        @test_throws "chain source is not the root month" chain_progress(imp,backward_plan(fw))
        shifted=vcat(newm[1:end-1],[(2019,2)])                                  # last member is not the identity month
        @test_throws "chain source is not the root month" chain_progress(imp,backward_plan(shifted))
        gap=[x for x in newm if x!=(1990,5)]
        @test_throws "does not follow the plan" chain_progress(imp,backward_plan(gap))
        @test_throws "more edges" chain_progress(imp,backward_plan(oldm[100:end]))   # a list shorter than the prior chain
        # the real artifact, when given (not part of the repository)
        art=get(ENV,"CAL7_PRIOR_ARTIFACT","")
        if isempty(art)
            @info "CAL7_PRIOR_ARTIFACT not set: the real prior chain of run 43414242499 is not read (not run)"
        else
            rl=String.(split(chop(read(joinpath(art,"chain.moves.tsv"),String);tail=1),'\n'))
            ri=backward_import(rl);rm,rk=chain_progress(ri,newplan)
            @test rk==468 && rm==newplan[1:469]
            ve=read(joinpath(art,"VERIFIED.txt"),String)
            @test occursin("months_sha256=$OLDPIN\n",ve) && occursin("best_effort_sha256=$OLDBESTPIN\n",ve) && occursin("direction=backward\n",ve) && occursin("join_end=identity\n",ve) && occursin("root_month=-\n",ve) && occursin("edges_total=468\n",ve)
        end
    end
end
