#!/usr/bin/env julia
# UNTRUSTED producer (candidate generator only): RESUMABLE variant of pilot/producer.jl for
# the pure split, written as a new file; producer.jl itself is NOT modified.
# Derived from pilot/producer.jl with SHA-256
#   c9e2249fba62b5904525c20558f9d9789a8d79a2857b14368d9079e43dde2adc
# (check: sha256sum pilot/producer.jl). The block from `function obtm` through `solve_edge`
# (macro library, beam edge search, hybrid finish, acceptance check, setting schedule
# 12/40/1, 8/30/1, 12/60/1, 12/40/0, and the orbitfb fallback) is a verbatim copy of
# producer.jl lines 33-233. Only the argument handling and the driver differ: the layout is
# fixed to the pure split, the variant is fixed to orbitfb (identical to base unless every
# setting and the hybrid finish fail), the start is a root month or the end of a prior
# chain, and the output is the cumulative chain. Chains still need both chain verifiers.
# Usage: producer-resume.jl DAG PRINT OUT_PREFIX EDGES START PRIOR_MOVES
#   EDGES        number of new month edges to produce (stops early after 2099-12)
#   START        YYYY-MM root month of a fresh chain (PRIOR_MOVES is "-"), or "resume" to
#                continue from the end of PRIOR_MOVES (a cumulative chain file)
#   Writes OUT_PREFIX.moves.tsv (cumulative: prior edge blocks copied verbatim, then the new
#   blocks) and OUT_PREFIX-edges.tsv (one header line plus the new edges only).
#   Exits non-zero (and writes no moves file) when the prior chain does not replay or an edge fails.
include(joinpath(@__DIR__,"..","pure_common.jl"))
include(joinpath(@__DIR__,"..","..","minimax","search.jl"))
include(joinpath(@__DIR__,"..","orbit_solve.jl"))
const M=Minimax; const P=M.P
@assert length(ARGS)==6 "usage: DAG PRINT OUT_PREFIX EDGES START(YYYY-MM|resume) PRIOR_MOVES(path|-)"
const DAG=ARGS[1]; const PRINT=ARGS[2]; const OUTP=ARGS[3]
const NEDGES=parse(Int,ARGS[4]); const STARTARG=ARGS[5]; const PRIOR=ARGS[6]
@assert NEDGES>=1 "EDGES must be positive"
const VARIANT="orbitfb"
const LAYOUT="pure"; const LAYOUT_VARIANT=PURE_VARIANT
calendar_target(y,m)=(year=y,month=m,board=stacked_board(y,m,LAYOUT_VARIANT))
const LAMBDA0=12.0; const WIDTH0=40
proof=P.replay_dag(DAG);const action=proof.action;const a=M.Algebra(action);const gens=a.generators
const source=P.read_physical(PRINT)
digest(st)=P.state_digest(P.decode_physical(source,st,action))
const OLDT=physical_targets("EN")
const IDX=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(OLDT))
nextym(y,m)=m==12 ? (y+1,1) : (y,m+1)
# ---- start: a root month of the DAG, or the end of the prior cumulative chain ----
struct Block; year::Int; month::Int; sh::String; eh::String; moves::Vector{Tuple{Int,Int}}; first::Int; last::Int; end
function read_prior(path)
    L=readlines(path)
    @assert length(L)>=4 && L[1]=="cubistry.calendar7.chain.v1" && L[end]=="finish" "prior chain: bad header or trailer"
    f=split(L[2],'\t'); @assert length(f)==5 && f[1]=="source" "prior chain: bad source line"
    blocks=Block[]; i=3
    while L[i]!="finish"
        f=split(L[i],'\t'); @assert length(f)==9 && f[1]=="edge" "prior chain: bad edge line $i"
        j=i+1; mv=Tuple{Int,Int}[]
        while L[j]!="end"
            g=split(L[j],'\t'); @assert length(g)==3 && g[1]=="move" "prior chain: bad move line $j"
            push!(mv,(parse(Int,g[2]),parse(Int,g[3]))); j+=1
        end
        push!(blocks,Block(parse(Int,f[2]),parse(Int,f[3]),String(f[8]),String(f[9]),mv,i,j)); i=j+1
    end
    (lines=L,root=parse(Int,f[2]),blocks=blocks)
