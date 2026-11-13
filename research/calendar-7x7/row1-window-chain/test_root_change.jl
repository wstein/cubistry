#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests of root_change.jl (root change of a composed chain). Fixtures are synthetic chains on the real print C: two backward segments (free starts,
# the second one ends at the identity pose) and one forward segment (identity start), random words, the months only label the edges (the front rule is not
# part of the transformation; the full chain is run through the three chain checkers, see evidence/chain-1980-2036/).
# Julia 1.11.5: julia --startup-file=no test_root_change.jl (about 20 s). The library may be replaced by a mutated copy through CAL7_ROOTCHANGE_LIB
# (tests of this test: run_root_change_mutants.sh).
using Test, SHA, Random
include(get(ENV,"CAL7_ROOTCHANGE_LIB",joinpath(@__DIR__,"root_change.jl")))
using .RootChange: RootChange
const RC=RootChange
const PRINTC=joinpath(@__DIR__,"evidence","print-c","printing.tsv")
P=RC.read_print(PRINTC)
rng=MersenneTwister(1980)
rword(n)=[rand(rng,(-1,1))*rand(rng,1:21) for _ in 1:n]
inv_word(w)=-reverse(w)
mvlines(w)=["move\t$(abs(g))\t$(sign(g))" for g in w]
function write_chain(path,P,startword,months,words,extra)   # months[1] = month of the start state, months[k+1] = month of edge k
    io=String[];hdr=startword===nothing ? "cubistry.calendar7.chain.v2" : "cubistry.calendar7.chain.v3"
    st=startword===nothing ? P : RC.apply_word(P,startword);m=months[1]
    push!(io,hdr,"source\t$(m[2])\t$(m[1])\t$(m[2])\t$(RC.state_sha(st))")
    if startword!==nothing;push!(io,"start\t$(length(startword))");append!(io,mvlines(startword));end
    for (k,w) in enumerate(words)
        nx=RC.apply_word(st,w);y,mo=months[k+1]
        push!(io,"edge\t$y\t$mo\t$(length(w))\t$(length(w))\t0\t0\t$(RC.state_sha(st))\t$(RC.state_sha(nx))");append!(io,extra[k]);append!(io,mvlines(w));push!(io,"end");st=nx
    end
    push!(io,"finish");write(path,join(io,"\n")*"\n");st
end
dir=mktempdir()
S2=rword(9);w2=[rword(5) for _ in 1:3];months2=[(1999,10),(1999,11),(1999,12),(2000,1)]
S1=vcat(S2,reduce(vcat,w2));w1=[rword(4),rword(6)];closing=inv_word(vcat(S1,reduce(vcat,w1)));w1=vcat(w1,[closing]);months1=[(2000,1),(2000,2),(2000,3),(2000,4)]
wf=[rword(5),rword(5)];monthsf=[(2000,4),(2000,5),(2000,6)]
c2=joinpath(dir,"b2.tsv");c1=joinpath(dir,"b1.tsv");cf=joinpath(dir,"f.tsv")
e2=write_chain(c2,P,S2,months2,w2,[String[] for _ in w2]);e1=write_chain(c1,P,S1,months1,w1,[String[] for _ in w1])
ef=write_chain(cf,P,nothing,monthsf,wf,[String[],["wrong\t7\t1","hall\t7,1;7,7"]])
@assert RC.canon(e1)==RC.canon(P) "fixture: the second backward segment ends at the identity pose"
out=joinpath(dir,"out");RC.run_root_change([PRINTC,out,"--states",c2,c1,cf])
rows(p)=[split(l,'\t') for l in split(chop(read(p,String);tail=1),'\n')]
# frame of print C: the replayed states of the three chains
function states_c()
    s=RC.apply_word(P,S2);out=[s]
    for w in vcat(w2,w1,wf);s=RC.apply_word(s,w);push!(out,s);end
    out
end
SC=states_c();NE=length(SC)-1
front(st)=sort([(s.pos,s.up,s.text,s.ink) for s in st if s.normal==(0,0,1)])
function read_st(p)
    r=rows(p)[2:end];[(id=parse(Int,f[1]),piece=parse(Int,f[2]),pos=RC.v3(f[3]),normal=RC.v3(f[4]),up=RC.v3(f[5]),text=String(f[6]),ink=String(f[7])) for f in r]
end
Pn=RC.read_print(joinpath(out,"printing.tsv"))
SP=[read_st(joinpath(out,"states","state-"*lpad(i,2,'0')*".tsv")) for i in 1:NE+1]
@testset "print'" begin
    @test length(Pn)==294 && all(i->(Pn[i].id,Pn[i].piece,Pn[i].pos,Pn[i].normal)==(P[i].id,P[i].piece,P[i].pos,P[i].normal),1:294)
    @test count(i->Pn[i].up!=P[i].up,1:294)>20                       # the up column is relabeled (a fixture that does not turn stickers would not test it)
    @test count(i->(Pn[i].text,Pn[i].ink)!=(P[i].text,P[i].ink),1:294)>100
    root=SC[1]
    @test all(Pn[i] == (id=i,piece=P[i].piece,pos=P[i].pos,normal=P[i].normal,up=only(s.up for s in root if s.pos==P[i].pos && s.normal==P[i].normal),text=only(s.text for s in root if s.pos==P[i].pos && s.normal==P[i].normal),ink=only(s.ink for s in root if s.pos==P[i].pos && s.normal==P[i].normal)) for i in 1:294)
    @test sort(collect(zip((p.text for p in Pn),(p.ink for p in Pn))))==sort(collect(zip((p.text for p in P),(p.ink for p in P))))   # same multiset of labels
