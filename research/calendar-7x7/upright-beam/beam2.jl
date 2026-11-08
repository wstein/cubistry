# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate tooling (verify_edges.jl decides). Fixes for the global beam search
# under the strict upright rule. Included after global-search/search.jl (module G).
#
# Root cause (see README): the beam counts a front cell as satisfied when its occupant
# lies in the cell's allowed set, treating the 49 cells as independent. Under the strict
# rule most allowed sets have one element and the print supply has no slack, so a
# "flexible" cell (blank, or a glyph with several equal stickers) is easily filled with
# a piece that another cell can only get from there. Tightening = all-different
# filtering (Regin): drop (cell,pose) pairs that occur in no complete assignment of the
# orbit's cells to distinct poses. It is lossless (every solution is a complete
# assignment) and makes the heuristic see the scarce pieces.

"All-different filtering of one Problem: returns a Problem with the same constrained
cells and a (not larger) allowed matrix; throws if some orbit has no complete matching."
function tighten(pr::G.Problem)
    allowed=falses(size(pr.allowed));kept=0;dropped=0
    for k in 1:11
        cells=[x for x in pr.constrained if div(x-1,24)+1==k]
        isempty(cells) && continue
        poses=collect((24k-23):24k);nc=length(cells)
        adj=[[j for (j,o) in enumerate(poses) if pr.allowed[o,x]] for x in cells]
        matchp=zeros(Int,24);matchc=zeros(Int,nc)   # pose->cell, cell->pose
        function aug(i,seen)
            for j in adj[i]
                seen[j] && continue;seen[j]=true
                if matchp[j]==0 || aug(matchp[j],seen);matchp[j]=i;matchc[i]=j;return true;end
            end
            false
        end
        for i in 1:nc;aug(i,falses(24)) || error("orbit $k: no complete assignment of cells to distinct poses");end
        # digraph nodes: cells 1..nc, poses nc+1..nc+24. matched: cell->pose; unmatched: pose->cell
        n=nc+24;out=[Int[] for _ in 1:n]
        for i in 1:nc,j in adj[i]
            matchc[i]==j ? push!(out[i],nc+j) : push!(out[nc+j],i)
        end
        # reachable from free poses
        reach=falses(n);stack=Int[]
        for j in 1:24;matchp[j]==0 && (reach[nc+j]=true;push!(stack,nc+j));end
        while !isempty(stack);u=pop!(stack);for v in out[u];reach[v] || (reach[v]=true;push!(stack,v));end;end
        # Tarjan SCC
        index=zeros(Int,n);low=zeros(Int,n);onst=falses(n);comp=zeros(Int,n);st=Int[];idx=0;nco=0
        function strong(v)
            idx+=1;index[v]=low[v]=idx;push!(st,v);onst[v]=true
            for w in out[v]
                if index[w]==0;strong(w);low[v]=min(low[v],low[w])
                elseif onst[w];low[v]=min(low[v],index[w]);end
            end
            if low[v]==index[v]
                nco+=1
                while true;w=pop!(st);onst[w]=false;comp[w]=nco;w==v && break;end
            end
        end
        for v in 1:n;index[v]==0 && strong(v);end
        for i in 1:nc,j in adj[i]
            ok=matchc[i]==j || reach[nc+j] || comp[i]==comp[nc+j]
            if ok;allowed[poses[j],cells[i]]=true;kept+=1;else dropped+=1;end
        end
    end
    (G.Problem(allowed,pr.constrained,pr.weight),kept,dropped)
end

"Problem with the tightened allowed sets and the given weight of the core orbit (11)."
function strict_problem(source,target,action,orbit_weights;tight=true)
    pr=G.Problem(source,target,action,orbit_weights)
    tight || return (pr,0)
    pr2,kept,dropped=tighten(pr)
    (pr2,dropped)
end

# ---------------------------------------------------------------------------
# Indexed beam: same search as G.beam_search (strict mode), but a node only looks at
# macros that move an allowed piece into a currently wrong front cell. A macro with
# strictly positive weighted progress must do that, so the child pool is identical.

struct MacroIndex
    ptr::Vector{Int32}      # CSR over keys (x-1)*264+from
    ids::Vector{Int32}
