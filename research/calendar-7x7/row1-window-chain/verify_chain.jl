#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Third replay: inherited independent verifier geometry, separate board/parser/optics.
# Frozen upright-beam/verify_chain.jl and strict print/root pins remain unchanged.
module IndependentRowOne
include(joinpath(@__DIR__,"..","upright-beam/verify_chain.jl"))
const EXPECT_PRINT="0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127"
const EXPECT_LAYOUT="c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db"
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
function verify(layout,printing,chain,statesdir)
    load_names(layout);@assert bytes2hex(sha256(read(printing)))==EXPECT_PRINT "new print pin"
    original=read_print(printing);state=copy(original);ch=read_chain_file(chain)
    @assert (ch.src.root,ch.src.year,ch.src.month)==(5,2026,5) && length(ch.edges)==20
    @assert check_front(state,board(2026,5)).bad==0 && state_sha(state)==ch.src.hash
    rule_selfcheck(state,board(2026,5))
    encode(st)="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n"*join([join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t')*"\n" for s in st])
    @assert read(joinpath(statesdir,"state-01.tsv"),String)==encode(state)
    y,m=2026,5;total=0;words=Int[]
    println("independent-root\t2026-05\t",state_sha(state),"\tACCEPT")
    for (i,e) in enumerate(ch.edges)
        y,m=m==12 ? (y+1,1) : (y,m+1)
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
        println("independent-edge\t",i,'\t',y,'\t',m,'\t',e.htm,'\t',state_sha(state),"\tACCEPT")
    end
    @assert (y,m)==(2028,1) && apply_word(state,-reverse(words))==original
    println("independent-verdict\tACCEPT_CHAIN\t21\t20\t",total,"\tINVERSE_PASS")
end
end
try
    @assert length(ARGS)==4 "verify_chain.jl LAYOUT PRINT CHAIN STATES_DIRECTORY"
    IndependentRowOne.verify(ARGS...)
catch e
    println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
end
