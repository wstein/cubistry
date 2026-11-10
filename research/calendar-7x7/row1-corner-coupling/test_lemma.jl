#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
using Test
include(joinpath(@__DIR__,"lemma.jl"))
@testset "Singleton always-visible corner face" begin
    @test corner_anchor_contradiction(24,8,3,1,91,91)
    @test !corner_anchor_contradiction(23,8,3,1,91,91) # One free face may duplicate the anchor.
    @test !corner_anchor_contradiction(21,8,3,1,21,21) # Actual window has three free faces.
    @test !corner_anchor_contradiction(25,8,3,1,91,91) # Capacity overflow is a different proof.
    @test !corner_anchor_contradiction(24,8,3,2,91,91) # Multiple anchor copies are not forced unique.
    @test !corner_anchor_contradiction(24,8,3,1,90,91) # The anchor need not occupy its body in every target.
    @test !corner_anchor_contradiction(24,8,3,1,0,91)
    @test !corner_anchor_contradiction(24,8,3,1,0,0)
    @test !corner_anchor_contradiction(8,8,1,1,10,10) # A one-face body hides no other face.
    @test corner_anchor_contradiction(3,1,3,1,1,1)
    @test corner_anchor_contradiction(4,2,2,1,10,10)
    @test_throws AssertionError corner_anchor_contradiction(24,0,3,1,91,91)
    @test_throws AssertionError corner_anchor_contradiction(24,8,0,1,91,91)
    @test_throws AssertionError corner_anchor_contradiction(24,8,3,1,92,91)
end
println("mutations: not run (opt-in)")
