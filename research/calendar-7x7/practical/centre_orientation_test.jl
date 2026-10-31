#!/usr/bin/env julia
# Issue #135: the orbit-11 (core/centre) front constraint must agree with
# validate_front on the centre cell (4,4) for every one of the 24 core poses.
using Test
include(joinpath(@__DIR__,"solver_macros.jl"))

const CENTRE = (0,0,3)

# State in which core pose `o` (orbit 11, global point 241..264) occupies the
# front centre; the displaced front-centre core takes its old place. Rigid.
function centre_occupant_perm(action,o)
    pt = findfirst(p -> p[1] == CENTRE, action.points)
    from = action.points[o][1]
    perm = UInt16.(1:264)
    r1 = only(filter(r -> pose_rotate(action.points[o],r) == action.points[pt],ROTATIONS))
    for p in findall(q -> q[1] == from,action.points)
        perm[p] = findfirst(==(pose_rotate(action.points[p],r1)),action.points)
    end
    if from != CENTRE
        r2 = first(filter(r -> rotate(CENTRE,r) == from,ROTATIONS))
        for p in findall(q -> q[1] == CENTRE,action.points)
            perm[p] = findfirst(==(pose_rotate(action.points[p],r2)),action.points)
        end
    end
    perm
end

function centre_valid(state,target)
    s = only(filter(s -> s.normal == FRONT_NORMAL && s.pos == CENTRE,state))
    angle = only(findall(==(s.up),IMAGE_UPS)) - 1
    g,ink = target.board[4,4]
    image_normal(s.text,angle,s.ink) == image_normal(g,0,ink)
end

@testset "Orbit-11 constraints agree with validate_front at the centre cell" begin
    action = pose_action()
    source = read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    perms = Dict(o => centre_occupant_perm(action,o) for o in 241:264)
    states = Dict(o => decode_physical(source,perms[o],action) for o in 241:264)
    for year in 2026:2028, month in 1:12
        target = macro_calendar_target(year,month)
        index,allowed = only(macro_front_constraints(source,target,action,11))
        for o in 241:264
            @test (UInt16(o) in allowed) == centre_valid(states[o],target)
        end
        # The 2026-04 centre glyph "8" is half-turn symmetric: two poses are valid.
        year == 2026 && month == 4 && @test length(allowed) == 2
    end
end
