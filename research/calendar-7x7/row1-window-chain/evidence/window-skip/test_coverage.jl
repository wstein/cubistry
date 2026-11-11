#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
using Test
include(joinpath(@__DIR__,"coverage.jl"))
months(a,b)=[i for i in a:b]
@testset "coverage runs and gaps" begin
    valid=vcat(months(idx(2026,5),idx(2037,1)),[idx(2037,3)],months(idx(2037,5),idx(2050,1)))
    runs,gaps=runs_and_gaps(valid)
    @test headline(runs)=="gapless: 2026-05 .. 2037-01 (129 months)"
    @test runs[end]==(idx(2037,5),idx(2050,1))
    @test fmt.(gaps)==["2026-01","2026-02","2026-03","2026-04","2037-02","2037-04"]
    # mutation: a month dropped inside the run must change the headline
    mut=filter(!=(idx(2030,6)),valid);r2,g2=runs_and_gaps(mut)
    @test headline(r2)=="gapless: 2026-05 .. 2030-05 (49 months)"
    @test headline(r2)!=headline(runs) && "2030-06" in fmt.(g2)
    # mutation: root month missing
    @test startswith(headline(runs_and_gaps(filter(!=(idx(2026,5)),valid))[1]),"gapless: none")
    # a gap without a status row is reported as unknown
    io=IOBuffer();report(io,valid,Dict("2037-02"=>("unavailable_unsat","x")))
    s=String(take!(io));@test occursin("run\t2037-05\t2050-01\t153",s) && occursin("gap\t2037-04\t2037-04\t1\tunknown (not tested)",s) && occursin("unavailable_unsat",s)
    @test parse_list("2026-05,2026-06\n2026-07")==months(idx(2026,5),idx(2026,7))
    @test_throws AssertionError parse_list("2025-12")
    @test_throws AssertionError parse_list("2026-05,2026-05")
end
