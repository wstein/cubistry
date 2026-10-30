using Test,Random
include(joinpath(@__DIR__,"chains.jl"))
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

@testset "Incremental cancellation is not an additive lower bound" begin
    action=M.P.pose_action();a=M.Algebra(action)
    occupants=Tuple(UInt16.(1:24));constraints=[(19,Set(UInt16[14]))]
    for words in ([[1,8],[-8,15],[1,15,8]],[[1,8,15,8],[-8,-15,-8,15],[1,15,8]])
        actions=[begin
            p=M.P.macro_word_perm(word,a.generators)
            M.Action(Tuple(UInt8.(p[1:24])),Tuple(invperm(Int.(p[1:24]))),word,M.htm(word))
        end for word in words]
        stats=M.SearchStats()
        greedy=M.orbit_search(occupants,constraints,actions,a;width=0,stats)
        @test M.htm(greedy)==3
        @test stats.greedy_scans==3 && stats.beam_attempts==0
        stats=M.SearchStats()
        answer=M.orbit_search(occupants,constraints,actions,a;width=8,maxdepth=2,budget=100,stats)
        @test M.htm(answer)==2
        @test M.P.invert(M.P.macro_word_perm(answer,a.generators))[19]==14
        @test stats.beam_attempts<=100
        @test stats.normalizations==stats.beam_attempts
    end
end

@testset "Same physical endpoint keeps nondominated trajectory labels" begin
    labels=Dict{Tuple,Vector{Any}}()
    path(costs)=(state=UInt16[1,2,3],costs=costs)
    @test M.retain_endpoint_label!(labels,path([2,8]))
    @test M.retain_endpoint_label!(labels,path([6,6]))
    @test length(only(values(labels)))==2
    # Lower current maximum does not dominate lower total: a future expensive
    # edge can erase the maximum difference while preserving the total benefit.
    @test !M.label_dominates(path([6,6]),path([2,8]))
    @test M.retain_endpoint_label!(labels,path([3,5]))
    @test only(only(values(labels))).costs==[3,5]
    @test !M.retain_endpoint_label!(labels,path([2,8]))
end

@testset "Invalid exports do not create or truncate evidence" begin
    action=M.P.pose_action()
    input=M.V.read_chain(joinpath(@__DIR__,"evidence","chain-1.moves.tsv"))
    mktempdir() do dir
        existing=joinpath(dir,"existing.tsv");write(existing,"sentinel")
        @test_throws AssertionError M.export_chain(existing,input,[Int[]],action)
        @test read(existing,String)=="sentinel"
        @test_throws AssertionError M.export_chain(existing,input,[Int[],Int[]],action;hashes=[("a","b")])
        @test read(existing,String)=="sentinel"
        missing=joinpath(dir,"missing.tsv")
        @test_throws AssertionError M.export_chain(missing,input,Vector{Int}[],action)
        @test !isfile(missing)
    end
end

@testset "Production-budget relaxation preserves cached actions" begin
    action=M.P.pose_action();a=M.Algebra(action)
    baseline=M.cached_catalogues(action,a;relax_budget=0)
    relaxed=M.cached_catalogues(action,a;relax_budget=60000)
    improved=0
    for k in 1:10
        costs=Dict(c.key=>c.cost for c in baseline[k])
        @test length(relaxed[k])==length(baseline[k])
        for c in relaxed[k]
            p=M.P.macro_word_perm(c.word,a.generators)
            @test Tuple(UInt8.(p[(24k-23):24k].-(24k-24)))==c.key
            @test all(p[i]==i for i in 1:264 if !(24k-23<=i<=24k))
            @test c.cost==M.P.chain_metrics(c.word,action).htm
            @test c.cost<=costs[c.key]
            improved+=c.cost<costs[c.key]
        end
    end
    @test improved>0
end
