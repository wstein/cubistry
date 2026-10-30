# Candidate tooling only; native chain validators remain unchanged.
module Minimax
module Planner
include(joinpath(@__DIR__,"..","continuous","solver_chain.jl"))
end
module Validator
include(joinpath(@__DIR__,"..","continuous","verify.jl"))
end
const P=Planner
const V=Validator

struct Algebra
    generators::Vector{Vector{UInt16}}
    frames::Vector{Vector{UInt16}}
    frame_words::Vector{Vector{Int}}
    next_frame::Matrix{Int}
    conjugates::Matrix{Int}
end
htm(word)=count(m->m[1]%7!=0,P.macro_moves(word))
function Algebra(action)
    gs=[UInt16.(g) for g in action.generators]
    frames=[P.identity_perm()];words=[Int[]];cursor=1
    while cursor<=length(frames)
        f=frames[cursor]
        for g in (7,14,21),s in (1,-1)
            next=P.compose(f,s==1 ? gs[g] : P.invert(gs[g]))
            if !(next in frames);push!(frames,next);push!(words,vcat(words[cursor],s*g));end
        end
        cursor+=1
    end
    @assert length(frames)==24
    nexts=zeros(Int,24,42);conj=zeros(Int,24,42)
    for (i,f) in enumerate(frames),g in 1:21,s in (1,-1)
        col=2g-(s==1 ? 1 : 0);p=s==1 ? gs[g] : P.invert(gs[g])
        if g%7==0
            nexts[i,col]=only(findall(==(P.compose(f,p)),frames))
        else
            target=P.compose(P.compose(f,p),P.invert(f))
            options=[t*j for j in 1:21 if j%7!=0 for t in (1,-1)
                if (t==1 ? gs[j] : P.invert(gs[j]))==target]
            conj[i,col]=only(options)
        end
    end
    Algebra(gs,frames,words,nexts,conj)
end

function simplify(word,a::Algebra)
    frame=1;axes=Int[];counts=Vector{Int}[]
    for signed in word
        g=abs(signed);col=2g-(signed>0 ? 1 : 0)
        if g%7==0
            frame=a.next_frame[frame,col];continue
        end
        moved=a.conjugates[frame,col];gen=abs(moved)
        axis=div(gen-1,7)+1;slot=mod(gen-1,7)+1
        if isempty(axes) || last(axes)!=axis
            push!(axes,axis);push!(counts,zeros(Int,6))
        end
        last(counts)[slot]=mod(last(counts)[slot]+sign(moved),4)
        if all(iszero,last(counts));pop!(axes);pop!(counts);end
    end
    out=Int[]
    for (axis,block) in zip(axes,counts),slot in 1:6
        q=block[slot];g=7(axis-1)+slot
        q==3 ? push!(out,-g) : append!(out,fill(g,q))
    end
    append!(out,a.frame_words[frame])
    out
end

function improve_word(word,a)
    candidate=simplify(word,a)
    @assert P.macro_word_perm(word,a.generators)==P.macro_word_perm(candidate,a.generators)
    (htm(candidate),length(P.macro_moves(candidate))) <= (htm(word),length(P.macro_moves(word))) ? candidate : word
end

function export_chain(path,input,edge_words,action;hashes=nothing)
    open(path,"w") do io
        println(io,"cubistry.calendar7.chain.v1")
        println(io,join(("source",input.root,input.year,input.month,input.hash),'\t'))
        for (i,(edge,word)) in enumerate(zip(input.edges,edge_words))
            m=P.chain_metrics(word,action)
            sh,eh=isnothing(hashes) ? (edge.source_hash,edge.end_hash) : hashes[i]
            println(io,join(("edge",edge.year,edge.month,m.htm,m.qtm,m.rotations,m.rotation_qtm,sh,eh),'\t'))
            for (g,q) in P.macro_moves(word);println(io,"move\t",g,'\t',q);end
            println(io,"end")
        end
        println(io,"finish")
    end
end
expand(moves)=reduce(vcat,(q== -1 ? [-g] : fill(g,q) for (g,q) in moves);init=Int[])

function simplify_baseline(out)
    mkpath(out);action=P.pose_action();a=Algebra(action)
    for i in 1:4
        input=V.read_chain(joinpath(@__DIR__,"..","continuous","evidence","chain-$i.moves.tsv"))
        words=[improve_word(expand(e.moves),a) for e in input.edges]
        export_chain(joinpath(out,"chain-$i.moves.tsv"),input,words,action)
        println("chain\t",i,"\thtm\t",join(htm.(words),','))
    end
end
end

if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==1
    Minimax.simplify_baseline(only(ARGS))
end
