# Candidate generator only. Every word must still be accepted by the unchanged
# native Julia and Flix chain verifiers before it can be called verified.
#
# Global macro beam search for one calendar transition (month edge). Unlike the
# orbit-by-orbit solver in ../minimax/search.jl, the beam ranks complete cube
# states over all 49 constrained front positions at once and lets macros have
# arbitrary side effects elsewhere. Three ideas distinguish it:
#
#   1. Don't-care progress: a macro is scored only by the front positions it
#      turns from wrong to right minus those it turns from right to wrong.
#      Positions that are currently wrong are free, so cheap three-move
#      insertions of type x y x' are admissible as long as no correct position
#      is lost.
#   2. Middle-slice commutators: a middle-slice quarter turn is not a legal
#      single move; it is expanded to a whole-cube rotation plus the inverse
#      quarter turns of the six noncentral layers on that axis (6 HTM).
#   3. Orbit weighting: wrong positions in orbits 4, 7 and 10 (middle row and
#      middle column of the front) are weighted higher so that the beam fixes
#      them while the front is still mostly free.
#
# The search is a deterministic heuristic. It provides no optimality,
# completeness or upper-bound guarantee.
module GlobalSearch

include(joinpath(@__DIR__,"..","minimax","algebra.jl"))
const M=Minimax
const P=M.P
const V=M.V

# ---------------------------------------------------------------------------
# Parameters

"Uniform weights for orbits 1..11 (orbit 11 is the core)."
const ORBIT_WEIGHTS_UNIFORM=ones(11)
"""
Weights calibrated on the single experiment edge Jan 2027 -> Feb 2027: the
orbit-by-orbit baseline HTM per wrong piece of each orbit, divided by 8
(baseline parts 29,54,57,73,26,25,71,24,30,67 HTM for 4,7,8,4,4,3,4,3,4,4 wrong
pieces; the core gets 8/8). Not a general cost model.
"""
const ORBIT_WEIGHTS_W1=[29/4,54/7,57/8,73/4,26/4,25/3,71/4,24/3,30/4,67/4,8.0]./8
"Weight 3 for the middle-row/column orbits 4, 7 and 10, otherwise 1."
const ORBIT_WEIGHTS_W2=[1,1,1,3,1,1,3,1,1,3,1.0]

"""
Beam parameters. Score of a child = `lambda` * (weighted wrong front positions)
+ HTM of the parent's normalized word + HTM of the macro.

- `width`: nodes kept per depth.
- `fanout`: each parent contributes at most `fanout*width` children to the pool.
- `maxdepth`: maximum number of macros appended after the core prefix.
- `patience`: stop after this many depths without a new minimum of wrong positions.
- `strict`: require strictly positive weighted progress per macro; otherwise
  weighted-neutral macros are allowed too.
- `prune_incumbent`: drop children whose normalized HTM is not below the best
  complete word found so far. This is a heuristic cut, not a lower bound: a later
  macro could cancel part of the word.
- `orbit_weights`: one weight per orbit 1..11.
"""
Base.@kwdef struct Params
    lambda::Float64=12.0
    width::Int=40
    fanout::Int=4
    maxdepth::Int=60
    patience::Int=8
    strict::Bool=true
    prune_incumbent::Bool=true
    orbit_weights::Vector{Float64}=copy(ORBIT_WEIGHTS_W1)
end

"""
Macro library recipe. Base blocks are single noncentral layer turns (q = 1, -1, 2)
and, with `blocks`, adjacent two-layer turns. Commutators [x,y] use base blocks on
different axes; with `middle_slices`, [m,y] and [y,m] for middle-slice turns m are
added. Each commutator is used plain, conjugated by one base block
(`conjugates`) and conjugated by two front-free single-layer setups
(`front_free_setups`). `plain_max` (0..3) adds all plain words of up to that many
single-layer turns. Macros that move none of the 49 front positions are useless
and dropped; `front_cap` drops macros moving more front positions. For each
permutation only the first cheapest word (HTM, enumeration order) is kept.
"""
Base.@kwdef struct LibrarySpec
    blocks::Bool=true
    middle_slices::Bool=true
    conjugates::Bool=true
    front_free_setups::Bool=true
    plain_max::Int=3
    front_cap::Int=49
end
"Experiment presets: L1 (commutators and setups), L4 (+ blocks, plain words <= 3), L5 (+ middle-slice commutators)."
function library_spec(name::Symbol)
    name==:L1 && return LibrarySpec(blocks=false,middle_slices=false,plain_max=0)
    name==:L4 && return LibrarySpec(middle_slices=false)
    name==:L5 && return LibrarySpec()
    throw(ArgumentError("unknown library preset $name"))
