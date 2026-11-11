#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unit tests of the Hall-witness rule (check.jl chain_hall_check) on the printing-S2 print and the February 2037 board
# (Sunday, 28 days): one cell of the corner pair (7,1),(7,7) must be wrong in every legal state.
using Test
include(joinpath(@__DIR__,"check.jl"))
layout=joinpath(@__DIR__,"..","row1-revision","layout.tsv")
labels=coupled_labels(read(layout,String));source=window_read_print(joinpath(@__DIR__,"evidence","window-skip","printing-S2.tsv"))
feb=coupled_month_goal(labels,2037,2).board
rejects(f)=try f();false catch e;e isa AssertionError end
@testset "chain_root_month" begin
    withenv("CAL7_ROOT_MONTH"=>nothing) do;@test chain_root_month((2026,3))==(2026,3);end
    withenv("CAL7_ROOT_MONTH"=>"1980-01") do;@test chain_root_month((2026,3))==(1980,1);end
    for bad in ("1899-12","2100-02","1980-13","1980-1","x")
        withenv("CAL7_ROOT_MONTH"=>bad) do;@test rejects(()->chain_root_month((2026,3)));end
    end
end
@testset "Hall witness on printing-S2, February 2037" begin
    @test chain_hall_check(source,feb,[(7,7)],[[(7,1),(7,7)]])===nothing
    @test chain_hall_check(source,feb,[(7,1)],[[(7,1),(7,7)]])===nothing         # the witness does not say which cell is wrong
    @test rejects(()->chain_hall_check(source,feb,[(7,7)],Vector{Tuple{Int,Int}}[]))       # no witness
    @test rejects(()->chain_hall_check(source,feb,[(7,1),(7,7)],[[(7,1),(7,7)]]))          # two wrong cells exceed the deficiency 1: not minimal
    @test rejects(()->chain_hall_check(source,feb,Tuple{Int,Int}[],[[(7,1),(7,7)]]))       # a witness needs wrong cells: count 0 != 1
    @test rejects(()->chain_hall_check(source,feb,[(7,7)],[[(7,7)]]))                      # a single cell has no deficiency
    @test rejects(()->chain_hall_check(source,feb,[(7,7)],[[(7,1),(7,7)],[(7,1)]]))        # sets overlap
    @test rejects(()->chain_hall_check(source,feb,[(7,7)],[[(4,4),(7,7)]]))                # two body classes
    @test rejects(()->chain_hall_check(source,feb,[(7,7),(3,3)],[[(7,1),(7,7)]]))          # a wrong cell outside the sets
end
