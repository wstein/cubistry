#!/usr/bin/env julia
# Independent native chain replay. A single initial state is retained throughout.
include(joinpath(@__DIR__, "..", "practical", "verify.jl"))

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
        @assert 2026<=y<=2099 && 1<=m<=12 && all(>=(0),(htm,qtm,rot,rotq))
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

function verify_chain(dag_path,path;output=stdout)
    input=read_chain(path)
    print_path=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")
    @assert bytes2hex(sha256(read(print_path)))==PRINT_SHA256 "Immutable printing changed"
    printing=read_physical(print_path)
    proof=replay_dag(dag_path;require_full=false)
    @assert haskey(proof.targets,input.root)
    p=signed_perm(proof.registers,proof.targets[input.root])
    state=decode_physical(printing,p,proof.action)
    validate_front(state,physical_targets("EN")[input.root])
    validate_front(state,calendar_goal(input.year,input.month))
    @assert state_digest(state)==input.hash "Initial actual physical state digest"
    initial_state=copy(state);initial_perm=copy(p)
    y=input.year;m=input.month;all_moves=Tuple{Int,Int}[];receipts=Any[]
    println(output,"source-sha256\t",input.hash)
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
        validate_front(state,calendar_goal(edge.year,edge.month))
        @assert state_digest(state)==edge.end_hash "Intermediate/final physical hash mismatch"
        restored=copy(state);back=copy(p)
        for (g,q) in reverse(edge.moves)
            restored=direct_move(restored,g,-q)
            for _ in 1:mod(-q,4);back=compose(back,UInt16.(proof.action.generators[g]));end
        end
        @assert restored==before_state && back==before_perm "Exact edge inverse restoration"
        println(output,"edge\t",join((i,edge.year,edge.month,edge.source_hash,edge.end_hash),'\t'))
        println(output,"metrics\t",i,'\t',join(metrics,'\t'))
        push!(receipts,(;index=i,year=edge.year,month=edge.month,source_hash=edge.source_hash,end_hash=edge.end_hash,metrics))
        append!(all_moves,edge.moves)
        y=edge.year;m=edge.month
        # Crucially, state and p are retained. No new DAG root is read here.
    end
    final_hash=state_digest(state)
    back_state=copy(state);back_perm=copy(p)
    for (g,q) in reverse(all_moves)
        back_state=direct_move(back_state,g,-q)
        for _ in 1:mod(-q,4);back_perm=compose(back_perm,UInt16.(proof.action.generators[g]));end
    end
    @assert back_state==initial_state && back_perm==initial_perm "Exact entire-chain inverse restoration"
    println(output,"endpoint-sha256\t",final_hash)
    println(output,"status\tVALID_CONTINUOUS_CHAIN\t",length(input.edges),"\t218\t294\t49")
    (;input,receipts,final_hash)
end

if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS)==2 "Expected original DAG and raw chain certificate"
    verify_chain(ARGS...)
end