end

# ---------------------------------------------------------------------------
# Front constraints

"The 49 constrained front positions, as used by `macro_front_constraints`."
front_positions(action)=sort!([findfirst(p->p[1]==(c-4,4-r,3),action.points) for r in 1:7 for c in 1:7])

"""
`allowed[o,x]` is true when the piece pose `o` satisfies the target at position
`x`; `weight[x]` is the orbit weight of position `x`.
"""
struct Problem
    allowed::BitMatrix
    constrained::Vector{Int}
    weight::Vector{Float64}
end
function Problem(source,target,action,orbit_weights)
    @assert length(orbit_weights)==11 && all(>(0),orbit_weights)
    allowed=falses(264,264);constrained=Int[]
    for k in 1:11,(index,set) in P.macro_front_constraints(source,target,action,k)
        x=24(k-1)+index;push!(constrained,x)
        for o in set;allowed[Int(o),x]=true;end
    end
    sort!(constrained)
    @assert constrained==front_positions(action)
    Problem(allowed,constrained,[orbit_weights[div(x-1,24)+1] for x in 1:264])
end
satisfied(pr::Problem,occ,x)=pr.allowed[Int(occ[x]),x]
unsat(pr::Problem,occ)=count(x->!satisfied(pr,occ,x),pr.constrained)
weighted_unsat(pr::Problem,occ)=sum(x->satisfied(pr,occ,x) ? 0.0 : pr.weight[x],pr.constrained;init=0.0)
"Occupant vector of a state: `occ[x]` is the piece pose at position `x`."
occupants(state)=UInt16.(P.invert(state))

# ---------------------------------------------------------------------------
# Macro library

"""
A library macro. Applying it maps occupants `occ` to `occ[inverse]`; only the
positions in `moved` change, with `occ_new[moved[j]] = occ[from[j]]`. `fmoved` and
`ffrom` are the front-position subset used for scoring.
"""
struct Macro
    word::Vector{Int}
    cost::Int
    moved::Vector{Int16}
    from::Vector{Int16}
    fmoved::Vector{Int16}
    ffrom::Vector{Int16}
end
apply(occ,m::Macro)=(next=copy(occ);@inbounds for j in eachindex(m.moved);next[m.moved[j]]=occ[m.from[j]];end;next)

"""
Middle-slice quarter turn on `axis` (1..3), as a legal word: the whole-cube
rotation followed by inverse quarter turns of the six noncentral layers. Its
permutation equals `P.chain_alphabet(action).generators[21+axis]`.
"""
function middle_slice(action,axis)
    rotation=findfirst(==((axis,99)),action.moves)
    vcat(rotation,[-g for (g,(ax,layer)) in enumerate(action.moves) if ax==axis && layer!=99])
end
axis_of(action,word)=action.moves[abs(first(word))][1]

function base_blocks(action,spec)
    blocks=Vector{Int}[]
    layers=[g for (g,(_,layer)) in enumerate(action.moves) if layer!=99]
    @assert layers==[g for g in 1:21 if g%7!=0]
    for g in layers;push!(blocks,[g],[-g],[g,g]);end
    if spec.blocks
        # Adjacent noncentral layers: slots (1,2),(2,3) and (4,5),(5,6) on each axis.
        for ax in 0:2,(s1,s2) in ((1,2),(2,3),(4,5),(5,6)),sg in (1,-1),q in (1,2)
            push!(blocks,repeat([sg*(7ax+s1),sg*(7ax+s2)],q))
        end
    end
    blocks
end

