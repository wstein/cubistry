#!/usr/bin/env julia
# UNTRUSTED producer (candidate generator only) for the pilot year: an adaptation of
# PR #130's hand-refined experimental producer
# (../../global-search/evidence/chain-2026-2028/producer-run.jl). The library, the beam
# edge search, the hybrid finish (minimax orbit search from the best partial beam
# snapshots), the acceptance check and the setting schedule are copied unchanged; only
# the print, the displays, the DAG, the start state (December 2026 root) and the edge
# list (the 12 months of 2027) are parameters; British spellings in copied
# comments and one assertion message are changed to US spelling. Chains still need both
# chain verifiers.
# Usage: producer.jl DAG PRINT LAYOUT OUT_PREFIX [variant]
#   LAYOUT: pr99 | pure ; variant: base (PR #130 schedule) | orbitfb (base plus the planner
#   orbit solve when every setting and the hybrid finish fail)
include(joinpath(@__DIR__,"..","pure_common.jl"))
include(joinpath(@__DIR__,"..","..","minimax","search.jl"))
include(joinpath(@__DIR__,"..","orbit_solve.jl"))
const M=Minimax; const P=M.P
const DAG=ARGS[1]; const PRINT=ARGS[2]; const LAYOUT=ARGS[3]; const OUTP=ARGS[4]
const VARIANT=length(ARGS)>=5 ? ARGS[5] : "base"
@assert VARIANT in ("base","orbitfb") "variant must be base or orbitfb"
const LAYOUT_VARIANT=LAYOUT=="pr99" ? "F31=keep,S30=keep,S31=keep" : LAYOUT=="pure" ? PURE_VARIANT : error("LAYOUT must be pr99 or pure")
calendar_target(y,m)=(year=y,month=m,board=stacked_board(y,m,LAYOUT_VARIANT))
const LAMBDA0=12.0; const WIDTH0=40
proof=P.replay_dag(DAG);const action=proof.action;const a=M.Algebra(action);const gens=a.generators
const source=P.read_physical(PRINT)
digest(st)=P.state_digest(P.decode_physical(source,st,action))
const OLDT=physical_targets("EN")
const IDX=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(OLDT))
const ROOT=IDX[join(string.(wrapped_board(2026,12)),"|")]
const ROOTSTATE=P.signed_perm(proof.registers,proof.targets[ROOT])
P.validate_front(P.decode_physical(source,ROOTSTATE,action),calendar_target(2026,12))
const EDGES=[(2027,m) for m in 1:12]
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
# ---------------- driver: one retained state from the December 2026 root ----------------
state=ROOTSTATE;hash0=digest(state);words=Vector{Int}[];hashes=Tuple{String,String}[];edges=Any[]
open(OUTP*"-edges.tsv","w") do io
    println(io,"# producer adapted from PR #130 producer-run.jl; layout=",LAYOUT," variant=",VARIANT)
    println(io,"from\tto\tmethod\thtm\tseconds")
end
for (y,m) in EDGES
    global state
    t=time();println("EDGE $y-$m");flush(stdout)
    r=solve_edge(state,y,m);v=r.list[1]
    before=digest(state);state=v.state;after=digest(state)
    push!(words,v.word);push!(hashes,(before,after));push!(edges,(;year=y,month=m))
    open(OUTP*"-edges.tsv","a") do io
        println(io,m==1 ? "2026-12" : "2027-$(m-1)",'\t',"$y-$m",'\t',r.how,'\t',M.htm(v.word),'\t',round(time()-t;digits=1))
    end
end
M.export_chain(OUTP*".moves.tsv",(;root=ROOT,year=2026,month=12,hash=hash0,edges),words,action;hashes)
println("CHAIN COMPLETE")
