#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Third replay: inherited independent verifier geometry, separate board/parser/optics.
# Frozen upright-beam/verify_chain.jl and strict print/root pins remain unchanged.
module IndependentRowOne
include(joinpath(@__DIR__,"..","upright-beam/verify_chain.jl"))
# Month list S: own reader (shares nothing with check.jl). CAL7_WINDOW_MONTHS/CAL7_WINDOW_MONTHS_SHA256 exclude WINDOW_END.
const LIST_PATH=get(ENV,"CAL7_WINDOW_MONTHS","")
const LISTED=!isempty(LIST_PATH)
function listed_months()
    @assert !haskey(ENV,"WINDOW_END") "list and window end are exclusive"
    pin=get(ENV,"CAL7_WINDOW_MONTHS_SHA256","");@assert length(pin)==64 && all(c->c in "0123456789abcdef",pin) "list pin"
    bytes=read(LIST_PATH);@assert bytes2hex(sha256(bytes))==pin "list hash"
    txt=String(copy(bytes));@assert isvalid(txt) && endswith(txt,"\n") && !occursin('\r',txt) "list is canonical LF"
    out=Tuple{Int,Int}[]
    for row in split(chop(txt),"\n")
        mm=match(r"^(\d{4})-(\d{2})$",row);@assert !isnothing(mm) "list row is YYYY-MM"
        t=Tuple(parse.(Int,mm.captures));@assert 1<=t[2]<=12 && (1900,1)<=t<=(2100,1) "list row in range"
        @assert isempty(out) || t>out[end] "list strictly increasing"
        push!(out,t)
    end
    out
end
const MONTHS=LISTED ? listed_months() : nothing
const END_TEXT=LISTED ? "list" : get(ENV,"WINDOW_END","2028-01")
const END_MATCH=LISTED ? nothing : match(r"^(\d{4})-(\d{2})\z",END_TEXT)
@assert LISTED || !isnothing(END_MATCH) "window end is YYYY-MM"
const END_YM=LISTED ? MONTHS[end] : Tuple(parse.(Int,END_MATCH.captures))
@assert 1<=END_YM[2]<=12 && END_YM>=(LISTED ? (1900,1) : (2026,5)) && END_YM<=(2100,1) "window end lies within May 2026 to January 2100"
# Chain root month (CAL7_ROOT_MONTH, own parser): the month whose board the identity pose shows; default the first month of S.
# If it differs from S[1] the chain has one extra root edge from the identity pose to S[1].
const FIRSTM=LISTED ? MONTHS[1] : (2026,5)
const ROOTM=let t=get(ENV,"CAL7_ROOT_MONTH","")
    if isempty(t)
        FIRSTM
    else
        mm=match(r"^(\d{4})-(\d{2})$",t);@assert !isnothing(mm) "root month is YYYY-MM"
        r=Tuple(parse.(Int,mm.captures));@assert 1<=r[2]<=12 && (1900,1)<=r<=(2100,1) "root month in range";r
    end
end
const ROOTED=ROOTM!=FIRSTM
@assert !ROOTED || LISTED "a root month other than the first member needs a month list"
const CHAIN=LISTED ? (ROOTED ? vcat([ROOTM],MONTHS) : MONTHS) : nothing
const END_COUNT=LISTED ? length(CHAIN) : (END_YM[1]-2026)*12+END_YM[2]-4
const NEXT=LISTED ? Dict(CHAIN[i]=>CHAIN[i+1] for i in 1:length(CHAIN)-1) : nothing
# The 21-month print stays pinned; a longer window needs its own print SHA-256 in CAL7_WINDOW_PRINT_SHA.
const EXPECT_PRINT=(!LISTED && END_TEXT=="2028-01") ? "0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127" : get(ENV,"CAL7_WINDOW_PRINT_SHA","")
const EXPECT_LAYOUT=get(ENV,"CAL7_WINDOW_LAYOUT_SHA256","c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db")
const NAMES=Vector{Vector{String}}()
function load_names(path)
    @assert bytes2hex(sha256(read(path)))==EXPECT_LAYOUT "new layout pin"
    raw=read(path,String);@assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw)
    rows=readlines(path);@assert length(rows)==13
    @assert rows[1]=="month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7"
    empty!(NAMES)
    for (m,row) in enumerate(rows[2:end])
        f=String.(split(row,'\t';keepempty=true));@assert length(f)==8 && f[1]==string(m)
        @assert !isempty(f[2]) && all(isempty,f[5:8]);push!(NAMES,f[2:8])
    end
