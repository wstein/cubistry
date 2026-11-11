#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Generator and verifier of the coverage summary: the stored coverage verifies, every tampered copy is rejected at its reason.
using Test, SHA
dir=joinpath(@__DIR__,"evidence","month-list")
sha(p)=bytes2hex(sha256(read(p)))
list=joinpath(dir,"months-S2.tsv");pin=sha(list)
clist=joinpath(dir,"months-chain-2026-03.tsv");cpin=sha(clist)
julia=Base.julia_cmd()
gen(kind,l,p,status,last,start,root,best="-")=read(`$julia --startup-file=no $(joinpath(@__DIR__,"month_coverage.jl")) $kind $l $p $status $last $start $root $best`,String)
genS2(kind;last="2050-01",start="2026-05",root="2026-05",l=list,p=pin,status=joinpath(dir,"status-S2.tsv"))=gen(kind,l,p,status,last,start,root)
genC(kind;last="2050-01",start="2026-03",root="1980-01",best=joinpath(dir,"best-effort-chain.tsv"))=gen(kind,clist,cpin,joinpath(dir,"status-none.tsv"),last,start,root,best)
function verify(tsv,json;l=list,p=pin,ev=dir,start="2026-05",root="2026-05")
    err=IOBuffer();ok=success(pipeline(`$julia --startup-file=no $(joinpath(@__DIR__,"verify_coverage.jl")) $l $p $tsv $json $ev $start $root`;stderr=err,stdout=devnull))
    ok,String(take!(err))
end
rd(f)=read(joinpath(dir,f),String)
tsv=rd("coverage-S2.tsv");json=rd("coverage-S2.json");ctsv=rd("coverage-chain-2026-03.tsv");cjson=rd("coverage-chain-2026-03.json")
function tamper(t,j;kw...)
    d=mktempdir();write(joinpath(d,"c.tsv"),t);write(joinpath(d,"c.json"),j);verify(joinpath(d,"c.tsv"),joinpath(d,"c.json");kw...)