end
if STARTARG=="resume"
    @assert PRIOR!="-" "resume needs PRIOR_MOVES"
    global prior=read_prior(PRIOR)
    sf=split(prior.lines[2],'\t')
    global ROOTID=parse(Int,sf[2]); global SRCY=parse(Int,sf[3]); global SRCM=parse(Int,sf[4]); global HASH0=String(sf[5])
else
    @assert PRIOR=="-" "a fresh chain needs PRIOR_MOVES to be -"
    mt=match(r"^(\d{4})-(\d{1,2})$",STARTARG); @assert !isnothing(mt) "START must be YYYY-MM or resume"
    global prior=nothing
    global SRCY=parse(Int,mt[1]); global SRCM=parse(Int,mt[2])
    @assert 2026<=SRCY<=2099 && 1<=SRCM<=12 "START out of range"
    global ROOTID=IDX[join(string.(wrapped_board(SRCY,SRCM)),"|")]
    global HASH0=""
end
const ROOTSTATE=P.signed_perm(proof.registers,proof.targets[ROOTID])
P.validate_front(P.decode_physical(source,ROOTSTATE,action),calendar_target(SRCY,SRCM))
isempty(HASH0) ? (global HASH0=digest(ROOTSTATE)) : @assert digest(ROOTSTATE)==HASH0 "prior chain source hash differs from the DAG root state"
# ---- replay the retained prior prefix from its root, checking digests and fronts ----
state=ROOTSTATE; lastym=(SRCY,SRCM); const BLOCKS=isnothing(prior) ? Block[] : prior.blocks
for (i,b) in enumerate(BLOCKS)
    global state,lastym
    lastym=nextym(lastym...); @assert (b.year,b.month)==lastym "prior chain not chronological at edge $i"
    @assert digest(state)==b.sh "replay: source digest mismatch at prior edge $i"
    state=P.compose(state,P.macro_word_perm(M.expand(b.moves),gens))
    @assert digest(state)==b.eh "replay: end digest mismatch at prior edge $i"
    P.validate_front(P.decode_physical(source,state,action),calendar_target(b.year,b.month))
end
println("replayed ",length(BLOCKS)," prior edges; chain end ",lastym[1],"-",lastym[2],"; state digest ",digest(state)); flush(stdout)
const EDGES=let (y,m)=lastym,e=Tuple{Int,Int}[]
    while length(e)<NEDGES && (y,m)<(2099,12)
        y,m=nextym(y,m); push!(e,(y,m))
    end; e
end
isempty(EDGES) && println("chain already ends at 2099-12; no new edges")
function obtm(word)
    w=filter(g->abs(g)%7!=0,M.simplify(word,a))
    blocks=Vector{Int}[];axes=Int[]
    for s in w
        g=abs(s);axis=div(g-1,7)+1;slot=mod(g-1,7)+1
        if isempty(axes)||last(axes)!=axis;push!(axes,axis);push!(blocks,zeros(Int,6));end
        blocks[end][slot]=mod(blocks[end][slot]+(s>0 ? 1 : -1),4)
    end
    total=0
    for b in blocks
        slot=1
        while slot<=6
            if b[slot]==0;slot+=1;continue;end
            q=b[slot];stop=slot
            while stop<6 && b[stop+1]==q && stop!=3;stop+=1;end
            total+=((slot==1)||(stop==6)) ? 1 : 2
            slot=stop+1
        end
    end
    total
end
# ---------------- library (built once; front positions are the same for every target) ----------
function conpos_for(target)
    hc=falses(264)
    for k in 1:11, (idx,set) in P.macro_front_constraints(source,target,action,k); hc[24(k-1)+idx]=true; end
    findall(hc)