end
# Rebuilt independently from Dates and the original pure bottom-fold convention.
function board(y,m)
    b=fill(("","blank"),7,7)
    for c in 1:7
        t=NAMES[m][c];b[1,c]=(t,isempty(t) ? "band" : "month")
        b[2,c]=(WD[c],c in (1,7) ? "red" : "weekday")
    end
    off=mod(dayofweek(Date(y,m,1)),7);n=daysinmonth(Date(y,m,1))
    weeks=div(off+n-1,7)+1
    for d in 1:n
        week,c0=divrem(off+d-1,7);c=c0+1;ink=c in (1,7) ? "red" : "dark"
        if weeks<=5
            b[week+3,c]=(string(d),ink)
        elseif week!=5
            b[week+3,c]=((week==4 && d+7<=n) ? "$(d)/$(d+7)" : string(d),ink)
        end
    end
    b
end
function reading(s,angle,want)
    w,wi=want
    if isempty(w)
        return isempty(s.text) && s.ink==wi && (wi!="band" || angle==0) ? :upright : :bad
    end
    (isempty(s.text) || s.ink!=wi) && return :bad
    s.text==w && angle==0 && return :upright
    s.text=="0" && w=="0" && return :turned
    h=halfturn(s.text)
    !isnothing(h) && angle==2 && h==w && return :turned
    :bad
end
# Silent negative controls of the optics above; a wrong reading aborts as INVALID.
function optics_selfcheck()
    band=(text="",ink="band");blank=(text="",ink="blank");want_band=("","band");want_blank=("","blank")
    @assert reading(band,0,want_band)==:upright && reading(blank,0,want_blank)==:upright "optics self-check: positives"
    for a in (1,2,3)
        @assert reading(band,a,want_band)==:bad "optics self-check: turned band must be rejected"
    end
    @assert reading(blank,0,want_band)==:bad "optics self-check: blank must not serve as band"
    @assert reading(band,0,want_blank)==:bad "optics self-check: band must not serve as blank"
    @assert reading((text="1",ink="band"),0,want_band)==:bad "optics self-check: inked tile must not serve as band"
end
# Junction digests (own parser): the digest the start / end state must have; 64 hex or `identity`.
function own_join(name)
    t=get(ENV,name,"");isempty(t) && return nothing
    @assert t=="identity" || (length(t)==64 && all(c->c in "0123456789abcdef",t)) "junction digest is 64 hex or identity";t
