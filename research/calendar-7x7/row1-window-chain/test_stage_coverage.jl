#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Stage composition: the stored summary is regenerated and verified; junction mismatch, missing junction lines, month mismatch,
# differing Julia and Flix receipts and a best-effort stage are each reported at their reason.
using Test
include("stage_coverage.jl")
dir=joinpath(@__DIR__,"evidence","month-list")
julia=Base.julia_cmd()
rd(f)=read(joinpath(dir,f),String)
function verify(stages,ev,summary)
    err=IOBuffer();ok=success(pipeline(`$julia --startup-file=no $(joinpath(@__DIR__,"verify_stage_coverage.jl")) $stages $ev $summary`;stderr=err,stdout=devnull));ok,String(take!(err))
end
function workdir(;edit=(f,t)->t)       # copy of the receipts; edit(name,text) may change them
    d=mktempdir()
    for f in ("stage-A-julia.tsv","stage-A-flix.tsv","stage-B-julia.tsv","stage-B-flix.tsv");write(joinpath(d,f),edit(f,rd(f)));end
    write(joinpath(d,"stages.tsv"),rd("stages.tsv"));d
end
summary_of(d)=stage_summary(joinpath(d,"stages.tsv"),d)
@testset "stage composition" begin
    want=rd("stage-summary.tsv")
    @test stage_summary(joinpath(dir,"stages.tsv"),dir)==want
    @test verify(joinpath(dir,"stages.tsv"),dir,joinpath(dir,"stage-summary.tsv"))[1]
    @test occursin("junction\tA\tB\t2026-06\tjoined\t",want) && occursin("composed\t2026-05\t2028-01\t21\tA,B\n",want)
    @test occursin("counts\tstages\t2\tjoined\t1\tjunctions\t1\texact_runs\t1\n",want)
    # wrong boundary digest in the start record of B (both receipts): the junction is a mismatch and the stages are listed per stage
    fake=repeat("0",64);startB=match(r"(?m)^root\t\d+\t\d+\t([0-9a-f]{64})$",rd("stage-B-julia.tsv"))[1]
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(t,startB=>fake) : t);s=summary_of(d)
    @test occursin("\tmismatch\t",s) && !occursin("composed",s) && occursin("single\t2026-05\t2026-06\t2\tA\n",s) && occursin("counts\tstages\t2\tjoined\t0\tjunctions\t1\texact_runs\t",s)
    write(joinpath(d,"s.tsv"),s);@test verify(joinpath(d,"stages.tsv"),d,joinpath(d,"s.tsv"))[1]       # the verifier agrees with the per-stage result
    @test !verify(joinpath(d,"stages.tsv"),d,joinpath(dir,"stage-summary.tsv"))[1]                      # and rejects the composed summary of the matching receipts
    # junction lines missing: equal digests are not enough, the checker must have compared them
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(t,r"(?m)^join\tstart\t[0-9a-f]{64}\n"=>"") : t);s=summary_of(d)
    @test occursin("\tunchecked\t",s) && !occursin("composed",s)
    d=workdir(edit=(f,t)->startswith(f,"stage-A") ? replace(t,r"(?m)^join\tend\t[0-9a-f]{64}\n"=>"") : t);@test occursin("\tunchecked\t",summary_of(d))
    # junction line with another digest than the boundary
    d=workdir(edit=(f,t)->startswith(f,"stage-A") ? replace(t,r"(?m)^join\tend\t[0-9a-f]{64}"=>"join\tend\t"*fake) : t);@test occursin("\tunchecked\t",summary_of(d))
    # the stages meet in different months
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(t,r"(?m)^root\t2026\t6\t"=>"root\t2026\t7\t") : t);@test occursin("\tmismatch\t",summary_of(d))
    # Julia and Flix receipts of a stage differ
    d=workdir(edit=(f,t)->f=="stage-B-flix.tsv" ? t*"x\n" : t);@test_throws AssertionError summary_of(d)
    # a best-effort stage is not exact: no composition across it
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(replace(t,r"(?m)^verdict\tSAT"=>"verdict\tBEST_EFFORT"),r"(?m)^status\texact\t\d+\tbest_effort\t0$"=>"status\texact\t18\tbest_effort\t1") : t);s=summary_of(d)
    @test occursin("not_exact_gapless",s) && !occursin("composed",s)
    # a free-start stage that is not joined to a predecessor is not anchored at the identity pose
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(t,startB=>fake) : t);s=summary_of(d)
    @test occursin("free_single\t2026-06\t2028-01\t20\tB\n",s) && !occursin("\nsingle\t2026-06",s)
    @test !occursin("free_",want)                                                        # joined to A: one run anchored at A
    # the Julia and Flix receipt of a stage must be two different files
    d=workdir();write(joinpath(d,"stages.tsv"),"A\tstage-A-julia.tsv\tstage-A-julia.tsv\nB\tstage-B-julia.tsv\tstage-B-flix.tsv\n")
    @test_throws AssertionError summary_of(d)
    ok,e=verify(joinpath(d,"stages.tsv"),d,joinpath(dir,"stage-summary.tsv"));@test !ok && occursin("receipts are one file",e)
    # a bridge edge makes a stage not gapless
    d=workdir(edit=(f,t)->startswith(f,"stage-A") ? replace(t,r"(?m)^(edge\t1\t[^\n]*\tPASS)$"=>s"\1\tBRIDGE") : t);@test occursin("A\t2026-05\t2026-06\t2\tSAT\tnot_exact_gapless",summary_of(d))
    # a summary that claims composition across a mismatch is rejected by the verifier
    d=workdir(edit=(f,t)->startswith(f,"stage-B") ? replace(t,startB=>fake) : t);write(joinpath(d,"s.tsv"),rd("stage-summary.tsv"))
    ok,e=verify(joinpath(d,"stages.tsv"),d,joinpath(d,"s.tsv"));@test !ok && occursin("stage summary mismatch",e)
end
