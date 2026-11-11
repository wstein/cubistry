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
        t=Tuple(parse.(Int,mm.captures));@assert 1<=t[2]<=12 && (2026,1)<=t<=(2100,1) "list row in range"
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
@assert 1<=END_YM[2]<=12 && END_YM>=(2026,5) && END_YM<=(2100,1) "window end lies within May 2026 to January 2100"
const END_COUNT=LISTED ? length(MONTHS) : (END_YM[1]-2026)*12+END_YM[2]-4
const NEXT=LISTED ? Dict(MONTHS[i]=>MONTHS[i+1] for i in 1:length(MONTHS)-1) : nothing
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
function verify(layout,printing,chain,statesdir)
    optics_selfcheck();load_names(layout);@assert bytes2hex(sha256(read(printing)))==EXPECT_PRINT "new print pin"
    original=read_print(printing);state=copy(original);ch=read_chain_file(chain)
    @assert !LISTED || MONTHS[1]==(2026,5) "chain root month is May 2026"
    @assert (ch.src.root,ch.src.year,ch.src.month)==(5,2026,5) && length(ch.edges)==END_COUNT-1
    @assert check_front(state,board(2026,5)).bad==0 && state_sha(state)==ch.src.hash
    rule_selfcheck(state,board(2026,5))
    encode(st)="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n"*join([join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t')*"\n" for s in st])
    @assert read(joinpath(statesdir,"state-01.tsv"),String)==encode(state)
    y,m=2026,5;py,pm=2026,5;total=0;words=Int[]
    println("independent-root\t2026-05\t",state_sha(state),"\tACCEPT")
    for (i,e) in enumerate(ch.edges)
        y,m=LISTED ? NEXT[(y,m)] : (m==12 ? (y+1,1) : (y,m+1))
        @assert (e.year,e.month)==(y,m) "chronological adjacency"
        before=copy(state);@assert state_sha(before)==e.sh "source continuity"
        state=apply_word(state,e.word)
        result=check_front(state,board(y,m))
        @assert result.bad==0 && result.other==0 "strict row-one-name front"
        @assert state_sha(state)==e.eh && htm(e.word)==e.htm "end hash and HTM"
        @assert length(unique((s.pos,s.normal) for s in state))==294 "complete surface permutation"
        @assert apply_word(state,-reverse(e.word))==before "edge inverse restores full state"
        @assert read(joinpath(statesdir,"state-"*lpad(string(i+1),2,'0')*".tsv"),String)==encode(state)
        append!(words,e.word);total+=e.htm
        println("independent-edge\t",i,'\t',y,'\t',m,'\t',e.htm,'\t',state_sha(state),"\tACCEPT",LISTED && (y*12+m)-(py*12+pm)>1 ? "\tBRIDGE" : "")
        py,pm=y,m
    end
    @assert (y,m)==END_YM && apply_word(state,-reverse(words))==original
    println("independent-verdict\tACCEPT_CHAIN\t",END_COUNT,'\t',END_COUNT-1,'\t',total,"\tINVERSE_PASS")
end
end
try
    @assert length(ARGS)==4 "verify_chain.jl LAYOUT PRINT CHAIN STATES_DIRECTORY"
    IndependentRowOne.verify(ARGS...)
catch e
    println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
end