end
const JSTART=own_join("CAL7_JOIN_START")
const JEND=own_join("CAL7_JOIN_END")
# Own chain reader (v1, or v2 with per-edge "wrong" and "hall" records); shares nothing with check.jl.
function read_chain_own(path)
    L=readlines(path);@assert length(L)>=4 && L[1] in ("cubistry.calendar7.chain.v1","cubistry.calendar7.chain.v2","cubistry.calendar7.chain.v3") && L[end]=="finish" "chain header or trailer"
    v2=L[1]!="cubistry.calendar7.chain.v1"
    f=split(L[2],'\t');@assert length(f)==5 && f[1]=="source" "source line"
    src=(root=parse(Int,f[2]),year=parse(Int,f[3]),month=parse(Int,f[4]),hash=String(f[5]))
    edges=[];i=3;startword=nothing
    if startswith(L[i],"start\t")
        @assert L[1]=="cubistry.calendar7.chain.v3" "free start block needs chain.v3"
        g=split(L[i],'\t');@assert length(g)==2;n=parse(Int,g[2]);@assert 0<=n<=100000 "start move count";i+=1;startword=Int[]
        for _ in 1:n
            g=split(L[i],'\t');@assert length(g)==3 && g[1]=="move" "start move line"
            gen=parse(Int,g[2]);q=parse(Int,g[3]);@assert 1<=gen<=21 && q in (-1,1,2) "start move"
            q==2 ? append!(startword,[gen,gen]) : push!(startword,q*gen);i+=1
        end
    end
    while L[i]!="finish"
        f=split(L[i],'\t');@assert length(f)==9 && f[1]=="edge" "edge line $i"
        j=i+1;word=Int[];wrong=Tuple{Int,Int}[];halls=Vector{Tuple{Int,Int}}[]
        while v2 && startswith(L[j],"wrong\t")
            g=split(L[j],'\t');@assert length(g)==3 "wrong line";rc=(parse(Int,g[2]),parse(Int,g[3]))
            @assert 1<=rc[1]<=7 && 1<=rc[2]<=7 && (isempty(wrong) || wrong[end][1]*7+wrong[end][2]<rc[1]*7+rc[2]) "wrong cells strictly increasing";push!(wrong,rc);j+=1
        end
        while v2 && startswith(L[j],"hall\t")
            g=split(L[j],'\t');@assert length(g)==2 "hall line"
            cs=[Tuple(parse.(Int,split(t,','))) for t in split(g[2],';')]
            @assert all(rc->1<=rc[1]<=7 && 1<=rc[2]<=7,cs) && all(k->cs[k][1]*7+cs[k][2]<cs[k+1][1]*7+cs[k+1][2],1:length(cs)-1) "hall cells strictly increasing";push!(halls,cs);j+=1
        end
        while L[j]!="end"
            g=split(L[j],'\t');@assert length(g)==3 && g[1]=="move" "move line $j"
            gen=parse(Int,g[2]);q=parse(Int,g[3]);@assert 1<=gen<=21 && q in (-1,1,2) "move $j"
            q==2 ? append!(word,[gen,gen]) : push!(word,q*gen);j+=1
        end
        push!(edges,(year=parse(Int,f[2]),month=parse(Int,f[3]),htm=parse(Int,f[4]),sh=String(f[8]),eh=String(f[9]),word=word,wrong=wrong,halls=halls));i=j+1
    end
    (src=src,edges=edges,v2=v2,startword=startword)
end
# Own rigid-rotation geometry for the Hall check: the 24 proper rotations as images of the basis vectors.
const ROTS=let seen=Set([((1,0,0),(0,1,0),(0,0,1))]),todo=[((1,0,0),(0,1,0),(0,0,1))]
    while !isempty(todo)
        t=pop!(todo)
        for ax in 1:3
            n=map(v->quarter(v,ax),t);n in seen || (push!(seen,n);push!(todo,n))
        end
    end
    @assert length(seen)==24;collect(seen)
end
rotv(v,R)=(v[1]*R[1][1]+v[2]*R[2][1]+v[3]*R[3][1],v[1]*R[1][2]+v[2]*R[2][2]+v[3]*R[3][2],v[1]*R[1][3]+v[2]*R[2][3]+v[3]*R[3][3])
bodyclass(p)=minimum(rotv(p,R) for R in ROTS)
function can_serve(st0,h,pos,want)
    fs=[s for s in st0 if s.pos==h]
    for R in ROTS
        rotv(h,R)==pos || continue
        f=[s for s in fs if rotv(s.normal,R)==(0,0,1)];length(f)==1 || continue
        a=findfirst(==(rotv(f[1].up,R)),UPS);a===nothing && continue
        reading(f[1],a-1,want)!=:bad && return true
    end
    false
end
function mismatch_cells(state,b)
    bad=Tuple{Int,Int}[]
    for r in 1:7,c in 1:7
        hits=[s for s in state if s.pos==(c-4,4-r,3) && s.normal==(0,0,1)];@assert length(hits)==1 "one front sticker per cell"
        s=only(hits);a=findfirst(==(s.up),UPS)
        (a===nothing || reading(s,a-1,b[r,c])==:bad) && push!(bad,(r,c))
    end
    bad
end
function hall_check(st0,b,wrong,halls)
    @assert !isempty(halls) "best-effort month needs Hall witnesses"
    homes=unique(s.pos for s in st0);used=Set{Tuple{Int,Int}}()
    for X in halls
        @assert !isempty(X) && isempty(intersect(used,X)) "disjoint nonempty Hall sets";union!(used,X)
        cls=unique(bodyclass((c-4,4-r,3)) for (r,c) in X);@assert length(cls)==1 "Hall set inside one body class"
        hs=[h for h in homes if bodyclass(h)==only(cls)]
        n=count(h->any(can_serve(st0,h,(c-4,4-r,3),b[r,c]) for (r,c) in X),hs)
        d=length(X)-n;@assert d>=1 "Hall set has a deficiency"
        @assert count(w->w in X,wrong)==d "wrong cells in a Hall set equal its deficiency"
    end
    @assert all(w->w in used,wrong) "Hall sets cover every wrong cell"
