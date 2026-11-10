#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Seam: extend the stored chain from its end state to 2028-02, check the join, then break it.
using Test
const HERE=@__DIR__
include(joinpath(HERE,"check_seam.jl"))
stored=joinpath(HERE,"evidence/moves.tsv");sstates=joinpath(HERE,"evidence/states")
out=mktempdir();ext=joinpath(out,"ext")
env=merge(ENV,Dict("WINDOW_END"=>"2028-02","SEAM_CHAIN"=>stored,"SEAM_STATES"=>sstates))
run(pipeline(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(HERE,"generate.jl")) $ext`,env);stdout=devnull))
chain=joinpath(ext,"candidate.moves.tsv")
@testset "chain seam" begin
    @test check_seam(stored,sstates,chain,ext)===nothing
    rows=readlines(chain);k=count(startswith("edge\t"),readlines(stored))
    function broken(f)
        p=joinpath(out,"broken.tsv");write(p,join(f(copy(rows)),'\n')*"\n");p
    end
    field(s,n,v)=(f=String.(split(s,'\t'));f[n]=v;join(f,'\t'))
    i=findlast(startswith("edge\t"),rows)
    @test_throws "seam join" check_seam(stored,sstates,broken(r->(r[i]=field(r[i],8,repeat("0",64));r)),ext)
    @test_throws "byte-identical prefix" check_seam(stored,sstates,broken(r->(r[3]=field(r[3],4,"1");r)),ext)
    @test_throws "byte-identical prefix" check_seam(stored,sstates,stored,sstates)
    # CM6: a stored chain whose last end digest is wrong must make the generator fail at the seam.
    bad=joinpath(out,"bad-stored.tsv");rs=readlines(stored);j=findlast(startswith("edge\t"),rs)
    rs[j]=field(rs[j],9,repeat("0",64));write(bad,join(rs,'\n')*"\n")
    benv=merge(ENV,Dict("WINDOW_END"=>"2028-02","SEAM_CHAIN"=>bad,"SEAM_STATES"=>sstates))
    err=joinpath(out,"bad.err")
    @test !success(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(HERE,"generate.jl")) $(joinpath(out,"bad-out"))`,benv));stdout=devnull,stderr=err))
    @test occursin("seam: replayed stored end state",read(err,String))
end
println("mutations: seam join, stored prefix and equal chain above; no full sweep")
