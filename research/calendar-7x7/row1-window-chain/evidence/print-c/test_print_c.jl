#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Print C (long chain) = printing-C1980 with the April tiles renamed APR -> AP and IL -> RIL (label only).
# Checks the print, the layout pin, the hash file, the identity front (January/Tuesday/31) and replays the Julia
# receipt of the 90 front-matchable configurations. Run from anywhere: julia test_print_c.jl
# months.jl accepts months from 2026-01 only; the identity board is built with 2030-01 (same configuration as 2019-01
# and 1980-01) and the weekday/length facts of 2019-01 and 1980-01 are checked with Dates. No run with root 2019-01.
using Test, SHA, Dates
const PC=@__DIR__
const EV=normpath(joinpath(PC,".."))
const CAL=normpath(joinpath(EV,"..","..",))
const CC=joinpath(EV,"config-coverage")
const SKIP=joinpath(EV,"window-skip")
include(joinpath(SKIP,"months.jl"))
sha(p)=bytes2hex(sha256(read(p)))
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
hashes(p=joinpath(PC,"sha256.txt"))=Dict(split(l,"  ")[2]=>split(l,"  ")[1] for l in split(chop(read(p,String);tail=1),'\n'))
const OLD=joinpath(CC,"printing-C1980.tsv")
const MATCHES=joinpath(CC,"front-matches-config-C1980.tsv")
const LAYOUT_B=joinpath(EV,"print-b","layout.tsv")
const LAYOUT_PIN="e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a"
@testset "print C" begin
@testset "print C files" begin
    @test isfile(joinpath(PC,"printing.tsv")) && isfile(joinpath(PC,"layout.tsv")) && isfile(joinpath(PC,"sha256.txt"))
    pn=rows(joinpath(PC,"printing.tsv"));po=rows(OLD)
    @test length(pn)==295 && length(po)==295 && pn[1]==po[1]
    tn=[r[6] for r in pn[2:end]];to=[r[6] for r in po[2:end]]
    @test count(==("AP"),tn)==1 && count(==("RIL"),tn)==1 && !("APR" in tn) && !("IL" in tn)
    @test count(==("APR"),to)==1 && count(==("IL"),to)==1
    # exactly two rows differ: sticker 63 APR -> AP and sticker 235 IL -> RIL; every other field is unchanged
    diff=[i for i in 2:295 if pn[i]!=po[i]]
    @test [pn[i][1] for i in diff]==["63","235"]
    @test [(po[i][6],pn[i][6]) for i in diff]==[("APR","AP"),("IL","RIL")]
    @test all(pn[i][[1:5;7]]==po[i][[1:5;7]] for i in diff)
    @test all(pn[i]==po[i] for i in 2:295 if !(i in diff))
    # the layout is the Print B layout (April = AP, RIL), pinned by hash
    @test sha(joinpath(PC,"layout.tsv"))==LAYOUT_PIN && read(joinpath(PC,"layout.tsv"))==read(LAYOUT_B)
    @test !occursin('\r',read(joinpath(PC,"printing.tsv"),String)) && endswith(read(joinpath(PC,"printing.tsv"),String),"\n")
end
@testset "hash file" begin
    h=hashes()
    for n in ("printing.tsv","layout.tsv","print-config-C-julia.tsv")
        @test haskey(h,n) && isfile(joinpath(PC,n)) && h[n]==sha(joinpath(PC,n))
    end
    @test h["layout.tsv"]==LAYOUT_PIN
    @test h["printing.tsv"]!="e3c7e3eeaa012a62cc372642e796a8640c95bd5da569d2c3352bee9ecc24c3be"   # printing-C1980 (APR, IL)
    @test sha(OLD)=="e3c7e3eeaa012a62cc372642e796a8640c95bd5da569d2c3352bee9ecc24c3be"            # old evidence is untouched
end
@testset "identity front is the January/Tuesday/31 board" begin
    @test Dates.dayofweek(Date(2019,1,1))==2 && Dates.daysinmonth(Date(2019,1,1))==31
    @test Dates.dayofweek(Date(1980,1,1))==2 && Dates.daysinmonth(Date(1980,1,1))==31
    @test Dates.dayofweek(Date(2030,1,1))==2 && Dates.daysinmonth(Date(2030,1,1))==31   # placeholder of the same configuration
    labels=coupled_labels(read(joinpath(PC,"layout.tsv"),String))
    board=stacked_board(2030,1,PURE_VARIANT)
    for c in 1:7;t=labels[1][c];board[1,c]=(t,isempty(t) ? "band" : "month");end
    src=window_read_print(joinpath(PC,"printing.tsv"))
    front=[(s=only(filter(s->s.home==(c-4,4-r,3) && s.normal==FRONT_NORMAL,src));(s.text,s.ink)) for r in 1:7,c in 1:7]
    @test front==board
    may=stacked_board(2026,5,PURE_VARIANT);@test front!=may   # not the May 2026 board of print B
end
@testset "front matching of the 90 configurations" begin
    m=rows(MATCHES)[2:end]
    ts=unique((r[2],r[3]) for r in m)
    @test length(ts)==90 && length(m)==90*49
    @test !any(t->(Dates.month(Date(parse(Int,t[1]),parse(Int,t[2]),1))==2 && Dates.dayofweek(Date(parse(Int,t[1]),parse(Int,t[2]),1))==7 && Dates.daysinmonth(Date(parse(Int,t[1]),parse(Int,t[2]),1))==28),ts)   # February/Sunday/28 stays NOMATCH
    months=join((string(t[1],"-",lpad(t[2],2,"0")) for t in ts),",")
    env=copy(ENV);env["WINDOW_MONTHS"]=months;out=IOBuffer()
    p=run(pipeline(ignorestatus(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(SKIP,"skip_check.jl")) print $(joinpath(PC,"layout.tsv")) $(joinpath(PC,"printing.tsv")) $MATCHES`,env));stdout=out,stderr=devnull))
    o=String(take!(out))
    @test p.exitcode==0 && o==read(joinpath(PC,"print-config-C-julia.tsv"),String)
    h=hashes();@test split(first(split(o,'\n')),'\t')[2:3]==[h["layout.tsv"],h["printing.tsv"]]
    @test endswith(strip(o),"SAT\tfixed-print-rigid-front-matching\t90\t4410\tlegal-states=UNKNOWN\tchain=NOT_RUN")
end
end
