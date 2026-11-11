#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
using Test
include(joinpath(@__DIR__,"stage_pairs.jl"))
@testset "staged chain pairs" begin
    @test read(joinpath(@__DIR__,"stage-pairs.tsv"),String)==stage_table()
    @test length(months((1900,1),(2100,1)))==2401 && length(months((1980,1),(2050,1)))==841
    p=Set((ckey(a...),ckey(b...)) for (a,b) in zip(months((1980,1),(2050,1))[1:end-1],months((1980,1),(2050,1))[2:end]))
    @test length(p)==98 && count(q->FEB in q,p)==2                # the 400-year cycle is already complete in 70 years
    @test ckey(1980,1)==(1,2,31)
end
