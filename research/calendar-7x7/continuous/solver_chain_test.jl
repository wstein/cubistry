#!/usr/bin/env julia
using Test
include(joinpath(@__DIR__,"solver_chain.jl"))

@testset "Expanded middle layers are exact legal physical moves" begin
    action = pose_action(); alphabet = chain_alphabet(action)
    @test length(alphabet.words) == length(alphabet.generators) == 24
    for axis in 1:3
        p = alphabet.generators[21+axis]
        expected = [findfirst(==(pose[1][axis] == 0 ? quarterpose(pose,axis) : pose),action.points) for pose in action.points]
        @test Int.(p) == expected
        @test all(abs(g) <= 21 for g in alphabet.words[21+axis])
        @test compose(p,invert(p)) == identity_perm()
    end
end

@testset "Move metrics and failure boundaries" begin
    action = pose_action()
    @test chain_metrics([1,1,7,-8,14,14],action) == (htm=2,qtm=3,rotations=2,rotation_qtm=3)
    @test chain_failure_class(ErrorException("UNSUPPORTED: missing algorithm")) == "UNSUPPORTED_SOLVER"
    @test chain_failure_class(ErrorException("Bounded macro search stalled in orbit 4")) == "SEARCH_BUDGET_EXHAUSTED"
    @test chain_failure_class(AssertionError("artwork mismatch")) == "CANDIDATE_VERIFICATION_FAILURE"
    @test chain_failure_class(ArgumentError("bad input")) == "IMPLEMENTATION_ERROR"
end

@testset "All ten isolated macro catalogues replay exactly" begin
    action = pose_action(); generators = [UInt16.(g) for g in action.generators]
    catalogs = chain_catalogues(action)
    @test sort!(collect(keys(catalogs))) == collect(1:10)
    @test length(catalogs[1]) == 1008
    @test length(catalogs[4]) == 1760
    for k in setdiff(collect(1:10),[1,4]);@test length(catalogs[k]) == 4048;end
    for k in 1:10,(key,word) in catalogs[k]
        p = macro_word_perm(word,generators)
        @test Tuple(UInt8.(p[(24k-23):24k] .- (24k-24))) == key
        @test all(p[i] == i for i in 1:264 if !(24k-23 <= i <= 24k))
        @test macro_word_perm(macro_normalize(word),generators) == p
    end
end