end
ctamper(t,j;kw...)=tamper(t,j;l=clist,p=cpin,start="2026-03",root="1980-01",kw...)
@testset "coverage generator and verifier" begin
    @test genS2("tsv")==tsv && genS2("json")==json
    @test genC("tsv")==ctsv && genC("json")==cjson
    @test verify(joinpath(dir,"coverage-S2.tsv"),joinpath(dir,"coverage-S2.json"))[1]
    @test verify(joinpath(dir,"coverage-chain-2026-03.tsv"),joinpath(dir,"coverage-chain-2026-03.json");l=clist,p=cpin,start="2026-03",root="1980-01")[1]
    @test occursin("headline\texact-gapless\t2026-05\t2037-01\t129\n",tsv)
    @test occursin("headline\texact-gapless\t2026-03\t2037-01\t131\n",ctsv) && occursin("best_effort\t2\t",ctsv) && occursin("root\t1980-01\tstart\t2026-03",ctsv)
    ok,e=tamper(replace(tsv,"2037-01\t129\n"=>"2037-01\t130\n";count=1),json);@test !ok && occursin("headline mismatch",e)
    ok,e=tamper(replace(tsv,"exact-gapless\t2026-05"=>"exact-gapless\t2026-03";count=1),json);@test !ok && occursin("headline mismatch",e)
    ok,e=tamper(replace(tsv,"run\t2037-03\t2043-01\t71"=>"run\t2037-03\t2043-01\t70";count=1),json);@test !ok && occursin("runs mismatch",e)
    ok,e=tamper(replace(tsv,r"gap\t2043-02[^\n]*\n"=>"";count=1),json);@test !ok
    ok,e=tamper(replace(tsv,"corner-2043-02-julia.tsv;corner-2043-02-flix.tsv"=>"corner-2043-02-julia.tsv";count=1),json);@test !ok && occursin("Julia and a Flix receipt",e)
    ok,e=tamper(replace(tsv,"corner-2043-02-flix.tsv"=>"corner-2043-02-nope.tsv";count=1),json);@test !ok && occursin("receipts exist",e)
    ok,e=tamper(replace(tsv,"corner-2043-02-julia.tsv;corner-2043-02-flix.tsv"=>"corner-2026-02-julia.tsv;corner-2026-02-flix.tsv";count=1),json);@test !ok && occursin("receipt contains the gap month",e)
    base=mktempdir();ev2=joinpath(base,"month-list");mkpath(ev2);w37=joinpath(base,"window-2037-01");mkpath(w37)
    for f in readdir(dir);cp(joinpath(dir,f),joinpath(ev2,f));end
    for t in ("julia","flix");cp(joinpath(dir,"..","window-2037-01","corner-2037-02-$t.tsv"),joinpath(w37,"corner-2037-02-$t.tsv"));end
    open(joinpath(ev2,"corner-2043-02-flix.tsv"),"a") do io;println(io,"x");end
    ok,e=tamper(tsv,json;ev=ev2);@test !ok && occursin("byte-identical",e)
    ok,e=tamper(replace(tsv,"2026-02\t2026-02\t1\tbefore_start\tprint_member=no"=>"2026-02\t2026-02\t1\tbefore_start\tprint_member=yes";count=1),json);@test !ok && occursin("before_start mismatch",e)
    ok,e=tamper(tsv,replace(json,"\"months\": 129}"=>"\"months\": 131}";count=1));@test !ok && occursin("json headline mismatch",e)
    ok,e=tamper(tsv,replace(json,"\"2043-02\", \"status\""=>"\"2043-03\", \"status\"";count=1));@test !ok && occursin("json gaps mismatch",e)
    ok,e=tamper(tsv,json;p=repeat("0",64));@test !ok && occursin("month list pin",e)
    @test_throws ProcessFailedException genS2("tsv";p=repeat("0",64))
    st=tempname();write(st,"month\tstatus\tevidence\n2026-07\tunknown\tx\n");@test_throws ProcessFailedException genS2("tsv";status=st)
    @test occursin("headline\texact-gapless\t2026-05\t2037-01\t129",genS2("tsv";last="2043-12"))
    # the start month is a parameter: from 2026-03 the headline grows to 131 months and only 2026-01 and 2026-02 are before_start
    t3=genS2("tsv";start="2026-03");j3=genS2("json";start="2026-03")
    @test occursin("headline\texact-gapless\t2026-03\t2037-01\t131\n",t3) && occursin("before_start\t2\n",t3)
    d3=mktempdir();write(joinpath(d3,"c.tsv"),t3);write(joinpath(d3,"c.json"),j3)
    @test verify(joinpath(d3,"c.tsv"),joinpath(d3,"c.json");start="2026-03")[1]
    ok,e=verify(joinpath(d3,"c.tsv"),joinpath(d3,"c.json");start="2026-05");@test !ok && occursin("list line",e)
    ok,e=verify(joinpath(dir,"coverage-S2.tsv"),joinpath(dir,"coverage-S2.json");start="2026-03");@test !ok
    # the root month is a parameter, separate from the start: a wrong root in the file or on the command line is rejected
    ok,e=verify(joinpath(dir,"coverage-S2.tsv"),joinpath(dir,"coverage-S2.json");root="1980-01");@test !ok && occursin("list line",e)
    @test occursin("root\t1980-01\tstart\t2026-05",genS2("tsv";root="1980-01"))
    # best-effort months: listed separately, chain members, exact runs end before them
    ok,e=ctamper(replace(ctsv,"best_effort\t2037-02\t2037-02\t1\tbest_effort_unverified\twrong=7,7"=>"best_effort\t2037-02\t2037-02\t1\tbest_effort_unverified\twrong=1,1";count=1),cjson);@test !ok && occursin("same wrong cells",e)
    ok,e=ctamper(replace(ctsv,"run\t2026-03\t2037-01\t131"=>"run\t2026-03\t2037-02\t132";count=1),cjson);@test !ok
    ok,e=ctamper(replace(ctsv,"\texact_runs\t3\tbest_effort\t2"=>"\texact_runs\t3\tbest_effort\t1";count=1),cjson);@test !ok && occursin("counts mismatch",e)
    ok,e=ctamper(replace(ctsv,"best_effort_unverified\twrong=7,7 evidence=february-hall-S2.tsv"=>"best_effort_unverified\twrong=7,7 evidence=nope.tsv";count=1),cjson);@test !ok && occursin("Hall witness table exists",e)
    ok,e=ctamper(ctsv,replace(cjson,"\"status\": \"best_effort_unverified\""=>"\"status\": \"best_effort\"";count=1));@test !ok && occursin("json",e)
    # verified best-effort month: Julia and Flix chain receipts of the best-effort fixture (two-state chain 2026-05, 2026-06)
    l2=tempname();write(l2,"2026-05\n2026-06\n");p2=sha(l2);bl=tempname()
    write(bl,"month\tstatus\twrong_cells\tevidence\n2026-06\tbest_effort\t4,4\tfixture-best-effort-center-julia.tsv;fixture-best-effort-center-flix.tsv\n")
    t4=gen("tsv",l2,p2,joinpath(dir,"status-none.tsv"),"2026-06","2026-05","2026-05",bl);j4=gen("json",l2,p2,joinpath(dir,"status-none.tsv"),"2026-06","2026-05","2026-05",bl)
    @test occursin("headline\texact-gapless\t2026-05\t2026-05\t1\n",t4) && occursin("best_effort\t2026-06\t2026-06\t1\tbest_effort\twrong=4,4",t4)
    d4=mktempdir();write(joinpath(d4,"c.tsv"),t4);write(joinpath(d4,"c.json"),j4)
    @test verify(joinpath(d4,"c.tsv"),joinpath(d4,"c.json");l=l2,p=p2)[1]
    ok,e=verify(joinpath(d4,"c.tsv"),joinpath(d4,"c.json");l=l2,p=p2)  # unchanged: accepted
    for (what,bad) in (("wrong=4,4 evidence"=>"wrong=4,3 evidence"),)
        write(joinpath(d4,"c2.tsv"),replace(t4,what=>bad;count=1));ok,e=verify(joinpath(d4,"c2.tsv"),joinpath(d4,"c.json");l=l2,p=p2);@test !ok && occursin("best-effort edge line",e)
    end
end
println("mutations: not run (opt-in)")
