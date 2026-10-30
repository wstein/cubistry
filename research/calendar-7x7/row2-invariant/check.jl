#!/usr/bin/env julia
# Additive native proof: reuse the unchanged Julia physical action and raw DAG reader.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))
const ROW2_PRINT_PIN="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931"
const ROW2_DAG_PIN="ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24"

function row2_read_certificate(path)
    rows=strict_lines(path)
    @assert length(rows)==10 && rows[1]=="cubistry.calendar7.row2-endpoint.v1"
    @assert rows[2]=="printing-sha256\t$ROW2_PRINT_PIN" && rows[3]=="dag-sha256\t$ROW2_DAG_PIN"
    result=Any[]
    for column in 1:7
        f=split(rows[column+3],'\t');@assert length(f)==7 && f[1]=="column"
        col,id,piece=canonical_integer.(f[2:4]);@assert col==column && 1<=id<=294 && 1<=piece<=218
        vec(s)=tuple(canonical_integer.(split(s,','))...)
        p,n,u=vec.(f[5:7]);@assert p==(column-4,2,3) && n==FRONT_NORMAL && u==(0,1,0)
        push!(result,(id=id,piece=piece,pos=p,normal=n,up=u))
    end
    result
end

function row2_uniqueness(source,goals,certificate)
    for column in 1:7
        wanted=goals[1].board[2,column]
        @assert all(g.board[2,column]==wanted for g in goals)
        matches=[(id,q) for (id,s) in enumerate(source) for q in 0:3
            if image_normal(s.text,q,s.ink)==image_normal(wanted[1],0,wanted[2])]
        expected=certificate[column]
        @assert matches==[(expected.id,0)] "Weekday artwork must select exactly one physical surface and upright orientation"
        @assert source[expected.id].piece==expected.piece
        println("row2-unique\t",join([column,expected.id,expected.piece,source[expected.id].text,source[expected.id].ink,0],'\t'))
    end
end

function row2_signature(state,certificate)
    row=Any[]
    for expected in certificate
        sticker=state[expected.id]
        @assert (sticker.id,sticker.piece,sticker.pos,sticker.normal,sticker.up)==(expected.id,expected.piece,expected.pos,expected.normal,expected.up) "Row 2 physical identity or pose changed at endpoint"
        push!(row,sticker)
    end
    io=IOBuffer()
    for s in row;println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    bytes2hex(sha256(take!(io)))
end

function row2_chain(path,roots,source,action,certificate)
    rows=strict_lines(path);@assert rows[1]=="cubistry.calendar7.chain.v1"
    f=split(rows[2],'\t');@assert length(f)==5 && f[1]=="source"
    root,year,month=canonical_integer.(f[2:4]);@assert haskey(roots,root) && 2026<=year<=2099 && 1<=month<=12
    p=copy(roots[root]);state=decode_physical(source,p,action)
    @assert state_digest(state)==f[5]
    validate_front(state,row2_goal(year,month));signature=row2_signature(state,certificate)
    input_sha=bytes2hex(sha256(read(path)))
    println("row2-chain-start\t",join([input_sha,year,month,state_digest(state),signature],'\t'))
    line=3;edges=0
    while line<=length(rows) && rows[line]!="finish"
        f=split(rows[line],'\t');@assert length(f)==9 && f[1]=="edge";line+=1
        yy,mm,h,q,r,rq=canonical_integer.(f[2:7]);sh,eh=f[8:9]
        expected_month=month==12 ? (year+1,1) : (year,month+1)
        @assert (yy,mm)==expected_month && 2026<=yy<=2099
        @assert state_digest(decode_physical(source,p,action))==sh
        counts=zeros(Int,4)
        while line<=length(rows) && rows[line]!="end"
            move=split(rows[line],'\t');@assert length(move)==3 && move[1]=="move";line+=1
            gen,turns=canonical_integer.(move[2:3]);@assert 1<=gen<=21 && turns in (-1,1,2)
            g=UInt16.(action.generators[gen]);turns==-1 && (g=invert(g))
            turns==2 && (g=compose(g,g));p=compose(p,g)
            rotation=action.moves[gen][2]==99
            counts[rotation ? 3 : 1]+=1;counts[rotation ? 4 : 2]+=abs(turns)
        end
        @assert line<=length(rows) && rows[line]=="end";line+=1
        @assert counts==[h,q,r,rq]
        state=decode_physical(source,p,action);@assert state_digest(state)==eh
        validate_front(state,row2_goal(yy,mm));signature=row2_signature(state,certificate)
        year,month=yy,mm;edges+=1
        println("row2-chain-end\t",join([input_sha,edges,year,month,state_digest(state),signature],'\t'))
    end
    @assert line==length(rows) && rows[line]=="finish" && edges>=2
    edges
end

function row2_goal(year,month)
    a=board(year,month,"EN";merge_six_nine=false);start=month<=9 ? 5 : 1
    for col in 1:7
        a[1,col]=start<=col<=start+2 ? (string(collect(MONTHS["EN"][month])[col-start+1]),"month") : ("","blank")
        text,ink=a[3,col];!isempty(text) && parse(Int,text)>7 && (a[3,col]=(text*"↶",ink))
    end
    (;year,month,board=a)
end

function check_row2(certificate_path,dag_path,chains)
    certificate=row2_read_certificate(certificate_path)
    printing=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")
    @assert bytes2hex(sha256(read(printing)))==ROW2_PRINT_PIN
    @assert bytes2hex(sha256(read(dag_path)))==ROW2_DAG_PIN
    data=check_data(dirname(printing));source=data.source;goals=data.goals
    row2_uniqueness(source,goals,certificate)
    for year in 2026:2099,month in 1:12
        target=row2_goal(year,month)
        @assert all(target.board[2,c]==goals[1].board[2,c] for c in 1:7)
    end
    proof=replay_dag(dag_path);roots=Dict(id=>signed_perm(proof.registers,proof.targets[id]) for id in 1:91)
    signature=nothing
    for id in 1:91
        state=decode_physical(source,roots[id],proof.action);validate_front(state,goals[id])
        row=row2_signature(state,certificate);isnothing(signature) ? (signature=row) : (@assert signature==row)
        println("row2-root\t",id,'\t',state_digest(state),'\t',row)
    end
    total=sum(row2_chain(path,roots,source,proof.action,certificate) for path in chains;init=0)
    println("row2-summary\tSAT_SCOPED_ENDPOINT_IDENTITY\t7\t91\t888\t",length(chains),'\t',total,'\t',signature)
end

if abspath(PROGRAM_FILE)==@__FILE__
    try
        @assert length(ARGS)>=2 "CERTIFICATE DAG [CHAIN ...]"
        check_row2(ARGS[1],ARGS[2],ARGS[3:end])
    catch exception
        println(stderr,"INVALID\t",sprint(showerror,exception));exit(1)
    end
end
