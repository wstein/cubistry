using Test,Random
include(joinpath(@__DIR__,"search.jl"))
const M=Minimax
@testset "HTM and exact endpoint algebra" begin
    action=M.P.pose_action();a=M.Algebra(action)
    @test M.htm([1,1,7,-8,14,14])==2
    @test M.htm(M.simplify([1,2,-1],a))==1
    @test M.htm(M.simplify([7,8,-7],a))==1
    rng=MersenneTwister(115)
    words=[rand(rng,[-21:-1;1:21],80) for _ in 1:100]
    append!(words,[vcat(frame,[s*g],M.P.macro_inverse(frame)) for frame in a.frame_words for g in 1:21 for s in (-1,1)])
    for word in words
        normalized=M.improve_word(word,a)
        @test M.P.macro_word_perm(word,a.generators)==M.P.macro_word_perm(normalized,a.generators)
        @test M.htm(normalized)<=M.htm(word)
    end
end
@testset "Cached actions preserve every recorded orbit action" begin
    action=M.P.pose_action();a=M.Algebra(action);cache=M.cached_catalogues(action,a)
    @test length(cache)==10
    for k in 1:10,c in cache[k]
        p=M.P.macro_word_perm(c.word,a.generators)
        @test Tuple(UInt8.(p[(24k-23):24k].-(24k-24)))==c.key
        @test all(p[i]==i for i in 1:264 if !(24k-23<=i<=24k))
        @test all(c.key[c.inverse[j]]==j for j in 1:24)
        @test c.cost==M.P.chain_metrics(c.word,action).htm
    end
    @test_throws AssertionError M.orbit_search(Tuple(UInt16.(1:24)),Tuple{Int,Set{UInt16}}[],cache[1],a;width=-1)
    @test_throws AssertionError M.cached_catalogues(action,a;relax_budget=-1)
end
