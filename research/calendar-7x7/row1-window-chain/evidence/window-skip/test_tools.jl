#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests scan_fixed.jl, drop_one.jl and compat.jl against the committed tables.
using Test
include(joinpath(@__DIR__,"months.jl"))
const CAL=normpath(joinpath(@__DIR__,"..","..",".."));const LAYOUT=joinpath(CAL,"row1-revision","layout.tsv")
const E37=joinpath(CAL,"row1-window-chain","evidence","window-2037-01")
f(n)=joinpath(@__DIR__,n)
mlist(a,b)=join([string(2026+(i-1)÷12,'-',lpad((i-1)%12+1,2,'0')) for i in a:b],',')
runj(script,args...;env=Dict())=read(setenv(`$(Base.julia_cmd()) --startup-file=no $(f(script)) $args`,merge(Dict(string(k)=>string(v) for (k,v) in ENV),env)),String)
@testset "scan_fixed.jl" begin
    out=runj("scan_fixed.jl",LAYOUT,joinpath(E37,"printing.tsv"),"2037-02","2037-04";env=Dict("BASE_MONTHS"=>mlist(5,133)))
    @test out=="month\tbase_n\tdemand\tblank_peak\tlemma\tfront_match\n2037-02\t129\t24\t2\tUNSAT\tNOMATCH\n2037-03\t129\t23\t1\tUNKNOWN\tMATCH\n2037-04\t129\t23\t1\tUNKNOWN\tNOMATCH\n"
    P1=Dict(split(l,'\t')[1]=>l for l in readlines(f("scan-fixed-P1.tsv"))[2:end])
    out=runj("scan_fixed.jl",LAYOUT,joinpath(E37,"printing.tsv"),"2026-01","2026-04";env=Dict("BASE_MONTHS"=>mlist(5,133)))
    @test all(l->P1[split(l,'\t')[1]]==l,split(chomp(out),'\n')[2:end])
end
@testset "drop_one.jl" begin
    out=runj("drop_one.jl",LAYOUT,"2026-02,2026-04,2037-02,2037-04,2043-02,2043-04,2048-04")
    ls=split(out,'\n')
    feb=[l[1:min(end,200)] for l in ls if startswith(l,"S_valid") || occursin(r"^gap\t\(20(26|37|43), 2\)",l)]
    @test join(feb,'\n')*"\n"==read(f("drop-one-februaries.tsv"),String)
    apr=only(filter(l->startswith(l,"gap\t(2026, 4)\tsingle_drops"),ls))
    @test startswith(apr,"gap\t(2026, 4)\tsingle_drops_with_demand<=23\t282\t")
end
@testset "compat.jl" begin
    out=runj("compat.jl",LAYOUT,joinpath(E37,"printing.tsv"),joinpath(E37,"front-matches.tsv"),f("printing-S2.tsv");env=Dict("WINDOW_MONTHS"=>mlist(5,133)))
    @test out==read(f("compat-S2.txt"),String)
    out=runj("compat.jl",LAYOUT,joinpath(E37,"printing.tsv"),joinpath(E37,"front-matches.tsv"),joinpath(E37,"printing.tsv");env=Dict("WINDOW_MONTHS"=>mlist(5,133)))
    @test out=="changed_surface_classes\t0\tsticker_rows_changed\t0\tchanged_surfaces_visible_in_old_matches\t0\nmonths_with_old_match_broken\t0\tof\t129\n"
end