end
function build_index(library::Vector{G.Macro})
    counts=zeros(Int32,264*264+1)
    for m in library,j in eachindex(m.fmoved)
        counts[(Int(m.fmoved[j])-1)*264+Int(m.ffrom[j])+1]+=1
    end
    ptr=Vector{Int32}(undef,length(counts));ptr[1]=1
    for i in 2:length(counts);ptr[i]=ptr[i-1]+counts[i];end
    fill_at=copy(ptr);ids=Vector{Int32}(undef,Int(ptr[end])-1)
    for (mi,m) in enumerate(library),j in eachindex(m.fmoved)
        key=(Int(m.fmoved[j])-1)*264+Int(m.ffrom[j])
        ids[fill_at[key]]=mi;fill_at[key]+=1
    end
    MacroIndex(ptr,ids)
end

function candidates!(out::Vector{Int32},stamp::Vector{Int32},tick::Int32,pr::G.Problem,occ,index::MacroIndex)
    empty!(out)
    posof=zeros(Int,264);for x in 1:264;posof[Int(occ[x])]=x;end
    for x in pr.constrained
        G.satisfied(pr,occ,x) && continue
        for o in 1:264
            pr.allowed[o,x] || continue
            y=posof[o];key=(x-1)*264+y
            for t in index.ptr[key]:(index.ptr[key+1]-1)
                mi=index.ids[t]
                stamp[mi]==tick && continue
                stamp[mi]=tick;push!(out,mi)
            end
        end
    end
    out
end

function beam_fast(state,word0,pr::G.Problem,library::Vector{G.Macro},index::MacroIndex,a,params::G.Params;log=devnull)
    @assert params.strict "indexed beam implements the strict mode only"
    occ0=G.occupants(state)
    root=G.Node(occ0,copy(word0),G.M.htm(word0),G.unsat(pr,occ0),G.weighted_unsat(pr,occ0))
    root.unsat==0 && return (;status=:solved,best=root,snapshots=Dict(0=>root),trace=NamedTuple[],stall=Int[])
    beam=[root];best=nothing;seen=Set{Vector{UInt16}}([occ0])
    snapshots=Dict{Int,G.Node}();trace=NamedTuple[]
    bestunsat=root.unsat;lastimprovement=0;status=:maxdepth;stall=Int[]
    eps=1e-9;nt=Threads.maxthreadid()
    stamps=[zeros(Int32,length(library)) for _ in 1:nt];ticks=zeros(Int32,nt);cands=[Int32[] for _ in 1:nt]
    for depth in 1:params.maxdepth
        locals=Vector{Vector{Tuple{Float64,Int,Int,Int,Float64}}}(undef,length(beam))
        Threads.@threads :static for ni in eachindex(beam)
            n=beam[ni];tid=Threads.threadid()
            local_pool=Tuple{Float64,Int,Int,Int,Float64}[]
            ticks[tid]+=Int32(1)
            candidates!(cands[tid],stamps[tid],ticks[tid],pr,n.occ,index)
            for mi in cands[tid]
                m=library[mi]
                d,dw=G.progress(pr,n.occ,m)
                dw<=eps && continue
                nw=n.wunsat-dw
                push!(local_pool,(params.lambda*nw+n.cost+m.cost,ni,Int(mi),n.unsat-d,nw))
            end
            k=min(length(local_pool),params.fanout*params.width)
            k>0 && partialsort!(local_pool,1:k)
            locals[ni]=k>0 ? local_pool[1:k] : empty(local_pool)
        end
        pool=Tuple{Float64,Int,Int,Int,Float64}[]
        for l in locals;append!(pool,l);end
        sort!(pool)
        next=G.Node[]
        for (_,ni,mi,nu,nw) in pool
            length(next)>=params.width && break
            n=beam[ni];m=library[mi]
            occ=G.apply(n.occ,m)
            occ in seen && continue
            push!(seen,occ)
            word=G.M.simplify(vcat(n.word,m.word),a)
            node=G.Node(occ,word,G.M.htm(word),nu,nw)
            if nu==0
                if isnothing(best) || (node.cost,node.word)<(best.cost,best.word);best=node;end
                continue
            end
            params.prune_incumbent && !isnothing(best) && node.cost>=best.cost && continue
            if !haskey(snapshots,nu) || (node.cost,node.word)<(snapshots[nu].cost,snapshots[nu].word)
                snapshots[nu]=node
            end
            push!(next,node)
        end
        push!(trace,(;depth,beam=length(next),min_unsat=isempty(next) ? -1 : minimum(n.unsat for n in next),
            min_cost=isempty(next) ? -1 : minimum(n.cost for n in next),best=isnothing(best) ? -1 : best.cost))
        if isempty(next)
            status=isnothing(best) ? :stalled : :solved
            isnothing(best) && (stall=[x for x in pr.constrained if !G.satisfied(pr,beam[1].occ,x)])
            break
        end
        beam=next
        current=minimum(n.unsat for n in next)
        if current<bestunsat;bestunsat=current;lastimprovement=depth
        elseif depth-lastimprovement>=params.patience;status=isnothing(best) ? :patience : :solved;break;end
        depth==params.maxdepth && !isnothing(best) && (status=:solved)
    end
    (;status,best,snapshots,trace,stall)