end
const CONPOS=conpos_for(calendar_target(2026,2))
const ORBW=vcat([29/4,54/7,57/8,73/4,26/4,25/3,71/4,24/3,30/4,67/4]./8,50.0)   # W1 of gs27; center (orbit 11) effectively hard
const W=[ORBW[div(x-1,24)+1] for x in 1:264]
inv(w)=P.macro_inverse(w)
struct Mac; cs::Vector{Int}; src::Vector{Int}; word::Vector{Int}; cost::Int; winv::Vector{UInt16}; end
function build_library()
    legal=[g for g in 1:21 if g%7!=0]
    B=Vector{Int}[]; for g in legal; push!(B,[g]); push!(B,[-g]); push!(B,[g,g]); end
    for ax in 0:2,(s1,s2) in ((1,2),(2,3),(4,5),(5,6)),sg in (1,-1),q in (1,2)
        push!(B,repeat([sg*(7ax+s1),sg*(7ax+s2)],q))
    end
    axis(w)=div(abs(first(w))-1,7)
    freefront=[w for w in B if all(g->abs(g) in 15:19,w) && length(unique(abs.(w)))==1]
    lib=Dict{Vector{UInt16},Tuple{Vector{Int},Int}}()
    function add!(word)
        p=P.macro_word_perm(word,gens)
        t=count(x->p[x]!=x,CONPOS); t==0 && return
        c=M.htm(word); old=get(lib,p,nothing)
        (isnothing(old)||c<old[2]) && (lib[p]=(word,c))
    end
    comms=Vector{Int}[]
    for x in B,y in B; axis(x)==axis(y) && continue; push!(comms,vcat(x,y,inv(x),inv(y))); end
    S=[w for w in B if length(unique(abs.(w)))==1]
    for x in S; add!(x); end
    for x in S,y in S; abs(x[1])==abs(y[1]) && continue; add!(vcat(x,y)); end
    for x in S,y in S,z in S
        (abs(x[1])==abs(y[1]) || abs(y[1])==abs(z[1])) && continue; add!(vcat(x,y,z))
    end
    mids=Vector{Int}[]
    for ax in 1:3
        m=vcat(7ax,[-(7(ax-1)+s) for s in 1:6]); push!(mids,m); push!(mids,inv(m)); push!(mids,vcat(m,m))
    end
    for x in mids,y in B
        div(abs(y[1])-1,7)+1==div(abs(x[1])-1,7)+1 && continue
        push!(comms,vcat(x,y,inv(x),inv(y))); push!(comms,vcat(y,x,inv(y),inv(x)))
    end
    for c in comms; add!(c); end
    for c in comms,s in B; add!(vcat(s,c,inv(s))); end
    for c in comms,s1 in freefront,s2 in freefront
        abs(s1[1])==abs(s2[1]) && continue
        add!(vcat(s1,s2,c,inv(s2),inv(s1)))
    end
    macs=Mac[]
    for (p,(w,c)) in lib
        winv=UInt16.(invperm(Int.(p))); cs=[x for x in CONPOS if p[x]!=x]
        push!(macs,Mac(cs,Int.(winv[cs]),w,c,winv))
    end
    sort!(macs;by=m->(m.cost,m.word)); macs
