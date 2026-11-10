#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# The chain window end is a parameter; the default stays May 2026 through January 2028.
using Test
include(joinpath(@__DIR__,"..","row1-window-print/common.jl"))
labels=coupled_labels(read(joinpath(@__DIR__,"..","row1-revision/layout.tsv"),String))
ym(goals)=[(g.year,g.month) for g in goals]
@testset "window end parameter" begin
    default=coupled_goals(labels,"names-band","window")
    @test length(default)==21 && ym(default)[[1,end]]==[(2026,5),(2028,1)]
    @test ym(coupled_goals(labels,"names-band","window";window_end="2028-01"))==ym(default)
    longer=coupled_goals(labels,"names-band","window";window_end="2028-02")
    @test length(longer)==22 && ym(longer)==vcat(ym(default),[(2028,2)])
    @test ym(coupled_goals(labels,"names-band","window";window_end="2029-12"))[end]==(2029,12)
    @test length(coupled_goals(labels,"names-band","window";window_end="2029-12"))==44
    for bad in ("2026-04","2028-13","2028-1","2028-01 ","","x","2100-02","2028-01\n")
        @test_throws AssertionError coupled_goals(labels,"names-band","window";window_end=bad)
    end
    @test window_end_months("2026-05")==1
    @test window_end_months("2028-01")==21
    @test window_end_months("2029-12")==44
end
println("mutations: not run (opt-in)")
