#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Native retained-state replay: independent direct294 and pose264 actions.
include(joinpath(@__DIR__,"..","row1-window-print/common.jl"))
const WINDOW_PRINT_SHA="0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127"
# Window end YYYY-MM (env WINDOW_END, default 2028-01). The 21-month print stays pinned; a longer
# window needs its own print, whose SHA-256 must be supplied in CAL7_WINDOW_PRINT_SHA.
const WINDOW_END=get(ENV,"WINDOW_END","2028-01")
# An explicit month list S (CAL7_WINDOW_MONTHS, CAL7_WINDOW_MONTHS_SHA256) replaces WINDOW_END; its first month is the chain
# root and must be May 2026 (the identity pose of the committed prints). Gaps in S are bridged by one edge.
const LIST_MODE=!isempty(get(ENV,"CAL7_WINDOW_MONTHS",""))
const WINDOW_LIST=window_month_list()
const WINDOW_MONTHS=length(WINDOW_LIST)
const WINDOW_BRIDGES=month_list_bridges(WINDOW_LIST)
const WINDOW_PRINT_EXPECT=(!LIST_MODE && WINDOW_END=="2028-01") ? WINDOW_PRINT_SHA : get(ENV,"CAL7_WINDOW_PRINT_SHA","")
# The layout pin is a parameter so that a window-local layout can be pinned without touching the checker.
const WINDOW_LAYOUT_SHA=get(ENV,"CAL7_WINDOW_LAYOUT_SHA256","c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db")
function chain_lines(path)
    raw=read(path,String)
    @assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw) "canonical chain UTF-8/LF"
    @assert sizeof(raw)<=16000000 "bounded chain input"
    ls=String.(split(chop(raw;tail=1),'\n'));@assert all(!isempty,ls)
    ls
end
function read_window_chain(path)
    ls=chain_lines(path);@assert length(ls)>=4 && ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish" "chain header and trailer"
    f=String.(split(ls[2],'\t'));@assert length(f)==5 && f[1]=="source"
    @assert WINDOW_LIST[1]==MONTH_LIST_ROOT "chain root month is May 2026"
    @assert canonical_integer.(f[2:4])==[5,2026,5] "May 2026 identity root"
    validhash(s)=occursin(r"^[0-9a-f]{64}$",s)
    @assert validhash(f[5]);root=String(f[5]);cursor=3;edges=[];totalmoves=0
    while cursor<length(ls)
        f=String.(split(ls[cursor],'\t'));cursor+=1
        @assert length(f)==9 && f[1]=="edge" "edge record"
        y,m,h,q,r,rq=canonical_integer.(f[2:7]);@assert 0<=h<=100000 && 0<=q<=200000 && 0<=r<=100000 && 0<=rq<=200000 "bounded nonnegative metrics"
        @assert validhash(f[8]) && validhash(f[9]);moves=Tuple{Int,Int}[]
        while cursor<length(ls) && ls[cursor]!="end"
            a=String.(split(ls[cursor],'\t'));cursor+=1
            @assert length(a)==3 && a[1]=="move" "move record"
            g,e=canonical_integer.(a[2:3]);@assert 1<=g<=21 && e in (-1,1,2) "legal generator and exponent; no middle slice"
            push!(moves,(g,e));totalmoves+=1;@assert totalmoves<=100000 "bounded total moves"
        end
        @assert cursor<length(ls) && ls[cursor]=="end";cursor+=1
        push!(edges,(year=y,month=m,metrics=(h,q,r,rq),source=f[8],finish=f[9],moves=moves))
        @assert length(edges)<=WINDOW_MONTHS-1 "at most $(WINDOW_MONTHS-1) edges"
    end
    @assert cursor==length(ls) && length(edges)==WINDOW_MONTHS-1 "exactly $(WINDOW_MONTHS-1) chronological edges"
    root,edges
end
function chain_turn(v,axis)
    axis==1 ? (v[1],-v[3],v[2]) : axis==2 ? (v[3],v[2],-v[1]) : (-v[2],v[1],v[3])
end
function chain_move(state,g,e)
    @assert 1<=g<=21 && e in (-1,1,2)
    axis=div(g-1,7)+1;slot=mod(g-1,7)+1;layers=(-3,-2,-1,1,2,3)
    for _ in 1:(e==-1 ? 3 : e)
        state=[slot==7 || s.pos[axis]==layers[slot] ? merge(s,(pos=chain_turn(s.pos,axis),normal=chain_turn(s.normal,axis),up=chain_turn(s.up,axis))) : s for s in state]
    end
    state
end
function chain_state_text(state;header=false)
    io=IOBuffer();header && println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
    for s in state;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    String(take!(io))
end
chain_digest(state)=bytes2hex(sha256(codeunits(chain_state_text(state))))
function chain_front_ok(state,board)
    for r in 1:7,c in 1:7
        ss=filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state)
        length(ss)==1 || return false
        s=only(ss);a=findfirst(==(s.up),IMAGE_UPS);isnothing(a) && return false
        coupled_optic(s.text,a-1,s.ink)==coupled_optic(board[r,c][1],0,board[r,c][2]) || return false
    end
    true
