#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED resumable producer (candidate generator only; pure_chain.jl and the Flix chain
# verifier decide) of consecutive month edges of the strict upright chain, one retained
# physical state. The edge solver is beam2.jl exactly as edge_batch.jl uses it (core
# protection, catalog macros, exact last mile, lambda=3), the fallback for an edge nobody
# finishes is the planner orbit solve (chain_smoke.jl). Run with threads: julia -t 4.
#   chain_segment.jl DAG PRINT ROOT_MOVES OUT_PREFIX EDGES START PRIOR_MOVES
#   EDGES        number of new month edges (stops early after 2099-12 or at the deadline)
#   START        YYYY-MM root month of a fresh chain (PRIOR_MOVES is "-"), or "resume" to
#                continue from the end of PRIOR_MOVES (a cumulative chain file)
#   env CHAIN_DEADLINE_SECONDS (optional): no new edge is started once this many seconds
#                have passed since the start of the edge loop; the segment is then shorter
#                than EDGES (a later segment continues from its end).
# Writes OUT_PREFIX.moves.tsv (cumulative: prior edge blocks copied verbatim, then the new
# blocks) and OUT_PREFIX-edges.tsv (header plus the new edges only). Exits non-zero (and
# writes no moves file) when the prior chain does not replay or an edge cannot be produced.
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"pure-split-states","orbit_solve.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)
include(joinpath(HERE,"beam2.jl"))
struct Block;year::Int;month::Int;sh::String;eh::String;moves::Vector{Tuple{Int,Int}};first::Int;last::Int;end
function read_prior(path)
    L=readlines(path)
    @assert length(L)>=4 && L[1]=="cubistry.calendar7.chain.v1" && L[end]=="finish" "prior chain: bad header or trailer"
    f=split(L[2],'\t');@assert length(f)==5 && f[1]=="source" "prior chain: bad source line"
    blocks=Block[];i=3
    while L[i]!="finish"
        f=split(L[i],'\t');@assert length(f)==9 && f[1]=="edge" "prior chain: bad edge line $i"
        j=i+1;mv=Tuple{Int,Int}[]
        while L[j]!="end"
            g=split(L[j],'\t');@assert length(g)==3 && g[1]=="move" "prior chain: bad move line $j"
            push!(mv,(parse(Int,g[2]),parse(Int,g[3])));j+=1
        end
        push!(blocks,Block(parse(Int,f[2]),parse(Int,f[3]),String(f[8]),String(f[9]),mv,i,j));i=j+1
    end
    (lines=L,blocks=blocks)
