#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# First chain month list 2019-01 .. 2036-01 (205 months, root = S[1] = 2019-01, 204 edges, 5 stages), its pin, stage split,
# best-effort file and coverage. Data only: no chain, solver or checker is run. Julia 1.11.5: julia --startup-file=no test_month_chain_2019.jl
# The files may be replaced by mutated copies through CAL7_CHAIN2019_DIR (tests of this test: run_chain2019_mutants.sh).
# months.jl accepts months from 2026-01 only; configurations are therefore computed with Dates (month, weekday of the 1st, length)
# and looked up in config-coverage/config-table.tsv (column C1980_status; print C has the same matchings, see evidence/print-c/README.md).
using Test, SHA, Dates
const ML=get(ENV,"CAL7_CHAIN2019_DIR",joinpath(@__DIR__,"evidence","month-list"))
const CC=joinpath(@__DIR__,"evidence","config-coverage")
const LIST="months-chain-2019-01-2036-01.tsv"
const PIN="4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3"
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
ym(s)=(parse(Int,s[1:4]),parse(Int,s[6:7]))
idx((y,m))=y*12+m
ckey(y,m)=(m,dayofweek(Date(y,m,1)),daysinmonth(Date(y,m,1)))
const NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
text=read(joinpath(ML,LIST),String)
lines=split(chop(text;tail=1),'\n')
ms=ym.(lines)
@testset "month list 2019-01 .. 2036-01" begin
    @testset "pin and format" begin
        @test sha(joinpath(ML,LIST))==PIN
        @test any(l->l==PIN*"  "*LIST,readlines(joinpath(ML,"sha256.txt")))
        @test endswith(text,"\n") && !occursin('\r',text) && !occursin("\n\n",text)
        @test all(l->occursin(r"^\d{4}-(0[1-9]|1[0-2])$",l),lines)
    end
    @testset "range, order, count" begin
        @test length(lines)==205 && length(Set(lines))==205
        @test issorted(ms) && all(idx(b)>idx(a) for (a,b) in zip(ms[1:end-1],ms[2:end]))
        @test lines[1]=="2019-01" && lines[end]=="2036-01"          # root = S[1]; no month outside the range
        @test all(idx(b)==idx(a)+1 for (a,b) in zip(ms[1:end-1],ms[2:end]))   # calendar-consecutive: no gap, no bridge
        @test length(lines)-1==204                                      # edges of the chain: no root edge (root is S[1])
    end
    @testset "configurations on print C" begin
        t=rows(joinpath(CC,"config-table.tsv"));h=t[1];status=Dict{Tuple{Int,Int,Int},String}()
        for r in t[2:end];status[(parse(Int,r[2]),findfirst(==(r[4]),DAYS),parse(Int,r[5]))]=r[findfirst(==("C1980_status"),h)];end
        @test length(status)==91
        keys_=[ckey(y,m) for (y,m) in ms]
        bad=[lines[i] for i in 1:205 if status[keys_[i]]!="SAT"]
        @test bad==["2026-02"]                                       # the only best-effort month
        @test [keys_[i] for i in 1:205 if status[keys_[i]]!="SAT"]==[(2,7,28)]
        @test length(Set(keys_))==88                                  # distinct configurations
        @test length(Set(zip(keys_[1:end-1],keys_[2:end])))==92       # distinct configuration pairs
        @test ckey(2019,1)==(1,2,31)==ckey(1980,1)==ckey(2030,1)      # root board: January / Tuesday / 31
        # best-effort file: exactly the NOMATCH month, wrong cell (7,1); the config-coverage file exists and names (7,1) and (7,7) for print C
        b=rows(joinpath(ML,"best-effort-chain-2019-01-2036-01.tsv"))
        @test b[1]==["month","status","wrong_cells","evidence"] && length(b)==2
        @test b[2][1]=="2026-02" && b[2][2]=="best_effort_unverified" && b[2][3]=="7,1" && isfile(joinpath(CC,"best-effort-feb-sunday-28.tsv"))
        ev=rows(joinpath(CC,"best-effort-feb-sunday-28.tsv"))
        @test Set((r[1],r[5],r[6]) for r in ev[2:end] if r[1]=="C")==Set([("C","7","1"),("C","7","7")])
    end
    @testset "stages" begin
        s=rows(joinpath(ML,"stages-chain-2019-01-2036-01.tsv"))
        @test s[1]==["stage","first_edge","last_edge","edges","start_month","end_month"] && length(s)==6
        st=[(parse(Int,r[1]),parse(Int,r[2]),parse(Int,r[3]),parse(Int,r[4]),r[5],r[6]) for r in s[2:end]]
        @test [x[1] for x in st]==1:5
        @test st[1][2]==1 && st[end][3]==204 && all(st[i+1][2]==st[i][3]+1 for i in 1:4)   # contiguous, complete
        @test all(x[4]==x[3]-x[2]+1 for x in st) && sum(x[4] for x in st)==204
        @test [x[4] for x in st]==[41,41,41,41,40] && all(40<=x[4]<=41 for x in st)
        @test all(x[5]==lines[x[2]] && x[6]==lines[x[3]+1] for x in st)                     # edge i leads from S[i] to S[i+1]
        @test all(st[i][6]==st[i+1][5] for i in 1:4) && st[1][5]=="2019-01" && st[end][6]=="2036-01"
    end
    @testset "coverage" begin
        julia=Base.julia_cmd();gen(k)=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $k $(joinpath(ML,LIST)) $PIN $(joinpath(ML,"status-none.tsv")) 2036-01 2019-01 2019-01 $(joinpath(ML,"best-effort-chain-2019-01-2036-01.tsv"))`,String)
        tsv=read(joinpath(ML,"coverage-chain-2019-01-2036-01.tsv"),String)
        @test gen("tsv")==tsv && gen("json")==read(joinpath(ML,"coverage-chain-2019-01-2036-01.json"),String)
        @test occursin("counts\tchain_members\t205\tplanned_exact_runs\t2\tbest_effort\t1\tgaps\t0\tbridges\t0\tbefore_start\t0\n",tsv)
        @test occursin("run\t2019-01\t2026-01\t85\tplanned_exact",tsv) && occursin("run\t2026-03\t2036-01\t119\tplanned_exact",tsv)
        @test occursin("best_effort\t2026-02\t2026-02\t1\tbest_effort_unverified",tsv)
    end
end
