#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Consistency of the committed backward chain 2019-01 .. 1900-01 (print C, root 2019-01, window-chain.yml run 43542652089, 1428 edges):
# evidence/chain-back-1900-2019/. Checks the pins (print C, layout, month list, best-effort list, chain, receipts), the chain file (v3, free start,
# 1428 edges, digest continuity, month of edge i = member i+1 of the list), the months table (contiguous 1900-01 .. 2019-01), the 23 stage segments
# (width 40, lambda 3 on every one, edge ranges contiguous 0 .. 1428, one print, one layout), the receipts (Julia = Flix byte for byte, summary, 1415 exact and
# 13 best-effort edges, greedy 0, independent root and every independent edge ACCEPT) and the states manifest. The three chain checkers
# themselves are not run here: see README.md of the directory for the commands.
# Julia 1.11.5: julia --startup-file=no test_chain_back_1900_evidence.jl (about 5 s). CAL7_CHAINBACK_EVIDENCE replaces evidence/ (mutants).
using Test, SHA
const EV=get(ENV,"CAL7_CHAINBACK_EVIDENCE",joinpath(@__DIR__,"evidence"))
const CD=joinpath(EV,"chain-back-1900-2019");const PC=joinpath(@__DIR__,"evidence","print-c");const ML=joinpath(@__DIR__,"evidence","month-list")
sha(p)=bytes2hex(sha256(read(p)))
lines(p)=split(chop(read(p,String);tail=1),'\n')
rows(p)=[split(l,'\t') for l in lines(p)]
kv(p)=Dict(split(l,'=';limit=2)[1]=>split(l,'=';limit=2)[2] for l in lines(p))
const LIST="months-back-1900-01-2019-01.tsv";const BEST="best-effort-back-1900-01-2019-01.tsv"
V=kv(joinpath(CD,"VERIFIED.txt"));P=kv(joinpath(CD,"PROGRESS.txt"))     # VERIFIED.txt: pins of the final run; PROGRESS.txt: its stop state
@testset "pins" begin
    @test V["print_sha256"]==sha(joinpath(PC,"printing.tsv")) && V["layout_sha256"]==sha(joinpath(PC,"layout.tsv")) && P["layout_sha256"]==V["layout_sha256"]
    @test V["months_sha256"]==sha(joinpath(ML,LIST)) && V["best_effort_sha256"]==sha(joinpath(ML,BEST))
    @test V["direction"]=="backward" && V["chain_end"]=="2019-01" && V["join_end"]=="identity" && V["complete"]=="true" && P["complete"]=="true" && P["stop_reason"]=="-" && P["chain_start"]=="1900-01" && P["plan_end"]=="1900-01" && P["root_month"]=="2019-01"
    @test V["edges_total"]=="1428" && P["edges_total"]=="1428" && P["greedy_edges"]=="0" && P["best_effort_edges"]=="13" && P["rooted"]=="false" && P["bridge_edges"]=="0"
    @test V["run_id"]=="43542652089" && length(V["research_ref_sha"])==40
    pr=rows(joinpath(CD,"provenance.tsv"))
    @test pr[1]==["file","sha256","note"]
    out(f)=[r[2] for r in pr if r[1]=="output" && r[3]==f]
    for f in ["chain.moves.tsv","months.tsv","segments.tsv","edges.tsv","julia.tsv","flix.tsv","independent.tsv","VERIFIED.txt","PROGRESS.txt","flix-jar.sha256"]
        @test out(f)==[sha(joinpath(CD,f))]
    end
    @test any(r->r[1]=="print-c" && r[2]==V["print_sha256"],pr) && any(r->r[1]=="months" && r[2]==V["months_sha256"],pr) && any(r->r[1]=="best-effort" && r[2]==V["best_effort_sha256"],pr)
    @test length([r for r in pr if r[1]=="run"])==23 && any(r->r[1]=="run" && r[2]=="43542652089",pr)