end
t0=time(); const MACS=build_library(); println("library kept=",length(MACS)," built in ",round(time()-t0;digits=1),"s"); flush(stdout)
# ---------------- one edge ----------------
struct Node; occ::Vector{UInt16}; cost::Int; un::Int; wu::Float64; word::Vector{Int}; end
function edge_search(start,target;lambda=LAMBDA0,width=WIDTH0,maxdepth=60,patience=8,nsol=1,minprog=1,verbose=true)
    @assert conpos_for(target)==CONPOS
    prefix=P.chain_core_prefix(source,start,target,action)
    ALLOWED=falses(264,264)
    for k in 1:11, (idx,set) in P.macro_front_constraints(source,target,action,k)
        x=24(k-1)+idx
        if k==11
            # core/center orbit: macro_front_constraints can allow two center orientations of a glyph
            # that validate_front distinguishes; keep exactly the image-checked one from chain_core_prefix
            o=P.invert(prefix.state)[x]; @assert o in set; ALLOWED[Int(o),x]=true
            dec=P.decode_physical(source,prefix.state,action)
            s0=only(filter(s->s.pos==(0,0,3)&&s.normal==P.FRONT_NORMAL,dec))
            q=findfirst(==(s0.up),P.IMAGE_UPS)-1
            @assert P.image_normal(s0.text,q,s0.ink)==P.image_normal(target.board[4,4][1],0,target.board[4,4][2]) "core prefix center mismatch"
        else
            for o in set; ALLOWED[Int(o),x]=true; end
        end
    end
    wun(occ)=sum(x->ALLOWED[Int(occ[x]),x] ? 0.0 : W[x],CONPOS)
    unsat(occ)=count(x->!ALLOWED[Int(occ[x]),x],CONPOS)
    occ0=UInt16.(P.invert(prefix.state))
    beam=[Node(occ0,M.htm(prefix.word),unsat(occ0),wun(occ0),copy(prefix.word))]
    u0=beam[1].un
    sols=Node[]; seen=Set{UInt64}([hash(occ0)]); snaps=Dict{Int,Node}(); lastimp=0; bestun=beam[1].un
    beam[1].un==0 && return (sols=[beam[1]],snaps=snaps,u0=u0)
    worst()=length(sols)<nsol ? typemax(Int) : maximum(s.cost for s in sols)
    for depth in 1:maxdepth
        cands=Tuple{Float64,Int32,Int32,Int16,Float64}[]
        for (ni,n) in enumerate(beam)
            local_c=Tuple{Float64,Int32,Int32,Int16,Float64}[]
            for (mi,m) in enumerate(MACS)
                d=0; dw=0.0
                @inbounds for j in eachindex(m.cs)
                    p=m.cs[j]
                    e=ALLOWED[Int(n.occ[m.src[j]]),p]-ALLOWED[Int(n.occ[p]),p]
                    d+=e; dw+=e*W[p]
                end
                (minprog==1 ? dw<=1e-9 : dw< -1e-9) && continue
                push!(local_c,(lambda*(n.wu-dw)+n.cost+m.cost,ni,mi,n.un-d,n.wu-dw))
            end
            k=min(length(local_c),4width)
            k>0 && append!(cands,partialsort!(local_c,1:k;by=first))
        end
        sort!(cands;by=first)
        newbeam=Node[]
        for (score,ni,mi,nu,nw) in cands
            length(newbeam)>=width && break
            n=beam[ni]; m=MACS[mi]
            occ=n.occ[m.winv]; h=hash(occ); h in seen && continue; push!(seen,h)
            w=M.simplify(vcat(n.word,m.word),a); node=Node(occ,M.htm(w),nu,nw,w)
            if nu==0
                if node.cost<worst(); push!(sols,node); sort!(sols;by=s->s.cost); length(sols)>nsol && pop!(sols); end
                continue
            end
            node.cost>=worst() && continue
            (!haskey(snaps,nu) || node.cost<snaps[nu].cost) && (snaps[nu]=node)
            push!(newbeam,node)
        end
        verbose && (println("  depth ",depth," min_unsat=",isempty(newbeam) ? "-" : minimum(n.un for n in newbeam),
            " min_cost=",isempty(newbeam) ? "-" : minimum(n.cost for n in newbeam)," best=",isempty(sols) ? "-" : sols[1].cost); flush(stdout))
        isempty(newbeam) && break
        beam=newbeam
        mu=minimum(n.un for n in newbeam)
        if mu<bestun; bestun=mu; lastimp=depth; end
        depth-lastimp>=patience && break
    end
    (sols=sols,snaps=snaps,u0=u0)
end

const CACHE=Ref{Any}(nothing)
function finish(start,target,node)   # hybrid fallback with the existing orbit solver
    isnothing(CACHE[]) && (CACHE[]=M.cached_catalogues(action,a;relax_budget=60000))
    st=P.compose(start,P.macro_word_perm(node.word,gens)); word=copy(node.word)
    for k in 1:10
        constraints=P.macro_front_constraints(source,target,action,k)
        occ=Tuple(P.invert(st)[(24k-23):24k])
        all(occ[i] in s for (i,s) in constraints) && continue
        sel=M.orbit_search(occ,constraints,CACHE[][k],a;width=8,budget=150000,weight=2)
        isnothing(sel) && return nothing
        st=P.compose(st,P.macro_word_perm(sel,gens)); append!(word,sel)
    end
    word
