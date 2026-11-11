#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unit tests of the explicit month list S (CAL7_WINDOW_MONTHS, CAL7_WINDOW_MONTHS_SHA256) for the Julia checkers.
using Test
include(joinpath(@__DIR__,"..","row1-window-print/common.jl"))
labels=coupled_labels(read(joinpath(@__DIR__,"..","row1-revision/layout.tsv"),String))
ym(goals)=[(g.year,g.month) for g in goals]
sha(s)=bytes2hex(sha256(codeunits(s)))
function listfile(text)
    p=tempname();write(p,text);p
end
@testset "month list reader" begin
    t="2026-05\n2026-06\n2026-08\n"
    p=listfile(t)
    @test read_month_list(p,sha(t))==[(2026,5),(2026,6),(2026,8)]
    @test_throws AssertionError read_month_list(p,repeat("0",64))                       # wrong list hash
    @test_throws AssertionError read_month_list(p,uppercase(sha(t)))                     # hash must be lowercase hex
    for bad in ("2026-06\n2026-05\n","2026-05\n2026-05\n","2026-05\r\n2026-06\r\n","2026-05\n2026-06","2026-05\n\n2026-06\n",
                "1899-12\n1900-01\n","2026-13\n","2026-5\n","","2100-01\n2100-02\n","2026-05 \n"," 2026-05\n","2026-05\n2026-06\n\n")
        q=listfile(bad);@test_throws AssertionError read_month_list(q,sha(bad))
    end
    @test read_month_list(listfile("2026-01\n2100-01\n"),sha("2026-01\n2100-01\n"))==[(2026,1),(2100,1)]
    @test read_month_list(listfile("1900-01\n1980-01\n2026-01\n"),sha("1900-01\n1980-01\n2026-01\n"))==[(1900,1),(1980,1),(2026,1)]    # backward stages reach 1900
end
@testset "window month list in coupled_goals" begin
    t="2026-05\n2026-06\n2026-08\n2027-01\n";p=listfile(t)
    ref=coupled_goals(labels,"names-band","window";window_end="2026-08")
    withenv("CAL7_WINDOW_MONTHS"=>p,"CAL7_WINDOW_MONTHS_SHA256"=>sha(t)) do
        g=coupled_goals(labels,"names-band","window")
        @test ym(g)==[(2026,5),(2026,6),(2026,8),(2027,1)]
        @test g[3].board==ref[4].board   # same board as the contiguous month
    end
    withenv("CAL7_WINDOW_MONTHS"=>p) do                                                  # no hash: refuse
        @test_throws AssertionError coupled_goals(labels,"names-band","window")
    end
    withenv("CAL7_WINDOW_MONTHS"=>p,"CAL7_WINDOW_MONTHS_SHA256"=>repeat("a",64)) do
        @test_throws AssertionError coupled_goals(labels,"names-band","window")
    end
    withenv("CAL7_WINDOW_MONTHS"=>p,"CAL7_WINDOW_MONTHS_SHA256"=>sha(t),"WINDOW_END"=>"2028-01") do   # list and WINDOW_END are exclusive
        @test_throws AssertionError coupled_goals(labels,"names-band","window")
    end
    withenv("CAL7_WINDOW_MONTHS"=>nothing,"WINDOW_END"=>nothing) do                      # default stays May 2026 .. 2028-01
        @test ym(coupled_goals(labels,"names-band","window"))==ym(coupled_goals(labels,"names-band","window";window_end="2028-01"))
    end
    # a contiguous list gives the same goals as WINDOW_END
    cont=join([string(y,'-',lpad(m,2,'0'),'\n') for (y,m) in ym(coupled_goals(labels,"names-band","window";window_end="2029-12"))])
    withenv("CAL7_WINDOW_MONTHS"=>listfile(cont),"CAL7_WINDOW_MONTHS_SHA256"=>sha(cont)) do
        @test coupled_goals(labels,"names-band","window")==coupled_goals(labels,"names-band","window";window_end="2029-12")
    end
end
@testset "month list structure" begin
    @test month_list_bridges([(2026,5),(2026,6),(2026,8),(2027,1)])==[false,true,true]
    @test month_list_bridges([(2026,5)])==Bool[]
    @test month_list_bridges([(2026,12),(2027,1)])==[false]
end
println("mutations: not run (opt-in)")
