#!/usr/bin/env julia
using Test
include(joinpath(@__DIR__,"solver_macros.jl"))
@testset "Candidate sequence normalization" begin
    @test macro_normalize([1,1,1]) == [-1]
    @test isempty(macro_normalize([1,2,-2,-1]))
    @test macro_moves([1,1,2,2,2]) == [(1,2),(2,-1)]
    action = pose_action(); generators = [UInt16.(g) for g in action.generators]
    for w in ([1,1,1],[1,2,-2,-1],[3,3,3,8,-8,3],[1,1,2,2,2])
        @test macro_word_perm(w,generators) == macro_word_perm(macro_normalize(w),generators)
    end
end
@testset "All generated macros have exactly their recorded legal action" begin
    action = pose_action(); generators = [UInt16.(g) for g in action.generators]
    catalogs = macro_catalogues(action)
    @test length(catalogs[1]) == 1008
    @test length(catalogs[2]) == length(catalogs[3]) == 4048
    for k in keys(catalogs), (key,word) in catalogs[k]
        p = macro_word_perm(word,generators)
        @test Tuple(UInt8.(p[(24k-23):24k] .- (24k-24))) == key
        @test all(p[i] == i for i in 1:264 if !(24k-23 <= i <= 24k))
        @test macro_word_perm(word,generators) == macro_word_perm(macro_normalize(word),generators)
    end
end
