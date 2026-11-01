#!/usr/bin/env julia
# Native Julia chain verifier for the pure split (scheme A) under the new print.
# Same replay as ../continuous/verify.jl (one retained physical state, chronological
# edges, pose/direct replay agreement, exact edge and whole-chain inverse restoration),
# parametrized for the print and the displays: the print is read from PRINT (PR #99 print
# SHA-pinned as provenance base, identities and normals unchanged) and each front is
# checked against the pure-split display under the strict stacked rule.
# The helpers below are copied unchanged from ../practical/verify.jl (turn_vector,
# direct_move) and ../continuous/verify.jl (chain_hash, read_chain, chain_metrics) at
# base 7eaebaf, because including those files twice would redefine constants.
#   pure_chain.jl PRINT DAG CHAIN
include(joinpath(@__DIR__,"pure_common.jl"))
# Explicit coordinate formulas independently rotate the actual sticker poses.
function turn_vector(v, axis)
    axis == 1 && return (v[1], -v[3], v[2])
    axis == 2 && return (v[3], v[2], -v[1])
    (-v[2], v[1], v[3])
end
function direct_move(state, generator, exponent)
    axis = div(generator-1, 7)+1
    slot = mod(generator-1, 7)+1
    layer = (-3, -2, -1, 1, 2, 3, 99)[slot]
    result = state
    for _ in 1:mod(exponent,4)
        result = map(result) do s
            if layer == 99 || s.pos[axis] == layer
                merge(s, (pos=turn_vector(s.pos,axis), normal=turn_vector(s.normal,axis), up=turn_vector(s.up,axis)))
            else
                s
            end
        end
    end
    result
end
function chain_hash(s)
    @assert occursin(r"^[0-9a-f]{64}$",s) "Expected canonical SHA-256"
    String(s)
end
function read_chain(path)
    lines=strict_lines(path)
    @assert length(lines)>=7 && lines[1]=="cubistry.calendar7.chain.v1"
    f=split(lines[2],'\t')
    @assert length(f)==5 && f[1]=="source"
    root,year,month=canonical_integer.(f[2:4]); hash=chain_hash(f[5])
    @assert 1<=root<=91 && 2026<=year<=2099 && 1<=month<=12
    edges=Any[];cursor=3
    while cursor<=length(lines) && lines[cursor]!="finish"
        f=split(lines[cursor],'\t');cursor+=1
        @assert length(f)==9 && f[1]=="edge"
        y,m,htm,qtm,rot,rotq=canonical_integer.(f[2:7])
        @assert 2026<=y<=2099 && 1<=m<=12 && 0<=htm<=100000 && 0<=qtm<=200000 && 0<=rot<=100000 && 0<=rotq<=200000
        source_hash=chain_hash(f[8]);end_hash=chain_hash(f[9]);moves=Tuple{Int,Int}[]
        while cursor<=length(lines) && lines[cursor]!="end"
            f=split(lines[cursor],'\t');cursor+=1
            @assert length(f)==3 && f[1]=="move"
            g,q=canonical_integer.(f[2:3])
            @assert 1<=g<=21 && q in (-1,1,2)
            push!(moves,(g,q));@assert length(moves)<=100000
        end
        @assert cursor<=length(lines) && lines[cursor]=="end"
        cursor+=1
        push!(edges,(;year=y,month=m,htm,qtm,rot,rotq,source_hash,end_hash,moves))
        @assert length(edges)<=1000
    end
    @assert cursor==length(lines) && lines[cursor]=="finish" && length(edges)>=2
    (;root,year,month,hash,edges)
end
function chain_metrics(moves)
    htm=qtm=rot=rotq=0
    for (g,q) in moves
        if g%7==0
            rot+=1;rotq+=abs(q)
        else
            htm+=1;qtm+=abs(q)
        end
    end
    (htm,qtm,rot,rotq,length(moves))
end
const OK_FRONT="-\t-\t-\t-"
function verify_pure_chain(print_path,dag_path,path)
    @assert bytes2hex(sha256(read(PR99_PRINT)))==PR99_PRINT_SHA "unchanged PR99 printing provenance"
    old=read_physical(PR99_PRINT);printing=read_physical(print_path)
    @assert all((old[i].piece,old[i].home,old[i].normal)==(printing[i].piece,printing[i].home,printing[i].normal) for i in 1:294) "surface identity changed"
    goals=stacked_goals(PURE_VARIANT);disp(y,m)=stacked_board(y,m,PURE_VARIANT)
    input=read_chain(path)
    proof=replay_dag(dag_path;require_full=false)
    @assert haskey(proof.targets,input.root)
    p=signed_perm(proof.registers,proof.targets[input.root])
    state=decode_physical(printing,p,proof.action)
    @assert goals[input.root].board==disp(input.year,input.month) "Declared source month must match source-root display"
    @assert front_failure(state,disp(input.year,input.month),"strict")==OK_FRONT "Source front"
    @assert state_digest(state)==input.hash "Initial actual physical state digest"
    initial_state=copy(state);initial_perm=copy(p)
    y=input.year;m=input.month;all_moves=Tuple{Int,Int}[]
    println("source-sha256\t",input.hash)
    for (i,edge) in enumerate(input.edges)
        next_y=m==12 ? y+1 : y;next_m=m==12 ? 1 : m+1
        @assert (edge.year,edge.month)==(next_y,next_m) "Chronological adjacency required"
        @assert state_digest(state)==edge.source_hash "Retained source differs: reset/substitution forbidden"
        before_state=copy(state);before_perm=copy(p)
        metrics=chain_metrics(edge.moves)
        @assert metrics[1:4]==(edge.htm,edge.qtm,edge.rot,edge.rotq) "Declared transition metrics mismatch"
        for (g,q) in edge.moves
            state=direct_move(state,g,q)
            for _ in 1:mod(q,4);p=compose(p,UInt16.(proof.action.generators[g]));end
            @assert state==decode_physical(printing,p,proof.action) "Direct294/pose264 disagreement"
        end
        @assert front_failure(state,disp(edge.year,edge.month),"strict")==OK_FRONT "Edge $i front"
        @assert state_digest(state)==edge.end_hash "Intermediate/final physical hash mismatch"
        restored=copy(state);back=copy(p)
        for (g,q) in reverse(edge.moves)
            restored=direct_move(restored,g,-q)
            for _ in 1:mod(-q,4);back=compose(back,UInt16.(proof.action.generators[g]));end
        end
        @assert restored==before_state && back==before_perm "Exact edge inverse restoration"
        println("edge\t",join((i,edge.year,edge.month,edge.source_hash,edge.end_hash),'\t'))
        println("metrics\t",i,'\t',join(metrics,'\t'))
        append!(all_moves,edge.moves)
        y=edge.year;m=edge.month
    end
    final_hash=state_digest(state);back_state=copy(state);back_perm=copy(p)
    for (g,q) in reverse(all_moves)
        back_state=direct_move(back_state,g,-q)
        for _ in 1:mod(-q,4);back_perm=compose(back_perm,UInt16.(proof.action.generators[g]));end
    end
    @assert back_state==initial_state && back_perm==initial_perm "Exact entire-chain inverse restoration"
    println("endpoint-sha256\t",final_hash)
    println("status\tVALID_CONTINUOUS_CHAIN\t",length(input.edges),"\t218\t294\t49")
end
if abspath(PROGRAM_FILE)==@__FILE__
    try
        @assert length(ARGS)==3 "PRINT DAG CHAIN"
        verify_pure_chain(ARGS...)
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
