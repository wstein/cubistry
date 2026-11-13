#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Root change of a composed calendar-7 chain (owner decision 2026-11-13): the first month of the composed list becomes the solved cube.
#
# A state is a map from stickers to poses and a move turns slots, so the edge words act from the left: s_next = M * s. For the root
# state s_root (the pose of the first month in the frame of print C) the transformed states are s'_k = s_k * s_root^-1, the same words M act on
# them (s'_(k+1) = M * s'_k), s'_root is the identity, and the front images stay identical when the print is relabeled the same way:
# print' = L * s_root^-1, that is the sticker of print' at a home slot carries text, ink and up direction of the sticker that sits in that slot in
# the root state (the slot is the pair position and normal, the up direction travels with the label). Ids and pieces stay those of print C.
# No search: the output chain has the unchanged words, no start block, no root edge; only the SHA-256 digests of the states change.
#
# Input: chain files (chain.v2 or chain.v3, stage artifacts) in chronological order; each one starts at the identity of print C (no start block) or at a free
# start (start block). Each chain is replayed in the frame of print C; its declared digests are checked; the chains must join (month and full state).
# Julia 1.11.5: julia --startup-file=no root_change.jl PRINT_C OUTDIR [--states] CHAIN [CHAIN ...]
# Output: printing.tsv (print'), chain.moves.tsv (chain.v2), months.tsv, best-effort.tsv, provenance.tsv, optional states/ and states.sha256.
module RootChange
using SHA
include(joinpath(@__DIR__,"..","upright-moves","verify_moves.jl"))
ID(p)=bytes2hex(sha256(read(p)))
v3(s)=Tuple(parse.(Int,split(s,',')))
function state_sha(state)
    io=IOBuffer()
    for s in state;println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    bytes2hex(sha256(take!(io)))
