#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run from research/calendar-7x7: julia --startup-file=no row1-window-chain/evidence/config-coverage/test_root.jl
# Root handling of the untrusted designer design_skip.jl: the first month of WINDOW_MONTHS is the identity pose.
using Test
const CAL=normpath(joinpath(@__DIR__,"..","..",".."));const SKIP=joinpath(CAL,"row1-window-chain","evidence","window-skip")
const LAYOUT=joinpath(CAL,"row1-revision","layout.tsv");const PRINT_B=joinpath(SKIP,"printing-S2.tsv")
function run_design(months;root=nothing)
    env=copy(ENV);env["WINDOW_MONTHS"]=months;delete!(env,"ROOT");root===nothing || (env["ROOT"]=root)
    err=IOBuffer()
    # LAYOUT stands in for the native library: only the assertions before the first solver call are exercised
    p=run(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(SKIP,"design_skip.jl")) $LAYOUT $LAYOUT /dev/null`,env));stdout=devnull,stderr=err))
    (String(take!(err)),p.exitcode)
end
@testset "root month of the designer" begin
    e,rc=run_design("2026-01,2026-03",root="2026-05");@test rc!=0 && occursin("ROOT is the first month of WINDOW_MONTHS",e)
    e,rc=run_design("2026-01,2026-03",root="2026-01");@test !occursin("ROOT is the first month",e)
    e,rc=run_design("2026-01,2026-03");@test !occursin("ROOT is the first month",e)
end
@testset "root front surfaces are never frozen to the seed" begin
    ENV["DESIGN_LIB"]="1";ENV["SEED_PRINT"]=PRINT_B;ENV["SEED_FRAC"]="1.0";ENV["SEED_SALT"]="0"
    include(joinpath(SKIP,"design_skip.jl"))
    load_seed()
    homes=all_homes();front=[(h,FRONT_NORMAL) for h in homes if h[3]==3 && FRONT_NORMAL in normal_faces(h)]
    @test length(front)==49
    @test all(hn->haskey(SEED,hn) && !frozen_face(hn...),front)          # seed has the surface, root rule unfreezes it
    other=[(h,n) for h in homes for n in normal_faces(h) if !root_front(h,n)]
    @test all(hn->frozen_face(hn...),other)                              # SEED_FRAC=1.0: everything else is frozen
end
