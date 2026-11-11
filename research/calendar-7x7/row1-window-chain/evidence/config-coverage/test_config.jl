#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run from research/calendar-7x7: julia --startup-file=no row1-window-chain/evidence/config-coverage/test_config.jl
# Recomputes every committed table of this directory from the repository code and compares it with the file.
using Test
include(joinpath(@__DIR__,"config_table.jl"))
const D=@__DIR__;const SKIP=joinpath(D,"..","window-skip")
f(n)=joinpath(D,n);slurp(p)=read(p,String)
const T=ConfigTable.build(LAYOUT,PRINT_B,PRINT_OLD,PRINT_C,PRINT_D,LAYOUT_OLD)
@testset "config coverage" begin
@testset "configuration set" begin
    cs=T.configs
    @test length(cs)==91
    @test count(c->c.month==2,cs)==14 && count(c->c.month!=2 && c.length in(30,31),cs)==77
    @test all(c->c.month==2 ? c.length in (28,29) : c.length==Dates.daysinmonth(Date(2001,c.month,1)),cs)
    @test length(unique(join(string.(c.board),"|") for c in cs))==91     # distinct boards
    @test sort(unique(c.weekday for c in cs))==collect(1:7)
    apr=T.config_of(T.configs,2026,4)                                     # the 2037-01 print is evaluated with its own layout (AP+RIL), the others with the shared one (APR+IL)
    @test apr.board[1,1][1]=="APR" && apr.board_old[1,1][1]=="AP" && apr.board_old[1,2][1]=="RIL"
    @test all(c->c.board_old==c.board,[c for c in cs if c.month!=4])
end
@testset "calendar facts and Gregorian cycle" begin
    @test T.cycle.months==4800 && T.cycle.configs==91 && T.cycle.board_mismatch==0
    @test T.cycle.shift_mismatch==0                                      # config(y,m)==config(y+400,m) for 1900..2200
    @test T.cycle.first_missing_2026_2099==0
    feb28sun=[y for y in 2026:2100 if Dates.daysinmonth(Date(y,2,1))==28 && Dates.dayofweek(Date(y,2,1))==7]
    @test feb28sun==[2026,2037,2043,2054,2065,2071,2082,2093,2099]
    @test T.years(T.byid(T.configs,2,7,28),2026,2100)==feb28sun
end
@testset "committed tables equal recomputed tables" begin
    @test slurp(f("config-table.tsv"))==T.table_tsv
    @test slurp(f("failing-dates.tsv"))==T.failing_tsv
    @test slurp(f("front-matches-config-B.tsv"))==T.matches_B
    @test slurp(f("front-matches-config-old.tsv"))==T.matches_old
    @test slurp(f("front-matches-config-C.tsv"))==T.matches_C
    @test slurp(f("front-matches-config-C1980.tsv"))==T.matches_D
    @test slurp(f("best-effort-feb-sunday-28.tsv"))==T.best_effort_tsv
    @test slurp(f("lemma-config.tsv"))==T.lemma_tsv
    @test slurp(f("gregorian-400.txt"))==T.cycle_txt
    @test slurp(f("chain-size.tsv"))==T.chain_tsv
end
@testset "match verdict agrees with the repository matcher" begin
    for (nm,pr) in (("B",T.srcB),("old",T.srcOld),("C",T.srcC),("D",T.srcD)),c in T.configs
        ok=try;window_match(pr,nm=="old" ? c.board_old : c.board);true;catch e;e isa AssertionError ? false : rethrow();end
        r=T.result(nm,c);@test (r.status=="SAT")==ok
        ok || @test !isempty(r.unmatched) && r.hall_cells>r.hall_bodies
    end
