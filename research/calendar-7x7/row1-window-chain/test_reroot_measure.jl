#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests of reroot_measure_lib.jl (pure functions of the re-root measurement; no solver, no library build; about 10 s).
#   julia --startup-file=no test_reroot_measure.jl
using Test
include(joinpath(@__DIR__,"reroot_measure_lib.jl"));using .RerootMeasure
const RM=RerootMeasure
const EV=joinpath(@__DIR__,"evidence","reroot-measure")
const CHAIN=joinpath(EV,"chain-2019-01-2036-01.moves.tsv")
htm1(w)=length(w)                          # toy cost: one move = 1 HTM

@testset "lcp" begin
    @test RM.lcp([1,2,3],[1,2,4])==2
    @test RM.lcp([1,2],[1,2,3])==2
    @test RM.lcp(Int[],[1])==0
    @test RM.lcp_all([[1,2,3],[1,2,4],[1,2]])==2
    @test RM.lcp_all([[5,6],[7]])==0
    @test RM.lcp_all([[1,2,3]])==3
end

@testset "chain reader keeps move, wrong and hall records apart" begin
    txt=join(["cubistry.calendar7.chain.v2","source\t1\t2019\t1\taa",
        "edge\t2019\t2\t2\t2\t0\t0\taa\tbb","move\t3\t1","move\t4\t-1","end",
        "edge\t2026\t2\t3\t4\t1\t2\tbb\tcc","wrong\t7\t1","hall\t7,1;7,7","move\t2\t1","move\t15\t2","move\t12\t2","end",
        "finish"],"\n")*"\n"
    E=RM.read_chain_edges(txt)
    @test [e.id for e in E]==[2,3] && [(e.year,e.month) for e in E]==[(2019,2),(2026,2)]
    @test E[1].moves==[(3,1),(4,-1)] && isempty(E[1].wrong) && isempty(E[1].hall)
    # the edge with a best-effort cell: wrong cell (7,1) is a cell, not a move; the hall record is a witness, not a move
    @test E[2].moves==[(2,1),(15,2),(12,2)]
    @test E[2].wrong==[(7,1)] && E[2].hall==[[(7,1),(7,7)]]
    @test E[2].fields[9]=="cc" && E[2].fields[8]=="bb"
    # fail closed
    @test_throws "unknown record halo" RM.read_chain_edges(replace(txt,"hall\t7,1;7,7"=>"halo\t7,1;7,7"))
    @test_throws "no finish record" RM.read_chain_edges(replace(txt,"finish\n"=>""))
    @test_throws ErrorException RM.read_chain_edges(replace(txt,"move\t4\t-1"=>"move\t4"))
    @test_throws ErrorException RM.read_chain_edges(replace(txt,"hall\t7,1;7,7"=>"hall\t7,1;7"))
    @test_throws ErrorException RM.read_chain_edges(replace(txt,"cubistry.calendar7.chain.v2"=>"x"))
end

@testset "stored chain evidence parses (204 edges, one best-effort edge)" begin
    E=RM.read_chain_edges(read(CHAIN,String))
    @test length(E)==204 && E[1].id==2 && E[end].id==205
    @test sum(length(e.moves) for e in E)==23630
    be=[e for e in E if !isempty(e.wrong)]
    @test length(be)==1 && (be[1].year,be[1].month)==(2026,2) && be[1].wrong==[(7,1)] && be[1].hall==[[(7,1),(7,7)]]
    @test be[1].id==86 && length(be[1].moves)==parse(Int,be[1].fields[4])+count(m->m[1]%7==0,be[1].moves)
    # the ids of the nine edges of the first measurement
    ids=Dict((e.year,e.month)=>e.id for e in E)
    @test [ids[ym] for ym in [(2019,3),(2019,4),(2021,3),(2021,4),(2022,10),(2023,4),(2024,11),(2031,6),(2032,2)]]==[3,4,27,28,46,52,71,150,158]
end

@testset "commit events of a logged beam" begin
    # prefixes A_d of the beam nodes per iteration; the committed prefix only grows by extension
    As=[Int[],Int[],[1],[1],[1,2,3],[1,2,3],[1,2,3,4,5,6]]
    ev=RM.commit_events(As,htm1)
    @test [(e.iter,e.htm) for e in ev]==[(3,1),(5,3),(7,6)]
    @test ev[2].prefix==[1,2,3]
    # a prefix that does not extend the committed one (seam rewrite) is not a commit and is counted
    ev,skipped=RM.commit_events([[1],[1,2],[7,8,9],[1,2,3]],htm1;count_skipped=true)
    @test [e.iter for e in ev]==[1,2,4] && skipped==1
    @test isempty(RM.commit_events([Int[],Int[]],htm1))
    # equal length is not growth
    @test length(RM.commit_events([[1],[1],[1]],htm1))==1
