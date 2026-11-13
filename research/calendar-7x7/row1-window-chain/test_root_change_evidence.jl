#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Consistency of the committed root-change evidence: evidence/print-d (print') and evidence/chain-1980-2036 (672 edges, root 1980-01).
# Checks hash files, print' against print C (same ids, pieces, homes, normals, same multiset of labels, January identity front), the chain (header, no start
# block, source digest = identity digest of print', continuity of the edge digests, months = the committed lists of the two stages, best-effort file,
# 666 + 6 edges), the receipts (Julia = Flix byte for byte, summary and independent verdict), the states manifest. The three chain checkers
# themselves are not run here (about 90 s with Flix): see VERIFIED.txt for the commands.
# Julia 1.11.5: julia --startup-file=no test_root_change_evidence.jl (about 5 s). CAL7_ROOTCHANGE_EVIDENCE replaces evidence/ (mutants).
using Test, SHA
const EV=get(ENV,"CAL7_ROOTCHANGE_EVIDENCE",joinpath(@__DIR__,"evidence"))
const PD=joinpath(EV,"print-d");const CD=joinpath(EV,"chain-1980-2036");const PC=joinpath(@__DIR__,"evidence","print-c");const ML=joinpath(@__DIR__,"evidence","month-list")
sha(p)=bytes2hex(sha256(read(p)))
lines(p)=split(chop(read(p,String);tail=1),'\n')
rows(p)=[split(l,'\t') for l in lines(p)]
kv(p)=Dict(split(l,'=';limit=2)[1]=>split(l,'=';limit=2)[2] for l in lines(p))
V=kv(joinpath(CD,"VERIFIED.txt"))
@testset "print D" begin
    for l in lines(joinpath(PD,"sha256.txt"));h,f=split(l,"  ");@test sha(joinpath(PD,f))==h;end
    @test sha(joinpath(PD,"layout.tsv"))==sha(joinpath(PC,"layout.tsv"))
    a=rows(joinpath(PC,"printing.tsv"));b=rows(joinpath(PD,"printing.tsv"))
    @test b[1]==a[1] && length(a)==length(b)==295
    @test all(i->b[i][1:3]==a[i][1:3] && b[i][4]==a[i][4],2:295)                 # id, piece, home, normal
    @test count(i->b[i][5]!=a[i][5],2:295)>20 && count(i->b[i][6:7]!=a[i][6:7],2:295)>100
    @test sort([r[6:7] for r in a[2:end]])==sort([r[6:7] for r in b[2:end]])
    front(t)=sort([r[[3,5,6,7]] for r in t[2:end] if r[4]=="0,0,1"])
    @test [r[6:7] for r in b[2:end] if r[4]=="0,0,1"]==[r[6:7] for r in a[2:end] if r[4]=="0,0,1"]       # identity front of print' = identity front of print C (January)
    @test V["print_d_sha256"]==sha(joinpath(PD,"printing.tsv"))
end
@testset "chain" begin
    L=lines(joinpath(CD,"chain.moves.tsv"))
    @test L[1]=="cubistry.calendar7.chain.v2" && !any(startswith("start"),L) && L[end]=="finish"
    f=split(L[2],'\t');@test f[1:4]==["source","1","1980","1"] && f[5]==V["identity_digest_print_d"]
    E=[split(l,'\t') for l in L if startswith(l,"edge\t")]
    @test length(E)==672 && E[1][8]==f[5] && all(k->E[k][9]==E[k+1][8],1:671) && length(unique(e[9] for e in E))==672
    @test V["chain_sha256"]==sha(joinpath(CD,"chain.moves.tsv")) && V["months_sha256"]==sha(joinpath(CD,"months.tsv"))
    ms=lines(joinpath(CD,"months.tsv"))
    @test ms==vcat(lines(joinpath(ML,"months-back-1980-01-2019-01.tsv")),lines(joinpath(ML,"months-chain-2019-01-2036-01.tsv"))[2:end]) && length(ms)==673
    @test [string(e[2],'-',lpad(e[3],2,'0')) for e in E]==ms[2:end]
    @test count(startswith("wrong\t"),L)==6 && count(startswith("hall\t"),L)==6
    be=rows(joinpath(CD,"best-effort.tsv"));@test [r[1] for r in be[2:end]]==["1981-02","1987-02","1998-02","2009-02","2015-02","2026-02"] && all(r->r[3]=="7,1",be[2:end])
end
@testset "receipts" begin
    j=read(joinpath(CD,"julia.tsv"),String);@test j==read(joinpath(CD,"flix.tsv"),String)
    jl=lines(joinpath(CD,"julia.tsv"));@test jl[end-1]=="summary\t673\t672\t76262\t90379\t1018\t1320\tlist:2036-01\tINVERSE_PASS"
    @test count(l->startswith(l,"edge\t") && split(l,'\t')[11]=="PASS",jl)==672 && count(l->startswith(l,"edge\t") && occursin("\tBEST_EFFORT\t",l),jl)==6
    il=lines(joinpath(CD,"independent.tsv"));@test il[end]=="independent-verdict\tACCEPT_BEST_EFFORT_CHAIN\t673\t672\t76262\tINVERSE_PASS"
    @test any(==("independent-status\texact\t666\tbest_effort\t6"),il)
    @test occursin(sha(joinpath(PD,"printing.tsv")),jl[2])
end
@testset "manifest" begin
    m=lines(joinpath(CD,"states.sha256"));@test length(m)==673 && length(unique(split(l,"  ")[1] for l in m))==673
    @test all(k->endswith(m[k],"states/state-"*lpad(k,2,'0')*".tsv"),1:673)
    pr=rows(joinpath(CD,"provenance.tsv"))
    @test any(r->r[1]=="output" && r[3]=="chain.moves.tsv" && r[2]==V["chain_sha256"],pr) && any(r->r[1]=="print-c" && r[2]==sha(joinpath(PC,"printing.tsv")),pr)
    @test any(r->r[1]=="input" && r[2]==V["source_backward"][end-63:end],pr) && any(r->r[1]=="input" && r[2]==V["source_forward"][end-63:end],pr)
end