end
@testset "matchings replay in the repository print checker" begin
    for (nm,pr,mf,rf) in (("B",PRINT_B,"front-matches-config-B.tsv","print-config-B-julia.tsv"),("old",PRINT_OLD,"front-matches-config-old.tsv","print-config-old-julia.tsv"),("C",PRINT_C,"front-matches-config-C.tsv","print-config-C-julia.tsv"),("D",PRINT_D,"front-matches-config-C1980.tsv","print-config-C1980-julia.tsv"))
        months=join([string(c.rep[1],'-',lpad(c.rep[2],2,'0')) for c in T.configs if T.result(nm,c).status=="SAT"],',')
        env=copy(ENV);env["WINDOW_MONTHS"]=months;out=IOBuffer()
        run(pipeline(setenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(SKIP,"skip_check.jl")) print $(nm=="old" ? LAYOUT_OLD : LAYOUT) $pr $(f(mf))`,env);stdout=out))
        @test String(take!(out))==slurp(f(rf))
    end
end
@testset "cross-check against the 289-month scan of PR 413" begin
    allm=[(2026+(i-1)÷12,(i-1)%12+1) for i in 1:289]
    for (nm,mf) in (("B","months-S2.txt"),("old","months-S1.txt"))
        valid=Set(parse_months(join(split(strip(slurp(joinpath(SKIP,mf)))),",")))
        for (y,m) in allm;@test ((y,m) in valid)==(T.result(nm,T.config_of(T.configs,y,m)).status=="SAT");end
    end
end
@testset "corner lemma per configuration" begin
    L=T.lemma
    @test L.B_set.demand==23 && !L.B_set.lemma           # all matchable configurations of print B
    @test L.all91.demand==24 && L.all91.lemma                    # adding February/Sunday/28 to the 90 raises the demand to 24: lemma UNSAT
    r20=only(r for r in L.rows if r.id==20);@test (r20.B_demand,r20.B_lemma,r20.old_demand,r20.old_lemma)==(24,true,24,true)
    r31=only(r for r in L.rows if r.id==31);@test (r31.old_status,r31.old_demand,r31.old_lemma)==("NOMATCH",23,false)   # April/Wednesday/30 is not a corner problem
    for r in L.rows;(r.B_status=="SAT") && @test r.B_demand==L.B_set.demand;end
end
@testset "identity pose and print C month list" begin
    using SHA
    front(src)=[(s=only(filter(s->s.home==(c-4,4-r,3) && s.normal==FRONT_NORMAL,src));(s.text,s.ink)) for r in 1:7,c in 1:7]
    may=T.config_of(T.configs,2026,5).board;jan=T.config_of(T.configs,2026,1).board
    @test front(T.srcB)==may && front(T.srcOld)==may && front(T.srcC)==jan   # the root month is what the solved cube shows
    @test front(T.srcC)!=may
    @test bytes2hex(sha256(read(f("printing-C.tsv"))))=="009983500ad7f4db37a8a5619a1fa4fddcc9524e014d0372fea79efffb6f9ff6"
    ms=parse_months(join(split(strip(slurp(f("months-C.txt")))),","))
    want=[(y,m) for y in 2026:2050 for m in 1:12 if (y,m)<=(2050,1) && T.result("B",T.config_of(T.configs,y,m)).status=="SAT"]
    @test ms==want && ms[1]==(2026,1) && length(ms)==286
    @test all(ym->T.result("C",T.config_of(T.configs,ym...)).status=="SAT",ms)
end
@testset "best effort for February/Sunday/28" begin
    # every listed matching: 48 cells, distinct bodies, rigid rotation reaches the cell, upright art equals the board cell
    rows=[split(l,'\t') for l in split(strip(slurp(f("best-effort-feb-sunday-28.tsv"))),'\n')[2:end]]
    feb=T.byid(T.configs,2,7,28);homes=all_homes();wrongs=Set()
    for nm in ("B","C","D")
        src=Dict("B"=>T.srcB,"C"=>T.srcC,"D"=>T.srcD)[nm];byhome=Dict(h=>filter(s->s.home==h,src) for h in homes)
        rs=[r for r in rows if r[1]==nm];@test !isempty(rs)
        for w in unique((r[5],r[6]) for r in rs)
            push!(wrongs,w);mine=[r for r in rs if (r[5],r[6])==w];@test length(mine)==48
            @test length(unique(r[9] for r in mine))==48 && !any(r->(r[7],r[8])==w,mine)
            for r in mine
                rr,cc,pid=parse.(Int,r[7:9]);basis=tuple((tuple(parse.(Int,split(x,','))...) for x in r[10:12])...)
                rot=only(q for q in ROTATIONS if (rotate((1,0,0),q),rotate((0,1,0),q),rotate((0,0,1),q))==basis)
                @test rotate(homes[pid],rot)==(cc-4,4-rr,3)
                fr=only(filter(s->rotate(s.normal,rot)==FRONT_NORMAL,byhome[homes[pid]]))
                a=only(findall(==(rotate(fr.up,rot)),IMAGE_UPS))-1
                @test coupled_optic(fr.text,a,fr.ink)==coupled_optic(feb.board[rr,cc][1],0,feb.board[rr,cc][2])
            end
        end
    end
    @test wrongs==Set([("7","1"),("7","7")])        # the two blank bottom corners; the wrong cell is a free choice between them
    # no other single wrong cell works: for any other cell x the other 48 cells do not all match
    @test all(x->!isempty(ConfigTable.match_config(T.srcB,feb.board;skip=x).unmatched),[(r,k) for r in 1:7 for k in 1:7 if (r,k) ∉ ((7,1),(7,7))])
end
@testset "print C1980: root January 1980" begin
    front(src)=[(s=only(filter(s->s.home==(c-4,4-r,3) && s.normal==FRONT_NORMAL,src));(s.text,s.ink)) for r in 1:7,c in 1:7]
    j80=T.byid(T.configs,1,2,31)
    @test Dates.dayofweek(Date(1980,1,1))==2 && Dates.daysinmonth(Date(1980,1,1))==31      # January 1980 started on a Tuesday
    @test front(T.srcD)==j80.board && front(T.srcD)!=front(T.srcB) && front(T.srcD)!=front(T.srcC)
    @test bytes2hex(sha256(read(f("printing-C1980.tsv"))))=="e3c7e3eeaa012a62cc372642e796a8640c95bd5da569d2c3352bee9ecc24c3be"
    ms=parse_months(join(split(strip(slurp(f("months-C1980.txt")))),","))
    @test ms[1]==(2030,1) && T.config_of(T.configs,ms[1]...).board==j80.board && length(ms)==286 && length(unique(ms))==286
    chain=[(y,m) for y in 2026:2050 for m in 1:12 if (2026,3)<=(y,m)<=(2050,1) && T.result("B",T.config_of(T.configs,y,m)).status=="SAT"]
    @test Set(ms)==Set(vcat(chain,[(2052,2)])) && length(chain)==285
    @test count(c->T.result("D",c).status=="SAT",T.configs)==90 && T.result("D",T.byid(T.configs,2,7,28)).status=="NOMATCH"
end
end