end

# ---------------------------------------------------------------------------
# Orbit-isolated catalog macros as beam macros. The planner catalogs (chain_catalogues)
# hold, per orbit 1..10, every permutation of that orbit's 24 poses reachable by a
# conjugated commutator, as a legal word that moves NO pose of any other orbit. They
# are the last-mile tool: they fix a residual cell without touching the 48 other
# cells, the core included.

function make_macro(word,p,isfront)
    back=invperm(Int.(p))
    moved=Int16[x for x in 1:264 if back[x]!=x]
    fmoved=Int16[x for x in moved if isfront[x]]
    G.Macro(word,G.M.htm(word),moved,Int16.(back[moved]),fmoved,Int16.(back[fmoved]))
end

"Catalog macros (orbits 1..10) that move at least one front position, as G.Macro."
function catalog_macros(catalogs,action,gens)
    front=G.front_positions(action);isfront=falses(264);isfront[front].=true
    out=G.Macro[]
    for k in sort!(collect(keys(catalogs)))
        for (key,w) in sort!(collect(catalogs[k]);by=x->(G.M.htm(x[2]),x[2]))
            word=G.P.macro_normalize(w)
            p=G.P.macro_word_perm(word,gens)
            any(x->p[x]!=x,front) || continue
            push!(out,make_macro(word,p,isfront))
        end
    end
    out
end

"Merge macro lists, one macro per permutation (cheapest, then first)."
function merge_macros(lists...)
    best=Dict{Tuple{Vector{Int16},Vector{Int16}},G.Macro}()
    for l in lists,m in l
        key=(m.moved,m.from);old=get(best,key,nothing)
        (isnothing(old) || m.cost<old.cost) && (best[key]=m)
    end
    out=collect(values(best));sort!(out;by=m->(m.cost,m.word));out
end

# ---------------------------------------------------------------------------
# Last mile: exact search with orbit-isolated catalog macros, orbit by orbit. Orbits are
# independent here (a catalog macro of orbit k moves no pose of another orbit), so the
# residue of every orbit is solved on its own with 1, 2 or (relevant macros only) 3
# macros; the cheapest sequence is kept. This also covers the plateaus the beam cannot
# cross (e.g. a corner that holds the right cubie in the wrong twist needs two macros).

struct OrbitCat
    inv::Vector{Vector{Int8}}     # local inverse permutations (occ -> occ[inv])
    words::Vector{Vector{Int}}
    cost::Vector{Int}
    perm::Vector{Vector{UInt16}}  # full 264-permutations (to replay on the state)
end
function orbit_cats(catalogs,gens)
    out=Dict{Int,OrbitCat}()
    for k in sort!(collect(keys(catalogs)))
        items=sort!(collect(catalogs[k]);by=x->(G.M.htm(G.P.macro_normalize(x[2])),x[2]))
        inv=Vector{Vector{Int8}}();words=Vector{Vector{Int}}();cost=Int[];perm=Vector{Vector{UInt16}}()
        for (key,w) in items
            word=G.P.macro_normalize(w)
            push!(inv,Int8.(invperm(Int.(collect(key)))));push!(words,word);push!(cost,G.M.htm(word))
            push!(perm,G.P.macro_word_perm(word,gens))
        end
        out[k]=OrbitCat(inv,words,cost,perm)
    end
    out
end