"""
Build the macro library for `action`. The result depends only on the action and
the 49 front positions, not on the calendar target, so it can be reused across
edges. Library words are kept as enumerated (legal generators 1..21, including
the rotations inside middle-slice turns); complete beam words are normalized.
"""
function build_library(action,a::M.Algebra,spec::LibrarySpec=LibrarySpec();log=devnull)
    @assert 0<=spec.plain_max<=3 && 1<=spec.front_cap<=49
    gens=a.generators;front=front_positions(action)
    inv(w)=P.macro_inverse(w)
    perm(w)=P.macro_word_perm(w,gens)
    seq(ps...)=foldl(P.compose,ps)
    blocks=base_blocks(action,spec);bperm=Dict(w=>perm(w) for w in blocks)
    singles=[w for w in blocks if length(unique(abs.(w)))==1]
    lib=Dict{Vector{UInt16},Tuple{Int,Vector{Int}}}();tried=0
    function add!(word,p)
        tried+=1
        touched=count(x->p[x]!=x,front)
        (touched==0 || touched>spec.front_cap) && return
        # Raw-word HTM (adjacent equal generators merged), first word wins ties;
        # this matches the experiment. The beam normalizes complete words anyway.
        c=M.htm(word)
        old=get(lib,p,nothing)
        if isnothing(old) || c<first(old)
            lib[p]=(c,word)
        end
    end
    comms=Tuple{Vector{Int},Vector{UInt16}}[]
    for x in blocks,y in blocks
        axis_of(action,x)==axis_of(action,y) && continue
        push!(comms,(vcat(x,y,inv(x),inv(y)),seq(bperm[x],bperm[y],P.invert(bperm[x]),P.invert(bperm[y]))))
    end
    if spec.middle_slices
        for ax in 1:3
            m=middle_slice(action,ax)
            for mw in (m,inv(m),vcat(m,m))
                pm=perm(mw)
                for y in blocks
                    axis_of(action,y)==ax && continue
                    py=bperm[y]
                    push!(comms,(vcat(mw,y,inv(mw),inv(y)),seq(pm,py,P.invert(pm),P.invert(py))))
                    push!(comms,(vcat(y,mw,inv(y),inv(mw)),seq(py,pm,P.invert(py),P.invert(pm))))
                end
            end
        end
    end
    if spec.plain_max>=1
        for x in singles;add!(x,bperm[x]);end
    end
    if spec.plain_max>=2
        for x in singles,y in singles
            abs(x[1])==abs(y[1]) && continue
            add!(vcat(x,y),seq(bperm[x],bperm[y]))
        end
    end
    if spec.plain_max>=3
        for x in singles,y in singles,z in singles
            (abs(x[1])==abs(y[1]) || abs(y[1])==abs(z[1])) && continue
            add!(vcat(x,y,z),seq(bperm[x],bperm[y],bperm[z]))
        end
    end
    for (w,p) in comms;add!(w,p);end
    if spec.conjugates
        for (w,p) in comms,s in blocks
            add!(vcat(s,w,inv(s)),seq(bperm[s],p,P.invert(bperm[s])))
        end
    end
    if spec.front_free_setups
        # Single-layer setups that move no front piece (derived, not hard-coded).
        free=[s for s in singles if all(x->bperm[s][x]==x,front)]
        for (w,p) in comms,s1 in free,s2 in free
            abs(s1[1])==abs(s2[1]) && continue
            q=seq(bperm[s1],bperm[s2])
            add!(vcat(s1,s2,w,inv(s2),inv(s1)),seq(q,p,P.invert(q)))
        end
    end
    isfront=falses(264);isfront[front].=true
    macros=Macro[]
    for (p,(c,w)) in lib
        back=invperm(Int.(p))
        moved=Int16[x for x in 1:264 if back[x]!=x]
        fmoved=Int16[x for x in moved if isfront[x]]
        push!(macros,Macro(w,c,moved,Int16.(back[moved]),fmoved,Int16.(back[fmoved])))
    end
    sort!(macros;by=m->(m.cost,m.word))
    println(log,"library\ttried=",tried,"\tkept=",length(macros));flush(log)
    macros
end

# ---------------------------------------------------------------------------
# Beam search

struct Node
    occ::Vector{UInt16}
    word::Vector{Int}
    cost::Int
    unsat::Int
    wunsat::Float64
end

"""
Don't-care progress of macro `m` on occupants `occ`: (gained-lost, weighted).
Only front positions that `m` moves are inspected; wrong-to-wrong changes count 0.
"""
function progress(pr::Problem,occ,m::Macro)
    d=0;dw=0.0
    @inbounds for j in eachindex(m.fmoved)
        x=m.fmoved[j]
        e=Int(pr.allowed[Int(occ[m.ffrom[j]]),x])-Int(pr.allowed[Int(occ[x]),x])
        d+=e;dw+=e*pr.weight[x]
    end
    (d,dw)
end

