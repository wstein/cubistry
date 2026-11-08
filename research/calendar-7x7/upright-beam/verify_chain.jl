#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# INDEPENDENT replay of a retained-state chain (cubistry.calendar7.chain.v1, strict upright
# rule). Uses only upright-moves/verify_moves.jl (own print parser, own boards, own move
# geometry, own strict front rule, own SHA-256 of the state text); it shares no code with the
# solver, with pure_chain.jl or with the Flix verifier. It parses the chain file itself.
#   verify_chain.jl PRINT ROOT_MOVES CHAIN
# The state is the solved print turned by the root word of the source display; every edge
# word is applied to the retained state; after the root and after every edge the front must
# show that calendar month, the declared HTM must equal the recomputed HTM, the months must be
# consecutive, and the declared source/end SHA-256 must equal the replayed state's SHA-256.
include(joinpath(@__DIR__,"..","upright-moves","verify_moves.jl"))
function state_sha(state)
    io=IOBuffer()
    for s in state;println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    bytes2hex(sha256(take!(io)))
end
function read_chain_file(path)
    L=readlines(path)
    @assert length(L)>=4 && L[1]=="cubistry.calendar7.chain.v1" && L[end]=="finish" "chain header or trailer"
    f=split(L[2],'\t');@assert length(f)==5 && f[1]=="source" "source line"
    src=(root=parse(Int,f[2]),year=parse(Int,f[3]),month=parse(Int,f[4]),hash=String(f[5]))
    edges=[];i=3
    while L[i]!="finish"
        f=split(L[i],'\t');@assert length(f)==9 && f[1]=="edge" "edge line $i"
        j=i+1;word=Int[]
        while L[j]!="end"
            g=split(L[j],'\t');@assert length(g)==3 && g[1]=="move" "move line $j"
            gen=parse(Int,g[2]);q=parse(Int,g[3]);@assert 1<=gen<=21 && q in (-1,1,2) "move $j"
            q==2 ? append!(word,[gen,gen]) : push!(word,q*gen);j+=1
        end
        push!(edges,(year=parse(Int,f[2]),month=parse(Int,f[3]),htm=parse(Int,f[4]),sh=String(f[8]),eh=String(f[9]),word=word));i=j+1
    end
    (src=src,edges=edges)
end
# Start-up self-check: this verifier must apply the STRICT rule. On the source front a sticker of
# a 1/2/5/8 cell turned by 180 degrees and a sticker "I" in a "1" cell must each be rejected.
function rule_selfcheck(state,b)
    idx(r,c)=only(i for (i,s) in enumerate(state) if s.pos==(c-4,4-r,3) && s.normal==(0,0,1))
    i1=nothing;i2=nothing
    for r in 1:7,c in 1:7
        t=b[r,c][1]
        isnothing(i1) && t in ("1","2","5","8") && (i1=idx(r,c))
        isnothing(i2) && t=="1" && (i2=idx(r,c))
    end
    @assert !isnothing(i1) && !isnothing(i2) "self-check needs a 1/2/5/8 cell and a 1 cell on the source front"
    s=state[i1];turned=copy(state);turned[i1]=merge(s,(up=map(-,s.up),))
    aliased=copy(state);aliased[i2]=merge(state[i2],(text="I",))
    a=check_front(turned,b).bad;c=check_front(aliased,b).bad
    println("rule-selfcheck\tstrict\thalf-turned-glyph=",a>0 ? "REJECT" : "ACCEPT","\tI-as-1=",c>0 ? "REJECT" : "ACCEPT")
    @assert a>0 && c>0 "self-check: the strict front rule is not active"
end
function verify_chain(print_path,moves_path,chain_path)
    st0=read_print(print_path)
    roots=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(moves_path)[2:end] if !isempty(l))
    ch=read_chain_file(chain_path);ok=true;total=0
    state=apply_word(st0,roots[ch.src.root])
    r=check_front(state,board(ch.src.year,ch.src.month))
    rule_selfcheck(state,board(ch.src.year,ch.src.month))
    sh=state_sha(state)
    v=r.bad==0 && sh==ch.src.hash
    println("chain-root\t",ch.src.year,'-',ch.src.month,'\t',v ? "ACCEPT" : "REJECT","\tbad=",r.bad,"\tsha=",sh==ch.src.hash ? "match" : "MISMATCH");ok&=v
    y,m=ch.src.year,ch.src.month;turned=0
    for (i,e) in enumerate(ch.edges)
        y,m=m==12 ? (y+1,1) : (y,m+1)
        adj=(e.year,e.month)==(y,m);before=state_sha(state)
        state=apply_word(state,e.word);r=check_front(state,board(e.year,e.month))
        h=htm(e.word);after=state_sha(state);total+=h;turned+=r.turned
        v=adj && r.bad==0 && h==e.htm && before==e.sh && after==e.eh
        v || println("chain-edge-detail\t",i,"\tadjacent=",adj,"\thtm=",h,"/",e.htm,"\tsource-sha=",before==e.sh,"\tend-sha=",after==e.eh)
        println("chain-edge\t",i,'\t',e.year,'-',e.month,'\t',v ? "ACCEPT" : "REJECT",'\t',h,"\tbad=",r.bad,"\tturned=",r.turned);ok&=v
    end
    println("chain-total-htm\t",total,"\tedges\t",length(ch.edges),"\tend\t",y,'-',m)
    println("chain-verdict\t",ok ? "ACCEPT_CHAIN" : "REJECT",'\t',length(ch.edges),'\t',y,'-',m)
    exit(ok ? 0 : 1)
end
if abspath(PROGRAM_FILE)==(@__FILE__); verify_chain(ARGS[1],ARGS[2],ARGS[3]); end