"Cheapest macro sequence (indices into `cat`, at most `maxdepth`) that satisfies all cells of orbit k, or nothing."
function finish_orbit(occ,pr::G.Problem,k,cat::OrbitCat;maxdepth=3,budget=40_000_000)
    base=24k-24
    cells=[x-base for x in pr.constrained if div(x-1,24)+1==k]
    allowed=[Bool[pr.allowed[base+o,base+c] for o in 1:24] for c in cells]
    v0=Int[Int(occ[base+i])-base for i in 1:24]
    sat(v)=all(allowed[i][v[cells[i]]] for i in eachindex(cells))
    sat(v0) && return Int[]
    n=length(cat.inv);bestcost=typemax(Int);best=nothing
    # relevant positions: the cells and the positions currently holding allowed poses
    rel=Set{Int}(cells)
    for i in eachindex(cells),p in 1:24;allowed[i][v0[p]] && push!(rel,p);end
    ops=0
    for i1 in 1:n
        c1=cat.cost[i1];c1>=bestcost && continue
        v1=v0[cat.inv[i1]]
        if sat(v1);bestcost=c1;best=[i1];continue;end
        maxdepth>=2 || continue
        for i2 in 1:n
            c2=c1+cat.cost[i2];c2>=bestcost && continue
            v2=v1[cat.inv[i2]];ops+=1
            if sat(v2);bestcost=c2;best=[i1,i2];continue;end
            maxdepth>=3 || continue
            # depth 3 only with a macro that touches a relevant position
            any(p->cat.inv[i2][p]!=p && p in rel,1:24) || continue
            for i3 in 1:n
                c3=c2+cat.cost[i3];c3>=bestcost && continue
                ops+=1;ops>budget && return best
                sat(v2[cat.inv[i3]]) && (bestcost=c3;best=[i1,i2,i3])
            end
        end
    end
    best
end

"Finish a beam node: solve every orbit with wrong cells. Returns (word, state) or nothing."
function finish_node(state,pr,cats::Dict{Int,OrbitCat},gens;maxdepth=3)
    word=Int[];st=state
    for k in 1:10
        occ=G.occupants(st)
        any(x->div(x-1,24)+1==k && !G.satisfied(pr,occ,x),pr.constrained) || continue
        seq=finish_orbit(occ,pr,k,cats[k];maxdepth)
        isnothing(seq) && return nothing
        for i in seq
            word=vcat(word,cats[k].words[i]);st=G.P.compose(st,cats[k].perm[i])
        end
    end
    occ=G.occupants(st)
    (G.unsat(pr,occ)==0 && all(x->G.satisfied(pr,occ,x),pr.constrained)) || return nothing
    (word,st)
end

"""
Solve one edge from `start` (full state) to `target`: core frame prefix, tightened
problem (core protected by weight), indexed beam over the library with catalog macros,
then the exact last mile on the cheapest snapshots. Returns (word,state,htm,method,
status,unsat0) or word==nothing.
"""
function solve_edge(source,start,target,action,a,gens,lib,index,cats,params;finish_depth=3,nsnap=6,tight=true,finish=true)
    prefix=G.P.chain_core_prefix(source,start,target,action)
    pr,_=strict_problem(source,target,action,params.orbit_weights;tight)
    res=beam_fast(prefix.state,prefix.word,pr,lib,index,a,params)
    cands=Tuple{Vector{Int},String}[]
    isnothing(res.best) || push!(cands,(G.M.improve_word(res.best.word,a),"beam"))
    for u in (finish ? first(sort!(collect(keys(res.snapshots))),nsnap) : Int[])
        n=res.snapshots[u];st=G.P.compose(start,G.P.macro_word_perm(n.word,gens))
        f=finish_node(st,pr,cats,gens;maxdepth=finish_depth)
        isnothing(f) && continue
        push!(cands,(G.M.improve_word(vcat(n.word,f[1]),a),"finish$(u)"))
    end
    good=Tuple{Vector{Int},String}[]
    for (w,m) in cands
        st=G.P.compose(start,G.P.macro_word_perm(w,gens))
        try G.P.validate_front(G.P.decode_physical(source,st,action),target);push!(good,(w,m)) catch end
    end
    isempty(good) && return (;word=nothing,state=nothing,htm=-1,method="none",status=res.status,stall=res.stall)
    sort!(good;by=x->(G.M.htm(x[1]),x[2]))
    w,m=first(good)
    (;word=w,state=G.P.compose(start,G.P.macro_word_perm(w,gens)),htm=G.M.htm(w),method=m,status=res.status,stall=res.stall)
end
