#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run from research/calendar-7x7: julia --startup-file=no row1-window-chain/evidence/config-coverage/test_freeze.jl
# Freeze rule of the untrusted designer with CLASS_FRACS: unlisted classes are frozen (default 1.0), a listed class at 0.0 is free,
# and only the 49 root front surfaces (z=3, normal (0,0,1)) are exempt from freezing.
using Test
const SKIP=normpath(joinpath(@__DIR__,"..","window-skip"))
ENV["DESIGN_LIB"]="1";ENV["SEED_PRINT"]=joinpath(SKIP,"printing-S2.tsv");ENV["SEED_FRAC"]="1.0";ENV["SEED_SALT"]="0";ENV["CLASS_FRACS"]="-3,-3,-2:0.0"
include(joinpath(SKIP,"design_skip.jl"))
@testset "freeze rule with CLASS_FRACS" begin
    load_seed()
    homes=all_homes();surf=[(h,n) for h in homes for n in normal_faces(h)]
    isroot(h,n)=h[3]==3 && n==(0,0,1)                                  # independent of root_front
    @test count(s->isroot(s...),surf)==49
    free=[s for s in surf if join(bodykey(s[1]),',')=="-3,-3,-2" && !isroot(s...)]
    rest=[s for s in surf if join(bodykey(s[1]),',')!="-3,-3,-2" && !isroot(s...)]
    @test !isempty(free) && !any(s->frozen_face(s...),free)             # listed class at 0.0: nothing frozen
    @test !isempty(rest) && all(s->frozen_face(s...),rest)              # unlisted classes: default 1.0, so frozen (including z=3 faces that are not fronts)
    @test any(s->s[1][3]==3 && !isroot(s...),rest)
    @test !any(s->frozen_face(s...),[s for s in surf if isroot(s...)])  # root fronts are never frozen
end