end
nextym(y,m)=m==12 ? (y+1,1) : (y,m+1)
function main(dag,print_path,moves_path,outp,nedges,startarg,priorpath)
    @assert nedges>=1 "EDGES must be positive"
    goals=stacked_goals(PURE_VARIANT)
    idof=Dict(join(string.(g.board),"|")=>i for (i,g) in enumerate(goals))
    proof=G.P.replay_dag(dag);action=proof.action;a=G.M.Algebra(action)
    gens=[UInt16.(g) for g in action.generators]
    source=G.P.read_physical(print_path)
    digest(st)=G.P.state_digest(G.P.decode_physical(source,st,action))
    rows=Dict(parse(Int,split(l,'\t')[1])=>split(l,'\t') for l in readlines(moves_path)[2:end] if !isempty(l))
    target_of(y,m)=(id=idof[join(string.(stacked_board(y,m,PURE_VARIANT)),"|")];(year=y,month=m,board=goals[id].board))
    # ---- start: a root word, or the end of the prior cumulative chain ----
    if startarg=="resume"
        @assert priorpath!="-" "resume needs PRIOR_MOVES"
        prior=read_prior(priorpath);sf=split(prior.lines[2],'\t')
        rootid=parse(Int,sf[2]);sy=parse(Int,sf[3]);sm=parse(Int,sf[4]);hash0=String(sf[5]);blocks=prior.blocks
    else
        @assert priorpath=="-" "a fresh chain needs PRIOR_MOVES to be -"
        mt=match(r"^(\d{4})-(\d{1,2})$",startarg);@assert !isnothing(mt) "START must be YYYY-MM or resume"
        sy=parse(Int,mt[1]);sm=parse(Int,mt[2]);@assert 2026<=sy<=2099 && 1<=sm<=12 "START out of range"
        rootid=idof[join(string.(stacked_board(sy,sm,PURE_VARIANT)),"|")];hash0="";prior=nothing;blocks=Block[]
    end
    rootrow=rows[rootid]
    state=G.P.macro_word_perm(parse.(Int,split(rootrow[6],',')),gens)
    isempty(hash0) ? (hash0=digest(state)) : @assert digest(state)==hash0 "prior chain source hash differs from the root word state"
    G.P.validate_front(G.P.decode_physical(source,state,action),target_of(sy,sm))
    lastym=(sy,sm)
    for (i,b) in enumerate(blocks)
        lastym=nextym(lastym...);@assert (b.year,b.month)==lastym "prior chain not chronological at edge $i"
        @assert digest(state)==b.sh "replay: source digest mismatch at prior edge $i"
        for (g,q) in b.moves,_ in 1:mod(q,4);state=G.P.compose(state,gens[g]);end
        @assert digest(state)==b.eh "replay: end digest mismatch at prior edge $i"
        G.P.validate_front(G.P.decode_physical(source,state,action),target_of(b.year,b.month))
    end
    println("replayed ",length(blocks)," prior edges; chain end ",lastym[1],"-",lastym[2],"; state digest ",digest(state));flush(stdout)
    months=let (y,m)=lastym,e=Tuple{Int,Int}[]
        while length(e)<nedges && (y,m)<(2099,12);y,m=nextym(y,m);push!(e,(y,m));end
        e
    end
    isempty(months) && println("chain already ends at 2099-12; no new edges")
    # ---- solver setup (as edge_batch.jl) ----
    t0=time()
    params0,spec,_=G.parse_options(["lambda=3"]);w=copy(params0.orbit_weights);w[11]=100.0
    params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=params0.strict,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
    lib=G.build_library(action,a,spec);catalogs=G.P.chain_catalogues(action)
    lib=merge_macros(lib,catalog_macros(catalogs,action,gens))
    index=build_index(lib);cats=orbit_cats(catalogs,gens)
    println("setup ",round(time()-t0;digits=1)," s, library ",length(lib)," threads ",Threads.nthreads());flush(stdout)
    deadline=parse(Float64,get(ENV,"CHAIN_DEADLINE_SECONDS","Inf"))
    words=Vector{Int}[];hashes=Tuple{String,String}[];newedges=Any[];loop0=time()
    open(outp*"-edges.tsv","w") do io;println(io,"from\tto\tmethod\thtm\tseconds");end
    for (y,m) in months
        if time()-loop0>deadline
            println("deadline reached after ",length(words)," edges; stopping before ",y,"-",m);flush(stdout);break
        end
        t=time();target=target_of(y,m)
        r=solve_edge(source,state,target,action,a,gens,lib,index,cats,params;finish_depth=3,nsnap=6,tight=true,finish=true)
        method=r.method;word=r.word;st=r.state
        if isnothing(word)
            println("  edge ",y,"-",m," not finished by the beam (",r.status,"); planner orbit solve fallback");flush(stdout)
            o=orbit_solve(G.P,source,state,target,action,catalogs)
            isnothing(o) && error("edge $y-$m failed: beam and orbit-solve fallback found nothing")
            word=G.M.improve_word(o.word,a);st=G.P.compose(state,G.P.macro_word_perm(word,gens));method="orbit"
        end
        G.P.validate_front(G.P.decode_physical(source,st,action),target)
        before=digest(state);state=st
        push!(words,word);push!(hashes,(before,digest(state)));push!(newedges,(;year=y,month=m))
        py,pm=m==1 ? (y-1,12) : (y,m-1)
        dt=round(time()-t;digits=1)
        open(outp*"-edges.tsv","a") do io;println(io,"$py-$pm\t$y-$m\t$method\t",G.M.htm(word),'\t',dt);end
        println("EDGE ",y,"-",m," ",method," htm=",G.M.htm(word)," ",dt," s");flush(stdout)
    end
    # ---- cumulative chain: prior edge blocks verbatim, then the new blocks ----
    tmp=outp*".new-blocks.tmp"
    G.M.export_chain(tmp,(;root=rootid,year=sy,month=sm,hash=hash0,edges=newedges),words,action;hashes)
    newlines=readlines(tmp);rm(tmp)
    open(outp*".moves.tsv","w") do io
        println(io,"cubistry.calendar7.chain.v1")
        println(io,join(("source",rootid,sy,sm,hash0),'\t'))
        isempty(blocks) || foreach(l->println(io,l),prior.lines[blocks[1].first:blocks[end].last])
        foreach(l->println(io,l),newlines[3:end])
    end
    println("CHAIN COMPLETE ",length(blocks)+length(words)," edges")
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==7 "usage: DAG PRINT ROOT_MOVES OUT_PREFIX EDGES START(YYYY-MM|resume) PRIOR_MOVES(path|-)"
    main(ARGS[1],ARGS[2],ARGS[3],ARGS[4],parse(Int,ARGS[5]),ARGS[6],ARGS[7])
end
