#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run from research/calendar-7x7: julia --startup-file=no row1-window-chain/evidence/window-skip/test_skip.jl
using Test
include(joinpath(@__DIR__,"months.jl"))
const CAL=normpath(joinpath(@__DIR__,"..","..",".."));const LAYOUT=joinpath(CAL,"row1-revision","layout.tsv")
const E37=joinpath(CAL,"row1-window-chain","evidence","window-2037-01")
mlist(a,b)=[(2026+(i-1)÷12,(i-1)%12+1) for i in a:b]            # index 1 = 2026-01
mstr(xs)=join([string(y,'-',lpad(m,2,'0')) for (y,m) in xs],',')
function sub(args...;months)
    env=copy(ENV);env["WINDOW_MONTHS"]=months
    out=IOBuffer();err=IOBuffer()
    p=run(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(@__DIR__,"skip_check.jl")) $args`,env));stdout=out,stderr=err))
    (String(take!(out)),String(take!(err)),p.exitcode)
end
const BASE=mlist(5,133)                                           # 2026-05 .. 2037-01
labels=coupled_labels(read(LAYOUT,String))
@testset "month list parsing" begin
    @test parse_months("2026-05,2026-07")==[(2026,5),(2026,7)]
    @test_throws AssertionError parse_months("2025-12")
    @test_throws AssertionError parse_months("2026-05,2026-05")
    @test_throws AssertionError parse_months("2026-13")
end
@testset "corner demand of a target set" begin
    d=corner_demand(labels,BASE);@test (d.n,d.required,d.lemma)==(129,23,false)
    d=corner_demand(labels,vcat(BASE,[(2037,2)]));@test (d.n,d.required,d.blank,d.lemma)==(130,24,2,true)
    @test corner_demand(labels,vcat(BASE,[(2037,3)])).lemma==false
    @test corner_demand(labels,vcat(BASE,[(2037,3)])).required==23
    # Februaries 2026 and 2043 raise the demand to 24 as well
    for ym in ((2026,2),(2043,2));d=corner_demand(labels,vcat(BASE,[ym]));@test (d.required,d.lemma)==(24,true);end
    # the set without 2037-02 but with 2037-03 is not obstructed; order does not matter
    @test corner_demand(labels,reverse(vcat(BASE,[(2037,3)]))).required==23
    # the target set matters, not the interval: 2037-02 alone with a few months
    @test !corner_demand(labels,[(2026,5),(2037,2)]).lemma
end
@testset "receipts equal the committed contiguous-window receipts" begin
    out,_,rc=sub("lemma",LAYOUT;months=mstr(BASE));@test rc==0 && out==read(joinpath(E37,"corner-2037-01-julia.tsv"),String)
    out,_,rc=sub("lemma",LAYOUT;months=mstr(vcat(BASE,[(2037,2)])));@test rc==0 && out==read(joinpath(E37,"corner-2037-02-julia.tsv"),String)
    @test endswith(strip(out),"UNSAT\tfixed-print-corner-body-matching\tunique-always-visible-face")
    out,_,rc=sub("print",LAYOUT,joinpath(E37,"printing.tsv"),joinpath(E37,"front-matches.tsv");months=mstr(BASE))
    @test rc==0 && out==read(joinpath(E37,"print-julia.tsv"),String)
    # a month list that differs from the matches file is rejected
    _,err,rc=sub("print",LAYOUT,joinpath(E37,"printing.tsv"),joinpath(E37,"front-matches.tsv");months=mstr(vcat(BASE[1:10],BASE[12:end],[(2037,3)])))
    @test rc==1 && occursin("INVALID",err)
    _,err,rc=sub("print",LAYOUT,joinpath(E37,"printing.tsv"),joinpath(E37,"front-matches.tsv");months=mstr(reverse(BASE)))
    @test rc==1
end
@testset "fixed 2037-01 print front-matches single months" begin
    source=window_read_print(joinpath(E37,"printing.tsv"))
    fits(y,m)=begin b=stacked_board(y,m,PURE_VARIANT);for c in 1:7;t=labels[m][c];b[1,c]=(t,isempty(t) ? "band" : "month");end
        try;window_match(source,b);true;catch e;e isa AssertionError ? false : rethrow();end;end
    @test fits(2037,3) && fits(2026,1) && fits(2026,3)
    @test !fits(2037,2) && !fits(2037,4) && !fits(2026,4)
end