end

@testset "commit points: thresholds then the last commit" begin
    ev=RM.commit_events([[1],[1,2],[1,2,3],[1,2,3,4,5,6,7,8,9,10,11],[1,2,3,4,5,6,7,8,9,10,11,12]],htm1)
    cp=RM.commit_points(ev,[1,3,10])
    @test [c.htm for c in cp]==[1,3,11,12]                          # 1, 3, first >=10 is 11, plus the last (12)
    @test [c.iter for c in cp]==[1,3,4,5]
    @test [c.htm for c in RM.commit_points(ev,[1,1,2])]==[1,2,12]     # duplicates and equal commits collapse
    @test [c.htm for c in RM.commit_points(ev,[100])]==[12]           # a threshold never reached adds nothing; the last stays
    @test isempty(RM.commit_points(RM.commit_events([Int[]],htm1),[1,10]))
    @test_throws ErrorException RM.commit_points(ev,[0])
    @test RM.parse_thresholds("1,10, 30")==[1,10,30]
    @test_throws ErrorException RM.parse_thresholds("")
    @test_throws ErrorException RM.parse_thresholds("1,x")
end

@testset "re-root cost (streamed route = frozen prefix followed by the re-solved rest, no cancellation across the seam)" begin
    P=[1,2,3,4];rest=[5,6,7,8,9,10]
    c=RM.reroot_cost(P,rest,12,htm1)
    @test c.streamed==10 && c.cost==-2 && c.share==0.4 && c.p_htm==4 && c.rest_htm==6
    @test RM.reroot_cost(P,rest,10,htm1).cost==0
    @test RM.reroot_cost(P,rest,8,htm1).cost==2
    # seam: tokens that normalization would cancel at the junction are counted, never removed from the streamed route
    norm(w)=(out=Int[];for x in w;!isempty(out)&&out[end]==-x ? pop!(out) : push!(out,x);end;out)
    @test RM.seam_cancel([1,2],[-2,-1,3],norm)==4
    @test RM.seam_cancel([1,2],[3],norm)==0
    @test RM.reroot_cost([1,2],[-2,-1,3],5,htm1;norm).streamed==5
    @test RM.reroot_cost([1,2],[-2,-1,3],5,htm1;norm).seam==4
    @test isnan(RM.reroot_cost(Int[],Int[],0,htm1).share)
end

@testset "frozen inputs" begin
    @test RM.check_sums(joinpath(EV,"SHA256SUMS"))===nothing
    @test_throws ErrorException RM.check_sums(joinpath(EV,"SHA256SUMS");root=joinpath(EV,".."))   # wrong root: files missing
    mktempdir() do d
        write(joinpath(d,"a.txt"),"x\n");write(joinpath(d,"SHA256SUMS"),"0000000000000000000000000000000000000000000000000000000000000000  a.txt\n")
        @test_throws ErrorException RM.check_sums(joinpath(d,"SHA256SUMS"))
        write(joinpath(d,"SHA256SUMS"),RM.sha256_file(joinpath(d,"a.txt"))*"  a.txt\n")
        @test RM.check_sums(joinpath(d,"SHA256SUMS"))===nothing
        @test_throws ErrorException RM.check_sums(joinpath(d,"SHA256SUMS");expect=Dict("a.txt"=>"1"^64))
    end
end

@testset "edge selection" begin
    E=RM.read_chain_edges(read(CHAIN,String))
    table=RM.read_stage_table(joinpath(EV,"edges-stage5.tsv"))
    @test length(table)==204 && table[1].id==2
    measured=[3,4,27,28,46,52,71,150,158]
    sel=RM.select_edges(table,E,measured;n=10)
    @test length(sel)==10 && length(unique(s.id for s in sel))==10
    @test isdisjoint([s.id for s in sel],measured)
    @test 86 ∉ [s.id for s in sel]                                    # the best-effort edge is not solved by solve_edge
    h=[s.htm for s in sel];@test h==sort(h)
    @test h[1]==minimum(t.htm for t in table if t.id∉measured && t.id!=86) && h[end]==maximum(t.htm for t in table if t.id∉measured && t.id!=86)
    @test RM.select_edges(table,E,measured;n=10)==sel                  # deterministic
    # the committed list is this selection
    rows=RM.read_selection(joinpath(EV,"edges-selected.tsv"))
    @test [(r.id,r.month,r.htm,r.method,r.rotations) for r in rows]==[(s.id,s.month,s.htm,s.method,s.rotations) for s in sel]
    @test any(r.rotations>=2 for r in rows) && any(r.rotations<=1 for r in rows)
    @test length(unique(r.method for r in rows))>=2
    @test RM.parse_ids("3,4,27")==[3,4,27]
    @test_throws ErrorException RM.parse_ids("3,,4")
    @test_throws ErrorException RM.parse_ids("3,3")
    @test RM.pairs_of([1,2,3,4,5],2)==["1,2","3,4","5"]
