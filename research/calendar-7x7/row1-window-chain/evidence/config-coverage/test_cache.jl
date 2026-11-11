#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run from research/calendar-7x7: julia --startup-file=no row1-window-chain/evidence/config-coverage/test_cache.jl
# Result directory of the untrusted designer: a solved class is stored by the digest of its SMT problem and never solved twice.
using Test
const SKIP=normpath(joinpath(@__DIR__,"..","window-skip"))
ENV["DESIGN_LIB"]="1"
include(joinpath(SKIP,"design_skip.jl"))
@testset "solved classes are read from the result directory" begin
    dir=mktempdir();calls=Ref(0)
    fake(smt)=(calls[]+=1;(;status=1,elapsed=1.5,values=Dict("p_1_1"=>length(smt),"p_2_1"=>7),reason=""))
    a="(set-logic QF_BV)\n(check-sat)\n";b="(set-logic QF_BV)\n(declare-const p_1_1 (_ BitVec 2))\n"
    r1=solve_cached(a,dir;solver=fake);@test calls[]==1 && r1.status==1 && r1.values["p_1_1"]==length(a)
    r2=solve_cached(a,dir;solver=fake);@test calls[]==1 && r2.status==1 && r2.values==r1.values && r2.reason=="cached"   # read, not solved
    r3=solve_cached(b,dir;solver=fake);@test calls[]==2 && r3.values["p_1_1"]==length(b)                                 # other problem: other digest
    @test isfile(joinpath(dir,bytes2hex(sha256(a))*".tsv")) && isfile(joinpath(dir,bytes2hex(sha256(b))*".tsv"))
    unk(smt)=(calls[]+=1;(;status=0,elapsed=9.0,values=Dict{String,Int}(),reason="timeout"))
    c="(check-sat)\n";solve_cached(c,dir;solver=unk);solve_cached(c,dir;solver=unk);@test calls[]==4 && !isfile(joinpath(dir,bytes2hex(sha256(c))*".tsv"))  # only SAT is stored
    @test solve_cached(a,"";solver=fake).reason=="" && calls[]==5                                                         # no directory: no cache
    # a damaged entry (digest line does not match) is not trusted
    write(joinpath(dir,bytes2hex(sha256(a))*".tsv"),"digest\t"*"0"^64*"\np_1_1\t1\n");@test solve_cached(a,dir;solver=fake).reason=="" && calls[]==6
end