end
function chain_selfcheck(state,goal,source,action,gens)
    for g in 1:21,e in (-1,1,2)
        direct=chain_move(state,g,e);p=UInt16.(1:264)
        for _ in 1:(e==-1 ? 3 : e);p=compose(p,gens[g]);end
        @assert direct==decode_physical(source,p,action) "single-move direct294/pose264 agreement"
        @assert chain_move(direct,g,e==2 ? 2 : -e)==state "single-move inverse"
    end
    idx=only(i for (i,s) in enumerate(state) if s.pos==(2,1,3) && s.normal==FRONT_NORMAL)
    @assert goal.board[3,6][1]=="1"
    turned=copy(state);turned[idx]=merge(turned[idx],(up=map(-,turned[idx].up),))
    @assert !chain_front_ok(turned,goal.board) "strict upside-down one rejected"
    alias=copy(state);alias[idx]=merge(alias[idx],(text="I",))
    @assert !chain_front_ok(alias,goal.board) "I is not one"
    band=only(i for (i,s) in enumerate(state) if s.pos==(3,3,3) && s.normal==FRONT_NORMAL)
    turned=copy(state);turned[band]=merge(turned[band],(up=(-1,0,0),))
    @assert !chain_front_ok(turned,goal.board) "band quarter turn rejected"
    blank=copy(state);blank[band]=merge(blank[band],(ink="blank",))
    @assert !chain_front_ok(blank,goal.board) "band is not blank"
    println("selfcheck\t63\tdirect-pose-inverse\t4\tstrict-optics\tPASS")
end
function verify_window_chain(layout,printing,path,statesdir)
    @assert bytes2hex(sha256(read(layout)))==WINDOW_LAYOUT_SHA "new layout pin"
    @assert bytes2hex(sha256(read(printing)))==WINDOW_PRINT_EXPECT "new immutable print pin"
    labels=coupled_labels(read(layout,String));goals=coupled_goals(labels,"names-band","window")
    source=window_read_print(printing);action=pose_action();gens=[UInt16.(g) for g in action.generators]
    state=[(id=s.id,piece=s.piece,pos=s.home,normal=s.normal,up=s.up,text=s.text,ink=s.ink) for s in source]
    initial=copy(state);p=UInt16.(1:264);root,edges=read_window_chain(path)
    @assert state==decode_physical(source,p,action) && chain_front_ok(state,goals[1].board) "identity root front"
    chain_selfcheck(state,goals[1],source,action,gens)
    @assert chain_digest(state)==root "root digest"
    @assert read(joinpath(statesdir,"state-01.tsv"),String)==chain_state_text(state;header=true) "root full-state snapshot"
    println("input\t",WINDOW_LAYOUT_SHA,'\t',WINDOW_PRINT_EXPECT,'\t',bytes2hex(sha256(read(path))))
    ml=month_list_line(WINDOW_LIST);isnothing(ml) || println(ml)
    println("root\t2026\t5\t",root)
    total=(0,0,0,0);allmoves=Tuple{Int,Int}[]
    for (i,edge) in enumerate(edges)
        goal=goals[i+1];@assert (edge.year,edge.month)==(goal.year,goal.month) "chronological month adjacency"
        @assert chain_digest(state)==edge.source "edge source continuity"
        before=copy(state);beforep=copy(p)
        metrics=(count(m->m[1]%7!=0,edge.moves),sum(abs(e) for (g,e) in edge.moves if g%7!=0;init=0),count(m->m[1]%7==0,edge.moves),sum(abs(e) for (g,e) in edge.moves if g%7==0;init=0))
        @assert metrics==edge.metrics "exact HTM QTM and rotation metrics"
        for (g,e) in edge.moves
            state=chain_move(state,g,e)
            for _ in 1:(e==-1 ? 3 : e);p=compose(p,gens[g]);end
        end
        @assert state==decode_physical(source,p,action) "direct294/pose264 retained-state agreement"
        @assert chain_digest(state)==edge.finish "edge end digest"
        @assert chain_front_ok(state,goal.board) "strict month front including band line"
        @assert read(joinpath(statesdir,"state-"*lpad(string(i+1),2,'0')*".tsv"),String)==chain_state_text(state;header=true) "complete immutable-art state snapshot"
        inverse=copy(state);inversep=copy(p)
        for (g,e) in reverse(edge.moves)
            inv=e==2 ? 2 : -e;inverse=chain_move(inverse,g,inv)
            for _ in 1:(inv==-1 ? 3 : inv);inversep=compose(inversep,gens[g]);end
        end
        @assert inverse==before && inversep==beforep "edge inverse restores full state"
        append!(allmoves,edge.moves);total=map(+,total,metrics)
        println("edge\t",i,'\t',goal.year,'\t',goal.month,'\t',join(metrics,'\t'),'\t',edge.source,'\t',edge.finish,"\tPASS",WINDOW_BRIDGES[i] ? "\tBRIDGE" : "")
    end
    @assert (edges[end].year,edges[end].month)==(goals[end].year,goals[end].month) && length(goals)==WINDOW_MONTHS "window end matches the last chain edge"
    for (g,e) in reverse(allmoves);state=chain_move(state,g,e==2 ? 2 : -e);end
    @assert state==initial "whole-chain inverse restores all 294 surfaces"
    println("summary\t",WINDOW_MONTHS,'\t',WINDOW_MONTHS-1,'\t',join(total,'\t'),'\t',LIST_MODE ? "list:"*month_text(WINDOW_LIST[end]) : WINDOW_END,"\tINVERSE_PASS")
    println("verdict\tSAT\tlegal-retained-state-window-chain\t",WINDOW_MONTHS,'\t',WINDOW_MONTHS-1)
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS)==4 "check.jl LAYOUT PRINT CHAIN STATES_DIRECTORY"
        verify_window_chain(ARGS...)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