end

@testset "output rows" begin
    @test length(RM.REROOT_COLUMNS)==length(unique(RM.REROOT_COLUMNS))
    r=RM.reroot_row(; id=7,month="2020-01",k=2,iter=5,t_s=1.5,p_htm=3,free_htm=10,rest_htm=9,streamed=12,merged=11,seam=2,method="beam",resolve_s=3.25,status="ok")
    @test length(split(r,'\t'))==length(RM.REROOT_COLUMNS)
    @test split(r,'\t')[findfirst(==("cost_htm"),RM.REROOT_COLUMNS)]=="2"
    @test split(r,'\t')[findfirst(==("share"),RM.REROOT_COLUMNS)]=="0.25"
    none=RM.reroot_row(; id=7,month="2020-01",k=2,iter=5,t_s=1.5,p_htm=3,free_htm=10,rest_htm=-1,streamed=-1,merged=-1,seam=0,method="none",resolve_s=3.25,status="none")
    @test split(none,'\t')[findfirst(==("cost_htm"),RM.REROOT_COLUMNS)]=="-"
end

@testset "better reference length (best_ref = min of stored, root re-solve, wide re-solve)" begin
    @test RM.best_ref(134,97,100)==97
    @test RM.best_ref(134,140,98)==98
    @test RM.best_ref(134,nothing,nothing)==134
    @test RM.best_ref(134,nothing,120)==120
    @test RM.best_ref(15,15,nothing)==15
    @test RM.best_ref(14,20,30)==14                                   # the stored length can be the best
    @test RM.cost_vs_best(97,97)==0 && RM.cost_vs_best(104,97)==7 && RM.cost_vs_best(90,97)==-7
    @test RM.ref_cells(100,nothing,100)==["100","-","100"]
    @test RM.ref_cells(nothing,nothing,134)==["-","-","134"]
    @test RM.SUMMARY_REF_COLUMNS==["ref_root_htm","ref_wide_htm","best_ref_htm","ref_wide_width"]
    @test RM.parse_ref_width("",40)==80 && RM.parse_ref_width("60",40)==60 && RM.parse_ref_width(" ",3)==6
    for bad in ("0","-5","401","x","1.5")
        @test_throws ErrorException RM.parse_ref_width(bad,40)
    end
    @test_throws ErrorException RM.parse_ref_width("",201)             # twice the width must stay <= 400
    # the old columns keep their positions, the new ones are appended
    c=RM.REROOT_COLUMNS
    @test c[1:16]==["id","month","commit","iter","t_s","p_htm","free_htm","rest_htm","streamed_htm","cost_htm","share","merged_htm","seam_cancel","method","resolve_s","status"]
    @test c[17:end]==["ref_root_htm","ref_wide_htm","best_ref_htm","cost_vs_best_htm"]
    kw=(id=166,month="2032-10",k=1,iter=6,t_s=6.2,p_htm=1,free_htm=134,rest_htm=96,streamed=97,merged=97,seam=0,method="beam",resolve_s=23.0,status="ok")
    f(r)=split(r,'\t')
    r=f(RM.reroot_row(;kw...,ref_root=100,ref_wide=98,best_ref=98))
    @test length(r)==length(c)
    @test r[findfirst(==("cost_vs_best_htm"),c)]=="-1" && r[findfirst(==("cost_htm"),c)]=="-37"
    @test r[findfirst(==("ref_root_htm"),c)]=="100" && r[findfirst(==("ref_wide_htm"),c)]=="98" && r[findfirst(==("best_ref_htm"),c)]=="98"
    r=f(RM.reroot_row(;kw...,ref_root=nothing,ref_wide=nothing,best_ref=134))
    @test r[findfirst(==("ref_root_htm"),c)]=="-" && r[findfirst(==("cost_vs_best_htm"),c)]=="-37"
    r=f(RM.reroot_row(;kw...,streamed=-1,rest_htm=-1,merged=-1,method="none",status="none",ref_root=100,ref_wide=98,best_ref=98))
    @test r[findfirst(==("cost_vs_best_htm"),c)]=="-" && r[findfirst(==("best_ref_htm"),c)]=="98"
    # the existing keyword calls without reference values still work (references default to missing; best defaults to free_htm)
    r=f(RM.reroot_row(;kw...))
    @test length(r)==length(c) && r[findfirst(==("best_ref_htm"),c)]=="134" && r[findfirst(==("cost_vs_best_htm"),c)]=="-37"
end

println("mutations: not run (opt-in; run_reroot_mutants.sh)")