end
function verify(layout,printing,chain,statesdir)
    optics_selfcheck();load_names(layout);@assert bytes2hex(sha256(read(printing)))==EXPECT_PRINT "new print pin"
    original=read_print(printing);state=copy(original);ch=read_chain_own(chain);identity_hash=state_sha(original)
    free=ch.startword!==nothing;@assert !(free && ROOTED) "a free start has no root edge"
    free && (state=apply_word(state,ch.startword))
    initial=copy(state)
    SY,SM=ROOTM      # the chain starts at the identity pose; its front must show the root month
    @assert (ch.src.root,ch.src.year,ch.src.month)==(SM,SY,SM) && length(ch.edges)==END_COUNT-1 "root record and edge count"
    @assert check_front(state,board(SY,SM)).bad==0 (free ? "free start front is the first member" : "identity root front")
    @assert state_sha(state)==ch.src.hash "root digest"
    rule_selfcheck(state,board(SY,SM))
    encode(st)="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n"*join([join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t')*"\n" for s in st])
    @assert read(joinpath(statesdir,"state-01.tsv"),String)==encode(state)
    y,m=SY,SM;py,pm=SY,SM;total=0;words=Int[];nbest=0
    println("independent-root\t",SY,'-',lpad(SM,2,'0'),'\t',state_sha(state),"\tACCEPT")
    free && println("independent-start\tfree\t",length(ch.startword),'\t',state_sha(state))
    JSTART===nothing || (@assert(state_sha(state)==(JSTART=="identity" ? identity_hash : JSTART),"start junction digest");println("independent-join\tstart\t",state_sha(state)))
    for (i,e) in enumerate(ch.edges)
        y,m=LISTED ? NEXT[(y,m)] : (m==12 ? (y+1,1) : (y,m+1))
        @assert (e.year,e.month)==(y,m) "chronological adjacency"
        before=copy(state);@assert state_sha(before)==e.sh "source continuity"
        state=apply_word(state,e.word)
        bad=mismatch_cells(state,board(y,m))
        @assert bad==e.wrong "strict row-one-name front"
        isempty(bad) ? @assert(isempty(e.halls),"Hall witnesses without wrong cells") : hall_check(original,board(y,m),bad,e.halls)
        isempty(bad) || (nbest+=1)
        @assert state_sha(state)==e.eh && htm(e.word)==e.htm "end hash and HTM"
        @assert length(unique((s.pos,s.normal) for s in state))==294 "complete surface permutation"
        @assert apply_word(state,-reverse(e.word))==before "edge inverse restores full state"
        @assert read(joinpath(statesdir,"state-"*lpad(string(i+1),2,'0')*".tsv"),String)==encode(state)
        append!(words,e.word);total+=e.htm
        println("independent-edge\t",i,'\t',y,'\t',m,'\t',e.htm,'\t',state_sha(state),"\tACCEPT",(i==1 && ROOTED) ? "\tROOTEDGE" : (LISTED && (y*12+m)-(py*12+pm)>1 ? "\tBRIDGE" : ""),isempty(bad) ? "" : "\tBEST_EFFORT\t"*string(length(bad))*"\t"*join(["$r,$c" for (r,c) in bad],';'))
        py,pm=y,m
    end
    @assert (y,m)==END_YM && apply_word(state,-reverse(words))==initial
    JEND===nothing || (@assert(state_sha(state)==(JEND=="identity" ? identity_hash : JEND),"end junction digest");println("independent-join\tend\t",state_sha(state)))
    ch.v2 && println("independent-status\texact\t",END_COUNT-1-nbest,"\tbest_effort\t",nbest)
    println("independent-verdict\t",nbest==0 ? "ACCEPT_CHAIN" : "ACCEPT_BEST_EFFORT_CHAIN","\t",END_COUNT,'\t',END_COUNT-1,'\t',total,"\tINVERSE_PASS")
end
end
try
    @assert length(ARGS)==4 "verify_chain.jl LAYOUT PRINT CHAIN STATES_DIRECTORY"
    IndependentRowOne.verify(ARGS...)
catch e
    println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
end