"""
Run the beam from `state` (a full signed permutation) with initial word `word0`
(normally the core prefix, already applied in `state`). Returns a named tuple with
`status` (:solved, :stalled, :patience or :maxdepth), the best complete node or
`nothing`, the cheapest node per remaining-unsatisfied count (`snapshots`), the
per-depth `trace`, and for a stall the wrong positions of the best beam node.
"""
function beam_search(state,word0,pr::Problem,library::Vector{Macro},a::M.Algebra,params::Params=Params();log=devnull)
    @assert params.width>=1 && params.fanout>=1 && params.maxdepth>=0 && params.patience>=1 && params.lambda>=0
    occ0=occupants(state)
    root=Node(occ0,copy(word0),M.htm(word0),unsat(pr,occ0),weighted_unsat(pr,occ0))
    root.unsat==0 && return (;status=:solved,best=root,snapshots=Dict(0=>root),trace=NamedTuple[],stall=Int[])
    beam=[root];best=nothing;seen=Set{Vector{UInt16}}([occ0])
    snapshots=Dict{Int,Node}();trace=NamedTuple[]
    bestunsat=root.unsat;lastimprovement=0;status=:maxdepth;stall=Int[]
    eps=1e-9
    for depth in 1:params.maxdepth
        pool=Tuple{Float64,Int,Int,Int,Float64}[]
        for (ni,n) in enumerate(beam)
            local_pool=Tuple{Float64,Int,Int,Int,Float64}[]
            for (mi,m) in enumerate(library)
                d,dw=progress(pr,n.occ,m)
                (params.strict ? dw<=eps : dw< -eps) && continue
                nw=n.wunsat-dw
                push!(local_pool,(params.lambda*nw+n.cost+m.cost,ni,mi,n.unsat-d,nw))
            end
            k=min(length(local_pool),params.fanout*params.width)
            # Full-tuple keys make the selection independent of sort stability.
            k>0 && append!(pool,partialsort!(local_pool,1:k))
        end
        sort!(pool)
        next=Node[]
        for (_,ni,mi,nu,nw) in pool
            length(next)>=params.width && break
            n=beam[ni];m=library[mi]
            occ=apply(n.occ,m)
            occ in seen && continue
            push!(seen,occ)
            word=M.simplify(vcat(n.word,m.word),a)
            node=Node(occ,word,M.htm(word),nu,nw)
            if nu==0
                if isnothing(best) || (node.cost,node.word)<(best.cost,best.word)
                    best=node
                end
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
        println(log,join(("depth",depth,trace[end].beam,trace[end].min_unsat,trace[end].min_cost,trace[end].best),'\t'));flush(log)
        if isempty(next)
            status=isnothing(best) ? :stalled : :solved
            isnothing(best) && (stall=[x for x in pr.constrained if !satisfied(pr,beam[1].occ,x)])
            break
        end
        beam=next
        current=minimum(n.unsat for n in next)
        if current<bestunsat
            bestunsat=current;lastimprovement=depth
        elseif depth-lastimprovement>=params.patience
            status=isnothing(best) ? :patience : :solved
            break
        end
        depth==params.maxdepth && !isnothing(best) && (status=:solved)
    end
    (;status,best,snapshots,trace,stall)
end

"""
Search one month edge from `start` (a state showing the source month) to
`target`. Applies the planner's core prefix, runs the beam, normalizes the word
with `improve_word` and checks the result with the planner's `validate_front`.
Returns `(word, state, htm, status, trace, stall)`; `word` is `nothing` when the
beam did not finish. The word is a candidate, not a verified result.
"""
function search_edge(source,start,target,action,a::M.Algebra,library::Vector{Macro},params::Params=Params();log=devnull)
    prefix=P.chain_core_prefix(source,start,target,action)
    pr=Problem(source,target,action,params.orbit_weights)
    result=beam_search(prefix.state,prefix.word,pr,library,a,params;log)
    if isnothing(result.best)
        return (;word=nothing,state=nothing,htm=-1,status=result.status,trace=result.trace,stall=result.stall)
    end
    word=M.improve_word(result.best.word,a)
    @assert all(g->1<=abs(g)<=21,word)
    state=P.compose(start,P.macro_word_perm(word,a.generators))
    # The incrementally tracked occupants must match an independent replay.
    @assert occupants(state)==result.best.occ
    @assert unsat(pr,occupants(state))==0
    P.validate_front(P.decode_physical(source,state,action),target)
    (;word,state,htm=M.htm(word),status=result.status,trace=result.trace,stall=result.stall)
end

# ---------------------------------------------------------------------------
# Command line: replay a saved chain prefix, search the next edge, export a
# candidate chain file for the native verifiers.

const SOURCE_PRINT=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")

