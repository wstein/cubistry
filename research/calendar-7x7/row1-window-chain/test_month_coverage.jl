#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Generator and verifier of the coverage summary: the stored coverage verifies, every tampered copy is rejected at its reason.
using Test, SHA
dir=joinpath(@__DIR__,"evidence","month-list")
list=joinpath(dir,"months-S2.tsv");pin=bytes2hex(sha256(read(list)))
julia=Base.julia_cmd()
gen(kind,l=list,p=pin,status=joinpath(dir,"status-S2.tsv"),last="2050-01")=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $kind $l $p $status $last`,String)
function verify(tsv,json;l=list,p=pin,ev=dir)
    err=IOBuffer();ok=success(pipeline(`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $l $p $tsv $json $ev`;stderr=err,stdout=devnull))
    ok,String(take!(err))
end
tsv=read(joinpath(dir,"coverage-S2.tsv"),String);json=read(joinpath(dir,"coverage-S2.json"),String)
function tamper(name,t,j;kw...)
    d=mktempdir();write(joinpath(d,"c.tsv"),t);write(joinpath(d,"c.json"),j);verify(joinpath(d,"c.tsv"),joinpath(d,"c.json");kw...)
end
@testset "coverage generator and verifier" begin
    @test gen("tsv")==tsv && gen("json")==json
    @test verify(joinpath(dir,"coverage-S2.tsv"),joinpath(dir,"coverage-S2.json"))[1]
    @test occursin("headline\tchain-gapless\t2026-05\t2037-01\t129\n",tsv)
    ok,e=tamper("headline-count",replace(tsv,"2037-01\t129\n"=>"2037-01\t130\n";count=1),json);@test !ok && occursin("headline mismatch",e)
    ok,e=tamper("headline-start",replace(tsv,"chain-gapless\t2026-05"=>"chain-gapless\t2026-03";count=1),json);@test !ok && occursin("headline mismatch",e)
    ok,e=tamper("run-split",replace(tsv,"run\t2037-03\t2043-01\t71"=>"run\t2037-03\t2043-01\t70";count=1),json);@test !ok && occursin("runs mismatch",e)
    ok,e=tamper("gap-missing",replace(tsv,r"gap\t2043-02[^\n]*\n"=>"";count=1),json);@test !ok
    ok,e=tamper("unsat-single-receipt",replace(tsv,"corner-2043-02-julia.tsv;corner-2043-02-flix.tsv"=>"corner-2043-02-julia.tsv";count=1),json);@test !ok && occursin("Julia and a Flix receipt",e)
    ok,e=tamper("unsat-unknown-receipt-file",replace(tsv,"corner-2043-02-flix.tsv"=>"corner-2043-02-nope.tsv";count=1),json);@test !ok && occursin("receipts exist",e)
    ok,e=tamper("unsat-wrong-receipt",replace(tsv,"corner-2043-02-julia.tsv;corner-2043-02-flix.tsv"=>"corner-2026-02-julia.tsv;corner-2026-02-flix.tsv";count=1),json);@test !ok && occursin("receipt contains the gap month",e)
    base=mktempdir();ev2=joinpath(base,"month-list");mkpath(ev2);w37=joinpath(base,"window-2037-01");mkpath(w37)
    for f in readdir(dir);cp(joinpath(dir,f),joinpath(ev2,f));end
    for t in ("julia","flix");cp(joinpath(dir,"..","window-2037-01","corner-2037-02-$t.tsv"),joinpath(w37,"corner-2037-02-$t.tsv"));end
    open(joinpath(ev2,"corner-2043-02-flix.tsv"),"a") do io;println(io,"x");end
    ok,e=tamper("unsat-receipts-differ",tsv,json;ev=ev2);@test !ok && occursin("byte-identical",e)
    ok,e=tamper("before-root-flag",replace(tsv,"2026-02\t2026-02\t1\tbefore_root\tprint_member=no"=>"2026-02\t2026-02\t1\tbefore_root\tprint_member=yes";count=1),json);@test !ok && occursin("before_root mismatch",e)
    ok,e=tamper("json-headline",tsv,replace(json,"\"months\": 129}"=>"\"months\": 131}";count=1));@test !ok && occursin("json headline mismatch",e)
    ok,e=tamper("json-gap",tsv,replace(json,"\"2043-02\", \"status\""=>"\"2043-03\", \"status\"";count=1));@test !ok && occursin("json gaps mismatch",e)
    ok,e=tamper("wrong-pin",tsv,json;p=repeat("0",64));@test !ok && occursin("month list pin",e)
    @test_throws ProcessFailedException gen("tsv",list,repeat("0",64))                 # generator also refuses a wrong pin
    st=tempname();write(st,"month\tstatus\tevidence\n2026-07\tunknown\tx\n")           # a status row for a month that is not a gap
    @test_throws ProcessFailedException gen("tsv",list,pin,st)
    @test occursin("headline\tchain-gapless\t2026-05\t2037-01\t129",gen("tsv",list,pin,joinpath(dir,"status-S2.tsv"),"2043-12"))
end
println("mutations: not run (opt-in)")
