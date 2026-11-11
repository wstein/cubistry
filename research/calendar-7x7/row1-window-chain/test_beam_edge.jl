#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Pilot check for the single edge Nov 2026 -> Dec 2026 of the window chain (print window-2029-12).
# The stored greedy edge has 271 HTM; the old design needed about 95 to 127 HTM per edge. This test
# replays the pilot chain (evidence/beam-pilot-2026-12/moves.tsv, or env BEAM_PILOT_CHAIN) with the
# print, checks that its prefix is the stored chain byte for byte, that every edge ends in a legal
# front (all 49 front cells allowed) and that the Dec 2026 edge is at most MAX_HTM (130, the top of the old design range).
using Test
const CAL=normpath(joinpath(@__DIR__,".."))
include(joinpath(@__DIR__,"..","row1-window-print/common.jl"))
module WindowPlanner
include(joinpath(Main.CAL,"continuous/solver_chain.jl"))
end
const P=WindowPlanner
apply_strict_rule!(P)
Core.eval(P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
const MAX_HTM=130
const PILOT=get(ENV,"BEAM_PILOT_CHAIN",joinpath(@__DIR__,"evidence","beam-pilot-2026-12","moves.tsv"))
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
        f=String.(split(ls[i],'\t'));@test f[1]=="edge";i+=1;first=i;mv=Tuple{Int,Int}[]
        while ls[i]!="end"
            m=split(ls[i],'\t');g,q=parse(Int,m[2]),parse(Int,m[3])
            push!(mv,(g,q));for _ in 1:(q==-1 ? 3 : q);state=P.compose(state,gens[g]);end;i+=1
        end
        push!(edges,(year=parse(Int,f[2]),month=parse(Int,f[3]),htm=parse(Int,f[4]),sh=f[8],eh=f[9],state=state,moves=mv));i+=1
    end
    edges
end
@testset "beam pilot Nov to Dec 2026" begin
    @test isfile(PILOT)
    pl=lines(PILOT);st=lines(STORED)
    @test pl[1]=="cubistry.calendar7.chain.v1" && pl[end]=="finish" && pl[2]==st[2]
    edges=replay(pl)
    @test [(e.year,e.month) for e in edges]==[(2026,m) for m in 6:12]
    stored=replay(st)
    # prefix (rows up to the end of the Nov 2026 edge) is the stored chain, byte for byte
    cut=findfirst(l->startswith(l,"edge\t2026\t12\t"),st)-1
    @test pl[1:cut]==st[1:cut]
    @test edges[6].eh==stored[6].eh   # same Nov 2026 state
    for (k,e) in enumerate(edges)
        actual=P.decode_physical(source,e.state,action)
        P.validate_front(actual,goals[k+1])   # throws unless the whole front matches the target month
        @test P.state_digest(actual)==e.eh
    end
    @test edges[7].sh==edges[6].eh
    @test edges[7].htm==count(((g,q),)->action.moves[g][2]!=99,edges[7].moves)
    @test edges[7].htm<=MAX_HTM
end
println("mutations: not run (opt-in)")