"Replay the root and the first `n` edges of a saved chain, validating every front."
function replay_prefix(proof,source,input,n)
    action=proof.action;gens=[UInt16.(g) for g in action.generators]
    @assert 0<=n<=length(input.edges)
    state=P.signed_perm(proof.registers,proof.targets[input.root])
    P.validate_front(P.decode_physical(source,state,action),P.macro_calendar_target(input.year,input.month))
    @assert P.state_digest(P.decode_physical(source,state,action))==input.hash
    words=Vector{Int}[];hashes=Tuple{String,String}[]
    for e in input.edges[1:n]
        before=P.state_digest(P.decode_physical(source,state,action))
        word=M.expand(e.moves)
        state=P.compose(state,P.macro_word_perm(word,gens))
        P.validate_front(P.decode_physical(source,state,action),P.macro_calendar_target(e.year,e.month))
        after=P.state_digest(P.decode_physical(source,state,action))
        @assert (before,after)==(e.source_hash,e.end_hash)
        push!(words,word);push!(hashes,(before,after))
    end
    (;state,words,hashes)
end

function parse_options(args)
    params=Dict{Symbol,Any}();library=:L5
    for arg in args
        key,value=split(arg,'=';limit=2);key=Symbol(key)
        if key==:library
            library=Symbol(value)
        elseif key==:weights
            params[:orbit_weights]=Dict("W1"=>ORBIT_WEIGHTS_W1,"W2"=>ORBIT_WEIGHTS_W2,"uniform"=>ORBIT_WEIGHTS_UNIFORM)[value]
        elseif key in (:lambda,)
            params[key]=parse(Float64,value)
        elseif key in (:width,:fanout,:maxdepth,:patience)
            params[key]=parse(Int,value)
        elseif key in (:strict,:prune_incumbent)
            params[key]=parse(Bool,value)
        else
            throw(ArgumentError("unknown option $key"))
        end
    end
    (Params(;params...),library_spec(library),library)
end

function main(args)
    length(args)>=6 || error("Usage: search.jl DAG CHAIN.moves.tsv PREFIX_EDGES TARGET_YEAR TARGET_MONTH OUT [key=value ...]")
    dag,chain,n,year,month,out=args[1],args[2],parse(Int,args[3]),parse(Int,args[4]),parse(Int,args[5]),args[6]
    params,spec,libname=parse_options(args[7:end])
    input=V.read_chain(chain)
    @assert 1<=n<=length(input.edges) "PREFIX_EDGES must be at least 1: the native verifier requires two edges"
    previous=input.edges[n]
    @assert (year,month)==(previous.month==12 ? (previous.year+1,1) : (previous.year,previous.month+1)) "target must be the month after the prefix"
    mkpath(out)
    proof=P.replay_dag(dag);action=proof.action;a=M.Algebra(action)
    source=P.read_physical(SOURCE_PRINT)
    prefix=replay_prefix(proof,source,input,n)
    target=P.macro_calendar_target(year,month)
    started=time_ns()
    library=build_library(action,a,spec;log=stdout)
    built=time_ns()
    result=open(joinpath(out,"trace.tsv"),"w") do io
        println(io,"depth\tbeam\tmin_unsat\tmin_cost\tbest")
        search_edge(source,prefix.state,target,action,a,library,params;log=io)
    end
    finished=time_ns()
    open(joinpath(out,"summary.tsv"),"w") do io
        println(io,"status\thtm\tlibrary\tmacros\tlambda\twidth\tfanout\tmaxdepth\tpatience\tstrict\tprune_incumbent\torbit_weights\tlibrary_seconds\tsearch_seconds")
        println(io,join((isnothing(result.word) ? "UNKNOWN_"*uppercase(string(result.status)) : "CANDIDATE",result.htm,libname,length(library),
            params.lambda,params.width,params.fanout,params.maxdepth,params.patience,params.strict,params.prune_incumbent,
            join(round.(params.orbit_weights;digits=6),','),(built-started)/1e9,(finished-built)/1e9),'\t'))
    end
    if isnothing(result.word)
        println("UNKNOWN\t",result.status,"\twrong_front_positions=",join(result.stall,','))
        return 2
    end
    write(joinpath(out,"edge.word"),join(result.word,' ')*"\n")
    before=P.state_digest(P.decode_physical(source,prefix.state,action))
    after=P.state_digest(P.decode_physical(source,result.state,action))
    edges=vcat(input.edges[1:n],[(;year,month)])
    M.export_chain(joinpath(out,"candidate.moves.tsv"),(;input.root,input.year,input.month,input.hash,edges),
        vcat(prefix.words,[result.word]),action;hashes=vcat(prefix.hashes,[(before,after)]))
    println("CANDIDATE\thtm=",result.htm,"\tnative Julia and Flix verification required")
    0
end

end

if abspath(PROGRAM_FILE)==@__FILE__
    exit(GlobalSearch.main(ARGS))
end
