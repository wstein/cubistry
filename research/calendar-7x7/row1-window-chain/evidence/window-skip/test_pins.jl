#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Pins the S2 print, the S1/S2 receipts and the month lists by SHA-256 and replays the receipts.
using Test
include(joinpath(@__DIR__,"months.jl"))
const CAL=normpath(joinpath(@__DIR__,"..","..",".."));const LAYOUT=joinpath(CAL,"row1-revision","layout.tsv")
const PINS=Dict(
 "printing-S2.tsv"=>"5808fcac697ffc600d87b60f39f459de47d2aac05b4b2bd5be86bae9b0f6edd3",
 "front-matches-S2.tsv"=>"08fa990d2c1929500f47fc7170f8d0599a5b148332c7e8c6dd412e4e6247b7b4",
 "print-S2-julia.tsv"=>"7302c1bb579669ca401516bd8a3cfadf56e5852970dcffc252a2943ed2f8292b",
 "corner-S2-julia.tsv"=>"816249b7f1aaa20dda28cf811d8f26159017c60babd5a4ba94c158c7cf9eeafb",
 "corner-S1-julia.tsv"=>"2093842082386647f5b90710dbe9b302c1f35ff8b9f65c2b980ae8cdd96945cd",
 "corner-2026-02-julia.tsv"=>"5a9d9e4ad7cc4299e596a8b8a1fe0c6bbd8df4ce9f0b014cb43a50896618e4c0",
 "corner-2043-02-julia.tsv"=>"31e7c749b7931fd13cc24c660bde4c4a010b5bb5197903c65297ca0aff567809",
 "months-S2.txt"=>"6298b2ecc1be140a2c0a791a2493500e01038d743d1c0aff13f25c39df21332e",
 "months-S1.txt"=>"8d36b1069b8a72606e8271d14074c4cbfe6d2781512f4d0a178c2988f574817b")
f(n)=joinpath(@__DIR__,n)
function sub(args...;months)
    env=copy(ENV);env["WINDOW_MONTHS"]=months;out=IOBuffer()
    p=run(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $(f("skip_check.jl")) $args`,env));stdout=out,stderr=devnull))
    (String(take!(out)),p.exitcode)
end
lst(n)=join(split(strip(read(f(n),String)),'\n'),',')
@testset "pinned files" begin
    for (n,h) in PINS;@test bytes2hex(sha256(read(f(n))))==h;end
end
@testset "receipt replay" begin
    s2=lst("months-S2.txt");s1=lst("months-S1.txt")
    out,rc=sub("print",LAYOUT,f("printing-S2.tsv"),f("front-matches-S2.tsv");months=s2);@test rc==0 && out==read(f("print-S2-julia.tsv"),String)
    @test endswith(strip(out),"SAT\tfixed-print-rigid-front-matching\t286\t14014\tlegal-states=UNKNOWN\tchain=NOT_RUN")
    out,rc=sub("lemma",LAYOUT;months=s2);@test rc==0 && out==read(f("corner-S2-julia.tsv"),String)
    out,rc=sub("lemma",LAYOUT;months=s1);@test rc==0 && out==read(f("corner-S1-julia.tsv"),String)
    # the February receipts list the February first (a set, not the root-first order of the print files)
    base=lst("months-S2.txt")|>x->join([m for m in split(x,',') if "2026-05"<=m<="2037-01"],',')
    for m in ("2026-02","2043-02")
        out,rc=sub("lemma",LAYOUT;months=m*","*base);@test rc==0 && out==read(f("corner-$m-julia.tsv"),String)
        @test endswith(strip(out),"UNSAT\tfixed-print-corner-body-matching\tunique-always-visible-face")
    end
end