end
@testset "chain" begin
    L=lines(joinpath(CD,"chain.moves.tsv"))
    @test L[1]=="cubistry.calendar7.chain.v3" && L[end]=="finish" && startswith(L[3],"start\t")
    f=split(L[2],'\t');@test f[1:4]==["source","1","1900","1"]
    E=[split(l,'\t') for l in L if startswith(l,"edge\t")]
    @test length(E)==1428 && E[1][8]==f[5] && all(k->E[k][9]==E[k+1][8],1:1427) && length(unique(e[9] for e in E))==1428 && !(f[5] in (e[9] for e in E))
    ms=lines(joinpath(ML,LIST));@test length(ms)==1429 && ms[1]=="1900-01" && ms[end]=="2019-01"
    @test [string(e[2],'-',lpad(e[3],2,'0')) for e in E]==ms[2:end]
    @test count(startswith("wrong\t"),L)==13 && count(startswith("hall\t"),L)==13
    mt=rows(joinpath(CD,"months.tsv"));@test mt[1][1]=="month" && length(mt)==1430
    @test [r[1] for r in mt[2:end]]==ms
    cal(s)=parse(Int,s[1:4])*12+parse(Int,s[6:7])
    @test all(k->cal(ms[k+1])==cal(ms[k])+1,1:1428)                              # contiguous, no skip, no bridge
    @test mt[end][2:3]==["valid","root"] && count(r->r[2]=="valid" && r[3]=="chain_edge",mt[2:end])==1415 && count(r->r[2]=="unknown" && r[3]=="best_effort_edge_unconfirmed",mt[2:end])==1428-1415
    @test [r[1] for r in mt[2:end] if r[2]=="unknown"]==[r[1] for r in rows(joinpath(ML,BEST))[2:end]]
    @test [r[4] for r in mt[2:end-1]]==[string(1428-k) for k in 0:1427]            # edge numbers run in producer order, 1900-01 last
    be=rows(joinpath(ML,BEST));@test length(be)>=14
end
@testset "segments" begin
    s=rows(joinpath(CD,"segments.tsv"));h=s[1];S=s[2:end]
    c(n)=findfirst(==(n),h)
    @test length(S)==23 && S[end][c("run_id")]=="43542652089"
    @test all(r->r[c("width")]=="40" && r[c("lambda")]=="3",S)
    @test all(r->r[c("print_sha256")]==V["print_sha256"] && r[c("layout_sha256")]==V["layout_sha256"] && r[c("root_month")]=="2019-01",S)
    @test S[1][c("edges_from")]=="0" && S[end][c("edges_to")]=="1428" && all(k->S[k][c("edges_to")]==S[k+1][c("edges_from")],1:22)
    @test [parse(Int,r[c("edges_to")])-parse(Int,r[c("edges_from")]) for r in S]==vcat(fill(64,7),[20],fill(64,15))      # 1980 list ends after 468 edges (1980-01), then 64 per run
    @test length(unique(r[c("run_id")] for r in S))==23
    @test Set(r[c("months_sha256")] for r in S)==Set(["d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041",V["months_sha256"]])   # 1980 list for stages 1-8, final list for 9-23
    @test S[end][c("months_sha256")]==V["months_sha256"]
    ed=rows(joinpath(CD,"edges.tsv"));@test ed[1][1:4]==["id","year","month","method"] && length(ed)==1429
    @test !any(r->occursin("greedy",r[4]),ed[2:end])
end
@testset "receipts" begin
    @test read(joinpath(CD,"julia.tsv"))==read(joinpath(CD,"flix.tsv"))
    jl=lines(joinpath(CD,"julia.tsv"))
    @test jl[end-1]=="summary\t1429\t1428\t161721\t191741\t2137\t2771\tlist:2019-01\tINVERSE_PASS"
    @test occursin(V["print_sha256"],jl[2]) && occursin(sha(joinpath(CD,"chain.moves.tsv")),jl[2])
    @test any(==("months\t$(V["months_sha256"])\t1429\t1900-01\t2019-01\t0"),jl)
    @test any(==("status\texact\t1415\tbest_effort\t13"),jl)
    @test count(l->startswith(l,"edge\t") && split(l,'\t')[11]=="PASS",jl)==1428 && count(l->startswith(l,"edge\t") && occursin("\tBEST_EFFORT\t",l),jl)==13
    il=lines(joinpath(CD,"independent.tsv"))
    @test il[end]=="independent-verdict\tACCEPT_BEST_EFFORT_CHAIN\t1429\t1428\t161721\tINVERSE_PASS"
    @test any(==("independent-status\texact\t1415\tbest_effort\t13"),il)
    @test count(l->startswith(l,"independent-root\t1900-01\t") && endswith(l,"\tACCEPT"),il)==1 && !any(l->startswith(l,"independent-root") && !endswith(l,"\tACCEPT"),il)
    ie=[split(l,'\t') for l in il if startswith(l,"independent-edge\t")]
    @test length(ie)==1428 && all(r->r[7]=="ACCEPT",ie) && count(r->length(r)==10 && r[8]=="BEST_EFFORT",ie)==13 && count(r->length(r)==7,ie)==1415
end
@testset "manifest" begin
    m=lines(joinpath(CD,"states.sha256"));@test length(m)==1429 && length(unique(split(l,"  ")[1] for l in m))==1429
    @test all(k->endswith(m[k],"states/state-"*lpad(k,2,'0')*".tsv"),1:1429)
end
