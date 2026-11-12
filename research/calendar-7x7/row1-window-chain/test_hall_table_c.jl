#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Hall witness table of print C for the best-effort month 2026-02 (February/Sunday/28) of the first chain: the table
# evidence/month-list/february-hall-C.tsv is what verify_coverage.jl reads for the status best_effort_unverified, and the
# coverage of the 2019-01 .. 2036-01 list must pass that verifier. Julia 1.11.5: julia --startup-file=no test_hall_table_c.jl
# Files may be replaced by mutated copies through CAL7_HALL_C_DIR (tests of this test: run_chain2019_mutants.sh).
using Test, SHA
const ML=get(ENV,"CAL7_HALL_C_DIR",joinpath(@__DIR__,"evidence","month-list"))
const PC=joinpath(@__DIR__,"evidence","print-c")
const LIST="months-chain-2019-01-2036-01.tsv"
const PIN="4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3"
const TABLE="february-hall-C.tsv"
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
function verify(dir)
    julia=Base.julia_cmd();err=IOBuffer()
    cmd=`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $(joinpath(dir,LIST)) $PIN $(joinpath(dir,"coverage-chain-2019-01-2036-01.tsv")) $(joinpath(dir,"coverage-chain-2019-01-2036-01.json")) $dir 2019-01 2019-01`
    out=read(pipeline(ignorestatus(cmd);stderr=err),String)
    (out,String(take!(err)))
end
@testset "Hall witness table of print C" begin
    @testset "table file" begin
        @test isfile(joinpath(ML,TABLE))
        t=rows(joinpath(ML,TABLE))
        @test t[1]==["month","class","deficiency","wrong_cells","hall_cells","neighbor_bodies"]
        @test t[2]==["2026-02","-3,-3,-3","1","7,1","7,1;7,7","1"]          # the wrong cell is (7,1); (7,7) is the other cell of the Hall set (fallback)
        @test t[3]==["#total","2026-02","1"] && length(t)==3
    end
    @testset "best-effort entry names the table" begin
        b=rows(joinpath(ML,"best-effort-chain-2019-01-2036-01.tsv"))
        @test b[2]==["2026-02","best_effort_unverified","7,1",TABLE]
    end
    @testset "verify_coverage accepts the chain coverage" begin
        out,err=verify(ML)
        @test isempty(err) && startswith(out,"coverage verified\tplanned exact 2019-01 .. 2026-01 (85 months)\tplanned exact runs 2\tbest-effort 1\tgaps 0")
    end
    @testset "verify_coverage rejects a wrong table" begin
        mktempdir() do d
            for f in readdir(ML);cp(joinpath(ML,f),joinpath(d,f));end
            s=read(joinpath(d,TABLE),String)
            write(joinpath(d,TABLE),replace(s,"2026-02\t-3,-3,-3\t1\t7,1\t"=>"2026-02\t-3,-3,-3\t1\t7,2\t"))
            out,err=verify(d);@test isempty(out) && occursin("Hall witness table gives the same wrong cells",err)
            rm(joinpath(d,TABLE))
            out,err=verify(d);@test isempty(out) && occursin("Hall witness table exists",err)
        end
    end
    @testset "table is what the Hall check recomputes" begin
        julia=Base.julia_cmd()
        out=read(`$julia --startup-file=no $(joinpath(ML,"february_hall.jl")) $(joinpath(PC,"layout.tsv")) $(joinpath(PC,"printing.tsv")) 2026-02@7,1`,String)
        @test out==read(joinpath(ML,TABLE),String)
        err=IOBuffer()
        run(pipeline(ignorestatus(`$julia --startup-file=no $(joinpath(ML,"february_hall.jl")) $(joinpath(PC,"layout.tsv")) $(joinpath(PC,"printing.tsv")) 2026-02@4,4`);stdout=devnull,stderr=err))
        @test occursin("preferred wrong cell",String(take!(err)))        # a preferred cell outside the Hall set is refused
    end
end