end
@testset "root and fronts" begin
    @test RC.canon(SP[1])==RC.canon(Pn)                              # the first month is the solved cube of print'
    @test all(k->front(SC[k])==front(SP[k]),1:NE+1)                  # front images unchanged
    @test RC.canon(SC[1])!=RC.canon(P) && all(k->RC.canon(SC[k])==RC.canon(SP[k]),1:NE+1) && any(k->SC[k]!=SP[k],1:NE+1)   # the same labeled poses, other sticker ids; the root differs from print C
end
@testset "words unchanged" begin
    words=vcat(w2,w1,wf)
    @test all(k->RC.canon(RC.apply_word(SP[k],words[k]))==RC.canon(SP[k+1]),1:NE)
    st=Pn;for w in words;st=RC.apply_word(st,w);end
    @test RC.canon(st)==RC.canon(SP[end])
    ch=RC.read_chain(joinpath(out,"chain.moves.tsv"))
    @test ch.startword===nothing && length(ch.edges)==NE && vcat((e.word for e in ch.edges)...)==vcat(words...)
    @test [e.moves for e in ch.edges]==vcat([RC.read_chain(c).edges[k].moves for c in (c2,c1,cf) for k in 1:length(RC.read_chain(c).edges)])
end
@testset "digests" begin
    ch=RC.read_chain(joinpath(out,"chain.moves.tsv"))
    @test ch.src.hash==RC.state_sha(Pn) && RC.state_sha(SP[1])==RC.state_sha(Pn)
    @test all(k->ch.edges[k].sh==RC.state_sha(SP[k]) && ch.edges[k].eh==RC.state_sha(SP[k+1]),1:NE)
    @test all(k->ch.edges[k].sh!=RC.read_chain(c2).edges[1].sh,1:NE)   # digests are those of print', none is a digest of print C
    old=[RC.state_sha(s) for s in SC];@test isempty(intersect(old,[ch.edges[k].eh for k in 1:NE]))
end
@testset "months and best effort" begin
    ms=[l for l in split(chop(read(joinpath(out,"months.tsv"),String);tail=1),'\n')]
    @test ms==["1999-10","1999-11","1999-12","2000-01","2000-02","2000-03","2000-04","2000-05","2000-06"]   # joins appear once
    @test length(ms)==NE+1
    @test rows(joinpath(out,"best-effort.tsv"))==[["month","status","wrong_cells","evidence"],["2000-06","best_effort_unverified","7,1","chain.moves.tsv"]]
    ch=RC.read_chain(joinpath(out,"chain.moves.tsv"))
    @test ch.edges[end].extra==["wrong\t7\t1","hall\t7,1;7,7"]
end
@testset "manifest and provenance" begin
    man=rows(joinpath(out,"states.sha256"))
    @test length(man)==NE+1 && all(r->bytes2hex(sha256(read(joinpath(out,String(split(r[1]," ")[3])))))==split(r[1]," ")[1],man)
    prov=rows(joinpath(out,"provenance.tsv"))
    @test any(r->r[1]=="print-c" && r[2]==bytes2hex(sha256(read(PRINTC))),prov) && count(r->r[1]=="input",prov)==3 && count(r->r[1]=="output",prov)==4
end
@testset "deterministic" begin
    out2=joinpath(dir,"out2");RC.run_root_change([PRINTC,out2,c2,c1,cf])
    @test all(f->read(joinpath(out,f))==read(joinpath(out2,f)),("printing.tsv","chain.moves.tsv","months.tsv","best-effort.tsv","provenance.tsv"))
end
@testset "inputs are refused" begin
    o=joinpath(dir,"bad")
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c1,c2,cf])                 # not chronological: months do not join
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c2,cf])                    # gap: the second backward segment is missing
    t=read(cf,String);bad=joinpath(dir,"f-bad.tsv");write(bad,replace(t,r"(edge\t2000\t5\t5\t5\t0\t0\t[0-9a-f]{64}\t)[0-9a-f]"=>s"\1x"))
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c2,c1,bad])                # declared end digest
    t=read(c1,String);bad=joinpath(dir,"b1-bad.tsv");write(bad,replace(t,r"(source\t1\t2000\t1\t)[0-9a-f]"=>s"\1x",count=1))
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c2,bad,cf])                # declared start digest
    sw=joinpath(dir,"b2-nostart.tsv");write(sw,replace(read(c2,String),r"cubistry.calendar7.chain.v3\n"=>"cubistry.calendar7.chain.v2\n"))
    @test_throws AssertionError RC.run_root_change([PRINTC,o,sw,c1,cf])                 # start block in a v2 chain
end
@testset "joins are checked separately" begin
    o=joinpath(dir,"bad2")
    shifted=joinpath(dir,"b1-months.tsv");write_chain(shifted,P,S1,[(2000,2),(2000,3),(2000,4),(2000,5)],w1,[String[] for _ in w1])
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c2,shifted])               # states join, months do not
    open_end=joinpath(dir,"b1-open.tsv");write_chain(open_end,P,S1,months1,vcat(w1[1:2],[rword(3)]),[String[] for _ in w1])
    @test_throws AssertionError RC.run_root_change([PRINTC,o,c2,open_end,cf])           # months join, states do not (the segment does not end at the identity)
    t=read(c1,String);bad=joinpath(dir,"b1-sw.tsv");write(bad,replace(t,r"\nstart\t\d+\n"=>s"\nstart\t0\n"))
    @test_throws Exception RC.run_root_change([PRINTC,o,c2,bad,cf])                     # start block and its moves disagree
end
