#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unit tests of the 29 rule of check.jl (chain_best_effort_29) on the state after the best-effort edge into 2026-02 (evidence/root-2019/best-effort-2026-02,
# state-02: the red 29 stands in (7,1)). The end-to-end rejections by all three checkers are in run_root2019_checks.sh (cases rule29-*, corner-2026-02-71-rule29).
# Julia 1.11.5: julia --startup-file=no test_best_effort_29.jl
using Test
include(joinpath(@__DIR__,"check.jl"))
const FIX=joinpath(@__DIR__,"evidence","root-2019","best-effort-2026-02")
function load_state(path)
    t(s)=Tuple(parse.(Int,split(s,',')))
    [(id=parse(Int,f[1]),piece=parse(Int,f[2]),pos=t(f[3]),normal=t(f[4]),up=t(f[5]),text=f[6],ink=f[7]) for f in (split(l,'\t';keepempty=true) for l in readlines(path)[2:end])]
end
const ST=load_state(joinpath(FIX,"states","state-02.tsv"))
function with_front(f,cell)         # replace the front sticker of the cell by f(sticker)
    r,c=cell;[(s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL) ? f(s) : s for s in ST]
end
rule(state,wrong)=chain_best_effort_29(state,wrong)
@testset "29 rule of check.jl" begin
    @testset "accepted" begin
        @test rule(ST,[(7,1)])===nothing
    end
    @testset "wrong cells" begin
        for w in (Tuple{Int,Int}[],[(4,4)],[(7,2)],[(1,1)],[(7,1),(7,7)],[(7,7),(7,1)])
            @test_throws "one wrong cell, (7,1) or (7,7)" rule(ST,w)
        end
        @test_throws "text 29, ink red, upright" rule(ST,[(7,7)])          # (7,7) is a corner cell but its sticker does not show 29 in this state
    end
    @testset "sticker" begin
        @test_throws "text 29, ink red, upright" rule(with_front(s->merge(s,(text="28",)),(7,1)),[(7,1)])
        @test_throws "text 29, ink red, upright" rule(with_front(s->merge(s,(text="92",)),(7,1)),[(7,1)])
        @test_throws "text 29, ink red, upright" rule(with_front(s->merge(s,(ink="dark",)),(7,1)),[(7,1)])
        @test_throws "text 29, ink red, upright" rule(with_front(s->merge(s,(up=IMAGE_UPS[2],)),(7,1)),[(7,1)])
        @test_throws "text 29, ink red, upright" rule(with_front(s->merge(s,(up=IMAGE_UPS[3],)),(7,1)),[(7,1)])
    end
    @testset "other corner" begin       # a state that shows the red 29 in (7,7): the rule accepts (7,7) as the cell of the fallback
        @test rule(with_front(s->merge(s,(text="29",ink="red",up=IMAGE_UPS[1])),(7,7)),[(7,7)])===nothing
    end
end