end
encode(st)="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n"*join([join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t')*"\n" for s in st])
encode_print(st)="sticker\tpiece\thome\tnormal\tup\ttext\tink\n"*join([join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t')*"\n" for s in st])
canon(st)=sort([(s.pos,s.normal,s.up,s.text,s.ink) for s in st])
# ---- chain files ------------------------------------------------------------------------------------------------------------------------
function parse_move(line,out)
    g=split(line,'\t');@assert length(g)==3 && g[1]=="move" "move line";gen=parse(Int,g[2]);q=parse(Int,g[3]);@assert 1<=gen<=21 && q in (-1,1,2) "move"
    q==2 ? append!(out,[gen,gen]) : push!(out,q*gen)
end
function read_chain(path)
    L=readlines(path);@assert length(L)>=4 && L[1] in ("cubistry.calendar7.chain.v2","cubistry.calendar7.chain.v3") && L[end]=="finish" "chain header or trailer: $path"
    f=split(L[2],'\t');@assert length(f)==5 && f[1]=="source" "source line"
    src=(month=parse(Int,f[4]),year=parse(Int,f[3]),hash=String(f[5]));@assert parse(Int,f[2])==src.month "source record"
    i=3;startword=nothing
    if startswith(L[i],"start\t")
        @assert L[1]=="cubistry.calendar7.chain.v3" "start block needs chain.v3"
        n=parse(Int,split(L[i],'\t')[2]);i+=1;startword=Int[]
        for _ in 1:n;parse_move(L[i],startword);i+=1;end
    end
    edges=[]
    while L[i]!="finish"
        f=split(L[i],'\t');@assert length(f)==9 && f[1]=="edge" "edge line $i"
        j=i+1;extra=String[];moves=String[];word=Int[]
        while !startswith(L[j],"move");push!(extra,L[j]);j+=1;end
        while L[j]!="end";parse_move(L[j],word);push!(moves,L[j]);j+=1;end
        push!(edges,(year=parse(Int,f[2]),month=parse(Int,f[3]),metrics=String.(f[4:7]),sh=String(f[8]),eh=String(f[9]),extra=extra,moves=moves,word=word));i=j+1
    end
    (src=src,startword=startword,edges=edges)
end
# Replays one chain in the frame of print C: the states (start state first) with the declared digests checked.
function replay(P,ch)
    st=ch.startword===nothing ? P : apply_word(P,ch.startword)
    @assert state_sha(st)==ch.src.hash "source digest of the chain"
    states=[st]
    for e in ch.edges
        @assert state_sha(st)==e.sh "edge source digest";st=apply_word(st,e.word);@assert state_sha(st)==e.eh "edge end digest";push!(states,st)
    end
    states
end
# ---- the transformation ------------------------------------------------------------------------------------------------------------------
# J[i] = id of the root sticker that sits in the slot (position, normal) of the home frame of print sticker i
function slot_map(P,root)
    slot=Dict((s.pos,s.normal)=>s.id for s in root)
    J=[slot[(p.pos,p.normal)] for p in P]
    @assert sort(J)==collect(1:length(P)) "slot map is a permutation"
    for pc in unique(p.piece for p in P);@assert length(unique(root[J[p.id]].piece for p in P if p.piece==pc))==1 "a piece stays rigid";end
    J
end
relabeled_print(P,root,J)=[(id=p.id,piece=p.piece,pos=p.pos,normal=p.normal,up=root[J[p.id]].up,text=root[J[p.id]].text,ink=root[J[p.id]].ink) for p in P]
relabel_state(P,Pn,J,st)=[(id=p.id,piece=p.piece,pos=st[J[p.id]].pos,normal=st[J[p.id]].normal,up=st[J[p.id]].up,text=Pn[p.id].text,ink=Pn[p.id].ink) for p in P]
# ---- composition -------------------------------------------------------------------------------------------------------------------------
function compose(P,chains)
    parts=[];seq=Tuple{Int,Int}[];last=nothing
    for (k,ch) in enumerate(chains)
        states=replay(P,ch)
        if last!==nothing
            @assert (ch.src.year,ch.src.month)==last.month "chains join in one month"
            @assert canon(states[1])==canon(last.state) "chains join in one state"
        end
        k==1 && push!(seq,(ch.src.year,ch.src.month))
        for e in ch.edges;@assert (e.year,e.month)>seq[end] "months strictly increasing";push!(seq,(e.year,e.month));end
        last=(month=seq[end],state=states[end]);push!(parts,states)
    end
    (months=seq,states=vcat(parts[1],[p[2:end] for p in parts[2:end]]...))
end
ym(t)=string(t[1],'-',lpad(t[2],2,'0'))
function run_root_change(args)
    pos=[a for a in args if !startswith(a,"--")];keep_states="--states" in args
    @assert length(pos)>=3 "root_change.jl PRINT_C OUTDIR [--states] CHAIN [CHAIN ...]"
    print_path,out=pos[1],pos[2];paths=pos[3:end]
    P=read_print(print_path);chains=[read_chain(p) for p in paths]
    comp=compose(P,chains);states=comp.states;root=states[1]
    J=slot_map(P,root);Pn=relabeled_print(P,root,J);S=[relabel_state(P,Pn,J,s) for s in states]
    mkpath(out);write(joinpath(out,"printing.tsv"),encode_print(Pn))
    @assert canon(S[1])==canon(Pn) "the root state is the identity of print'"
    lines=["cubistry.calendar7.chain.v2","source\t$(comp.months[1][2])\t$(comp.months[1][1])\t$(comp.months[1][2])\t$(state_sha(S[1]))"]
    k=1;best=String[]
    for ch in chains,e in ch.edges
        k+=1
        push!(lines,join(["edge",e.year,e.month,e.metrics...,state_sha(S[k-1]),state_sha(S[k])],'\t'));append!(lines,e.extra);append!(lines,e.moves);push!(lines,"end")
        w=[split(x,'\t') for x in e.extra if startswith(x,"wrong\t")]
        isempty(w) || push!(best,string(e.year,'-',lpad(e.month,2,'0'),"\tbest_effort_unverified\t",join(["$(x[2]),$(x[3])" for x in w],';'),"\tchain.moves.tsv"))
    end
    push!(lines,"finish");write(joinpath(out,"chain.moves.tsv"),join(lines,"\n")*"\n")
    write(joinpath(out,"months.tsv"),join(ym.(comp.months),"\n")*"\n")
    write(joinpath(out,"best-effort.tsv"),join(vcat(["month\tstatus\twrong_cells\tevidence"],best),"\n")*"\n")
    if keep_states
        mkpath(joinpath(out,"states"));man=String[]
        for (i,s) in enumerate(S)
            f=joinpath("states","state-"*lpad(i,2,'0')*".tsv");write(joinpath(out,f),encode(s));push!(man,ID(joinpath(out,f))*"  "*f)
        end
        write(joinpath(out,"states.sha256"),join(man,"\n")*"\n")
    end
    prov=["file\tsha256\tnote","print-c\t$(ID(print_path))\tinput print"]
    for (p,ch) in zip(paths,chains);push!(prov,"input\t$(ID(p))\t$(basename(dirname(p)))/$(basename(p)) edges=$(length(ch.edges)) start=$(ch.startword===nothing ? "identity" : "free")");end
    for f in ("printing.tsv","chain.moves.tsv","months.tsv","best-effort.tsv");push!(prov,"output\t$(ID(joinpath(out,f)))\t$f");end
    push!(prov,"digest\t$(state_sha(S[1]))\tidentity of print' (root $(ym(comp.months[1])))")
    write(joinpath(out,"provenance.tsv"),join(prov,"\n")*"\n")
    println("root-change\t",ym(comp.months[1]),'\t',ym(comp.months[end]),'\t',length(S)-1," edges\tprint' ",ID(joinpath(out,"printing.tsv")))
end
end
if abspath(PROGRAM_FILE)==@__FILE__
    try;RootChange.run_root_change(ARGS);catch e;println(stderr,"INVALID\t",sprint(showerror,e));exit(1);end
end