end
function accept(start,target,word)   # validate; returns (word,state) or nothing
    w=M.improve_word(word,a)
    @assert all(g->1<=abs(g)<=21,w)
    st=P.compose(start,P.macro_word_perm(w,gens))
    try P.validate_front(P.decode_physical(source,st,action),target) catch e; println("  VALIDATION FAILED: ",e); return nothing end
    (word=w,state=st)
end
function solve_edge(start,y,m;nsol=1)
    target=calendar_target(y,m)
    settings=[(LAMBDA0,WIDTH0,1),(8.0,30,1),(12.0,60,1),(12.0,40,0)]
    for (lam,wid,mp) in settings
        r=edge_search(start,target;lambda=lam,width=wid,nsol=nsol,minprog=mp)
        out=[]
        for s in r.sols; v=accept(start,target,s.word); isnothing(v) || push!(out,v); end
        if !isempty(out)
            return (list=out,how="global l=$lam w=$wid mp=$mp",u0=r.u0)
        end
        println("  no global solution with l=$lam w=$wid mp=$mp; trying hybrid finish")
        for u in sort!(collect(keys(r.snaps)))[1:min(4,length(r.snaps))]
            w=finish(start,target,r.snaps[u]); isnothing(w) && continue
            v=accept(start,target,w); isnothing(v) || push!(out,v)
        end
        if !isempty(out)
            sort!(out;by=v->M.htm(v.word))
            return (list=out,how="hybrid l=$lam w=$wid mp=$mp",u0=r.u0)
        end
        println("  EDGE $y-$m FAILED with l=$lam w=$wid mp=$mp")
    end
    if VARIANT=="orbitfb"
        # Fallback motivated by the logs (variant orbitfb): when every setting and the
        # hybrid finish fail, run the planner orbit-by-orbit solve from the start state.
        o=orbit_solve(P,source,start,target,action,P.chain_catalogues(action))
        if !isnothing(o)
            v=accept(start,target,o.word)
            isnothing(v) || return (list=[v],how="orbit-solve fallback",u0=-1)
        end
    end
    error("edge $y-$m failed with all settings")
end
# ---------------- driver: continue the retained state ----------------
hash0=HASH0;words=Vector{Int}[];hashes=Tuple{String,String}[];newedges=Any[]
open(OUTP*"-edges.tsv","w") do io
    println(io,"from\tto\tmethod\thtm\tseconds")
end
for (y,m) in EDGES
    global state
    t=time();println("EDGE $y-$m");flush(stdout)
    r=solve_edge(state,y,m);v=r.list[1]
    before=digest(state);state=v.state;after=digest(state)
    push!(words,v.word);push!(hashes,(before,after));push!(newedges,(;year=y,month=m))
    py,pm=m==1 ? (y-1,12) : (y,m-1)
    open(OUTP*"-edges.tsv","a") do io
        println(io,"$py-$pm",'\t',"$y-$m",'\t',r.how,'\t',M.htm(v.word),'\t',round(time()-t;digits=1))
    end
end
# cumulative chain: prior edge blocks verbatim, new blocks and the trailer from export_chain
tmp=OUTP*".new-blocks.tmp"
M.export_chain(tmp,(;root=ROOTID,year=SRCY,month=SRCM,hash=hash0,edges=newedges),words,action;hashes)
newlines=readlines(tmp); rm(tmp)
open(OUTP*".moves.tsv","w") do io
    println(io,"cubistry.calendar7.chain.v1")
    println(io,join(("source",ROOTID,SRCY,SRCM,hash0),'\t'))
    isempty(BLOCKS) || foreach(l->println(io,l),prior.lines[BLOCKS[1].first:BLOCKS[end].last])
    foreach(l->println(io,l),newlines[3:end])
end
println("CHAIN COMPLETE")
