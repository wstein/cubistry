#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Print B = printing-S2 with the April tiles renamed APR -> AP and IL -> RIL (label only).
# Checks the print, the layout, the hash file and replays the Julia receipts; the Flix receipts
# must equal the Julia receipts byte for byte. Run from anywhere: julia test_print_b.jl
using Test, SHA
const B=@__DIR__
const EV=normpath(joinpath(B,".."))
const CAL=normpath(joinpath(EV,"..","..",))
const S2=joinpath(EV,"window-skip","printing-S2.tsv")
const ML=joinpath(EV,"month-list")
const LAYOUT_OLD=joinpath(CAL,"row1-revision","layout.tsv")
const CHECK_PRINT=joinpath(CAL,"row1-window-print","check.jl")
const CHECK_CORNER=joinpath(CAL,"row1-corner-coupling","check.jl")
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
hashes(p=joinpath(B,"sha256.txt"))=Dict(split(l,"  ")[2]=>split(l,"  ")[1] for l in split(chop(read(p,String);tail=1),'\n'))
# names of the four corner receipts, with the month list that each one reads
const CORNERS=["S2"=>"months-S2.tsv","S2-chain"=>"months-S2-chain.tsv",
               "2026-02"=>"months-corner-2026-02.tsv","2043-02"=>"months-corner-2043-02.tsv"]
function replay(script,args...;months,pin)
    env=copy(ENV);env["CAL7_WINDOW_MONTHS"]=months;env["CAL7_WINDOW_MONTHS_SHA256"]=pin;out=IOBuffer()
    p=run(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $script $args`,env));stdout=out,stderr=devnull))
    (String(take!(out)),p.exitcode)
end
@testset "print B files" begin
    @test isfile(joinpath(B,"printing.tsv")) && isfile(joinpath(B,"layout.tsv")) && isfile(joinpath(B,"sha256.txt"))
    pb=rows(joinpath(B,"printing.tsv"));ps=rows(S2)
    texts=[r[6] for r in pb[2:end]]
    @test count(==("AP"),texts)==1 && count(==("RIL"),texts)==1
    @test !("APR" in texts) && !("IL" in texts)
    @test count(==("APR"),[r[6] for r in ps[2:end]])==1 && count(==("IL"),[r[6] for r in ps[2:end]])==1
    # the print is the S2 print under the bijection APR -> AP, IL -> RIL, nothing else changes
    @test length(pb)==length(ps)
    map1(r)=(r=copy(r);r[6]==("APR")&&(r[6]="AP");r[6]==("IL")&&(r[6]="RIL");r)
    @test pb[1]==ps[1] && all(map1(ps[i])==pb[i] for i in 2:length(ps))
    lo=rows(LAYOUT_OLD);ln=rows(joinpath(B,"layout.tsv"))
    @test ln[5][1:3]==["4","AP","RIL"] && lo[5][1:3]==["4","APR","IL"]
    @test all(ln[i]==lo[i] for i in eachindex(lo) if i!=5) && length(ln)==length(lo)
end
@testset "hash file" begin
    h=hashes()
    for n in ("printing.tsv","layout.tsv","print-B-julia.tsv","print-B-flix.tsv",
              ["corner-$c-$t.tsv" for (c,_) in CORNERS for t in ("julia","flix")]...)
        @test haskey(h,n) && isfile(joinpath(B,n)) && h[n]==sha(joinpath(B,n))
    end
    @test h["printing.tsv"]!="5808fcac697ffc600d87b60f39f459de47d2aac05b4b2bd5be86bae9b0f6edd3"
    @test h["layout.tsv"]!="c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db"
end
@testset "receipts" begin
    h=hashes();pins=hashes(joinpath(ML,"sha256.txt"))
    lay=joinpath(B,"layout.tsv");pr=joinpath(B,"printing.tsv")
    out,rc=replay(CHECK_PRINT,lay,pr,joinpath(ML,"front-matches-S2.tsv");months=joinpath(ML,"months-S2.tsv"),pin=pins["months-S2.tsv"])
    @test rc==0 && out==read(joinpath(B,"print-B-julia.tsv"),String)
    @test read(joinpath(B,"print-B-julia.tsv"))==read(joinpath(B,"print-B-flix.tsv"))
    @test split(first(split(out,'\n')),'\t')[2:3]==[h["layout.tsv"],h["printing.tsv"]]
    @test endswith(strip(out),"SAT\tfixed-print-rigid-front-matching\t286\t14014\tlegal-states=UNKNOWN\tchain=NOT_RUN")
    # April targets carry new hashes (the hash covers the front text), other months keep theirs
    old=rows(joinpath(ML,"print-S2-julia.tsv"));new=rows(joinpath(B,"print-B-julia.tsv"))
    tg(r)=[x for x in r if x[1]=="target"]
    changed=[o[4] for (o,n) in zip(tg(old),tg(new)) if o[6]!=n[6]]
    @test !isempty(changed) && all(==("4"),changed)
    for (c,l) in CORNERS
        out,rc=replay(CHECK_CORNER,lay,"names-band","window";months=joinpath(ML,l),pin=pins[l])
        @test rc==0 && out==read(joinpath(B,"corner-$c-julia.tsv"),String)
        @test read(joinpath(B,"corner-$c-julia.tsv"))==read(joinpath(B,"corner-$c-flix.tsv"))
        @test split(first(split(out,'\n')),'\t')[2]==h["layout.tsv"]
    end
end
