#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Check of the beam chain Nov 2026 -> Jun 2027 (evidence/beam-chain-2026-06/moves.tsv, or env
# BEAM_CHAIN): the chain is the beam pilot chain byte for byte up to Dec 2026, every edge ends in a
# legal front of the print window-2029-12, every digest matches, and each new edge is at most its
# bound. A bound is the HTM of the committed edge plus BEAM_SLACK (default 5). The stored greedy
# edges of the same months (440 384 60 347 342 498 HTM) are far above the bounds, so the greedy
# chain truncated to Jun 2027 must fail the same check (second testset).
# Mutation: BEAM_SLACK=-1 makes every edge exceed its bound and the first testset must fail.
using Test
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(CAL,"row1-window-print/common.jl"))
module WindowPlanner
include(joinpath(Main.CAL,"continuous/solver_chain.jl"))
end
const P=WindowPlanner
apply_strict_rule!(P)
Core.eval(P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
const SLACK=parse(Int,get(ENV,"BEAM_SLACK","5"))
# HTM of the committed edges Jan to Jun 2027 (beam, see README); the bound is HTM + SLACK.
const RESULT_HTM=Dict((2027,1)=>96,(2027,2)=>115,(2027,3)=>34,(2027,4)=>99,(2027,5)=>121,(2027,6)=>124)
const CHAIN=get(ENV,"BEAM_CHAIN",joinpath(@__DIR__,"evidence","beam-chain-2026-06","moves.tsv"))
const PILOT=joinpath(@__DIR__,"evidence","beam-pilot-2026-12","moves.tsv")
const STORED=joinpath(@__DIR__,"evidence","window-2029-12","moves.tsv")
const PRINT=joinpath(@__DIR__,"evidence","window-2029-12","printing.tsv")
labels=coupled_labels(read(joinpath(@__DIR__,"..","row1-revision/layout.tsv"),String))
goals=coupled_goals(labels,"names-band","window")
source=window_read_print(PRINT)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators]
lines(path)=String.(split(chop(read(path,String);tail=1),'\n'))
function replay(ls)
    state=P.identity_perm();edges=[];i=3
    while i<length(ls)
        f=String.(split(ls[i],'\t'));f[1]=="edge" || error("edge row expected");i+=1;mv=Tuple{Int,Int}[]
        while ls[i]!="end"
            m=split(ls[i],'\t');g,q=parse(Int,m[2]),parse(Int,m[3])
            push!(mv,(g,q));for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end;i+=1
        end
        push!(edges,(year=parse(Int,f[2]),month=parse(Int,f[3]),htm=parse(Int,f[4]),sh=f[8],eh=f[9],state=state,moves=mv));i+=1
    end
    edges
end
# All conditions of the chain as a list of failure reasons (empty = ok).
function chain_failures(ls)
    bad=String[]
    ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish" || return ["header or trailer"]
    edges=replay(ls)
    [(e.year,e.month) for e in edges]==[(2026,m) for m in 6:12]∪[(2027,m) for m in 1:6] || return ["months"]
    for (k,e) in enumerate(edges)
        actual=P.decode_physical(source,e.state,action)
        try P.validate_front(actual,goals[k+1]);catch;push!(bad,"front $(e.year)-$(e.month)");end
        P.state_digest(actual)==e.eh || push!(bad,"digest $(e.year)-$(e.month)")
        e.htm==count(((g,q),)->action.moves[g][2]!=99,e.moves) || push!(bad,"htm field $(e.year)-$(e.month)")
        k>1 && e.sh!=edges[k-1].eh && push!(bad,"adjacency $(e.year)-$(e.month)")
    end
    pl=lines(PILOT);cut=findfirst(l->startswith(l,"edge\t2026\t12\t"),pl)-1
    ls[1:cut]==pl[1:cut] || push!(bad,"prefix through Nov 2026")
    for e in edges[8:end]
        e.htm<=RESULT_HTM[(e.year,e.month)]+SLACK || push!(bad,"bound $(e.year)-$(e.month): $(e.htm) > $(RESULT_HTM[(e.year,e.month)]+SLACK)")
    end
    bad
end
@testset "beam chain Nov 2026 to Jun 2027" begin
    @test isfile(CHAIN)
    @test chain_failures(lines(CHAIN))==String[]
end
@testset "greedy chain fails the same check" begin
    st=lines(STORED);cut=findfirst(l->startswith(l,"edge\t2027\t7\t"),st)-1
    greedy=vcat(st[1:cut],["finish"])
    bad=chain_failures(greedy)
    @test length(filter(startswith("bound "),bad))==6   # all six months, Mar 2027 included (greedy 60 > 34 + 5)
    @test !any(b->startswith(b,"front")||startswith(b,"digest")||startswith(b,"adjacency")||startswith(b,"prefix"),bad)
end
println("mutations: not run (opt-in)")
