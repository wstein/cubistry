#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# INDEPENDENT replay verifier for the strict upright front rule. It shares NO code with
# the solver or with the research checkers: it parses the print itself, rebuilds the 91
# front boards from the calendar rules itself, applies the moves on the 294 stickers
# with its own geometry, and applies the strict front rule itself.
#   verify_moves.jl PRINT MOVES_TSV      (MOVES_TSV: id year month status htm word seconds)
# Output: lines "move-check ..." per display, "move-stats ..." and a verdict line.
# Exit code 1 unless all 91 displays are accepted.
using Dates, SHA

# ---- print: 294 stickers (home, normal, up, text, ink) -------------------------------
function read_print(path)
    lines=split(read(path,String),'\n';keepempty=false)
    @assert lines[1]=="sticker\tpiece\thome\tnormal\tup\ttext\tink"
    v(s)=Tuple(parse.(Int,split(s,',')))
    st=[]
    for (i,l) in enumerate(lines[2:end])
        f=split(l,'\t';keepempty=true); @assert length(f)==7 && parse(Int,f[1])==i
        push!(st,(id=i,piece=parse(Int,f[2]),pos=v(f[3]),normal=v(f[4]),up=v(f[5]),text=String(f[6]),ink=String(f[7])))
    end
    @assert length(st)==294 && length(unique((s.pos,s.normal) for s in st))==294
    st
end

# ---- the front board of one month (pure split, month letters scheme A) ---------------
const MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
const WD=["SUN","MON","TUE","WED","THU","FRI","SAT"]
function board(y,m)
    b=fill(("","blank"),7,7)
    s0=m<=9 ? 5 : 2
    for i in 1:3; b[1,s0+i-1]=(string(MON[m][i]),"month"); end
    for c in 1:7; b[2,c]=(WD[c],c==1||c==7 ? "red" : "weekday"); end
    off=mod(dayofweek(Date(y,m,1)),7); n=daysinmonth(Date(y,m,1)); weeks=div(off+n-1,7)+1
    for d in 1:n
        week,c0=divrem(off+d-1,7); c=c0+1; ink=(c==1||c==7) ? "red" : "dark"
        if weeks<=5
            b[week+3,c]=(string(d),ink)
        elseif week==5
            continue                                   # printed under d-7
        else
            text=(week==4 && d+7<=n) ? "$(d)/$(d+7)" : string(d)
            b[week+3,c]=(text,ink)
        end
    end
    b
end
function all_types()
    types=Dict{String,Tuple{Int,Int}}()
    for y in 2026:2099,m in 1:12
        k=join(string.(board(y,m)),"|"); haskey(types,k) || (types[k]=(y,m))
    end
    types
end

# ---- own move geometry (axis 1..3, layers -3..-1,1..3, 7 = whole cube) ---------------
quarter(v,axis)=axis==1 ? (v[1],-v[3],v[2]) : axis==2 ? (v[3],v[2],-v[1]) : (-v[2],v[1],v[3])
const LAYERS=(-3,-2,-1,1,2,3)
function turn(state,g)           # one quarter turn of generator g (1..21)
    axis=div(g-1,7)+1; slot=mod(g-1,7)+1
    [ (slot==7 || s.pos[axis]==LAYERS[slot]) ?
        (id=s.id,piece=s.piece,pos=quarter(s.pos,axis),normal=quarter(s.normal,axis),up=quarter(s.up,axis),text=s.text,ink=s.ink) : s
      for s in state]
end
function apply_word(state,word)
    for g in word
        @assert g!=0 && 1<=abs(g)<=21 "generator outside 1..21 (no layer 0)"
        for _ in 1:(g>0 ? 1 : 3); state=turn(state,abs(g)); end
    end
    state
end
# HTM: merge adjacent equal generators (net quarter turns mod 4), whole-cube rotations free.
function htm(word)
    groups=Tuple{Int,Int}[]
    for g in word
        a=abs(g); t=sign(g)
        if !isempty(groups) && first(last(groups))==a; t+=last(pop!(groups)); end
        t=mod(t,4); t!=0 && push!(groups,(a,t))
    end
    count(x->x[1]%7!=0,groups)
end

# ---- strict front rule ----------------------------------------------------------------
const UPS=[(0,1,0),(-1,0,0),(0,-1,0),(1,0,0)]
const HALFMAP=Dict('0'=>'0','6'=>'9','9'=>'6')     # only the digit 0 and 6<->9
halfturn(t)=all(c->haskey(HALFMAP,c),t) ? join(HALFMAP[c] for c in reverse(t)) : nothing
# Returns :upright, :turned (accepted half-turn reading: 6 as 9 etc., 0 any turn) or :bad.
function reading(s,angle,want)
    w,wi=want
    isempty(w) && return (isempty(s.text) ? :upright : :bad)
    (isempty(s.text) || s.ink!=wi) && return :bad
    s.text==w && angle==0 && return :upright
    s.text=="0" && w=="0" && return :turned                 # circular zero
    h=halfturn(s.text)
    !isnothing(h) && angle==2 && h==w && return :turned     # 6 as 9, 9 as 6
    :bad
end
function check_front(state,b)
    bad=0; turned=0; zero_turned=0; other_turned=0
    for r in 1:7,c in 1:7
        hits=[s for s in state if s.pos==(c-4,4-r,3) && s.normal==(0,0,1)]
        @assert length(hits)==1
        s=only(hits); angle=findfirst(==(s.up),UPS); angle===nothing && return (bad=49,turned=0,other=0,why="sticker up not in front plane")
        k=reading(s,angle-1,b[r,c])
        k==:bad && (bad+=1)
        if k==:turned
            turned+=1
            s.text=="0" ? (zero_turned+=1) : (s.text in ("6","9") ? nothing : (other_turned+=1))
        end
    end
    (bad=bad,turned=turned,other=other_turned+zero_turned*0,why="")
end

function main(print_path,moves_path)
    st0=read_print(print_path)
    types=all_types(); @assert length(types)==91 "expected 91 distinct display boards"
    rows=[split(l,'\t') for l in readlines(moves_path)[2:end] if !isempty(l)]
    @assert length(rows)==91 "need one word per display (91)"
    seen=Set{String}(); lens=Int[]; fails=0; turned_total=0; six9=0
    println("move-header\tid\tyear\tmonth\tverdict\thtm\tturned_6_9\tbad_cells\tdigest")
    for f in rows
        id=parse(Int,f[1]); y=parse(Int,f[2]); m=parse(Int,f[3])
        b=board(y,m); key=join(string.(b),"|")
        @assert haskey(types,key) && !(key in seen) "display $id duplicates or is not one of the 91 boards"
        push!(seen,key)
        verdict="ACCEPT"; h=-1; res=(bad=-1,turned=0,other=0,why="")
        if f[4] in ("FOUND_GLOBAL","FOUND_ORBIT") || startswith(f[4],"FOUND_HYBRID")
            word=parse.(Int,split(f[6],','))
            state=apply_word(st0,word)
            @assert length(unique((s.pos,s.normal) for s in state))==294
            h=htm(word); h==parse(Int,f[5]) || (verdict="REJECT_HTM_MISMATCH")
            res=check_front(state,b)
            res.bad==0 || (verdict="REJECT_FRONT")
            # every sticker still carries its print unchanged (moves are rigid): identity of text kept
            io=IOBuffer(); for s in state; println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t')); end
            dig=bytes2hex(sha256(take!(io)))
        else
            verdict="REJECT_NO_WORD"; dig="-"
        end
        verdict=="ACCEPT" || (fails+=1)
        verdict=="ACCEPT" && (push!(lens,h); turned_total+=res.turned; six9+=res.turned)
        println("move-check\t",id,'\t',y,'\t',m,'\t',verdict,'\t',h,'\t',res.turned,'\t',res.bad,'\t',dig)
    end
    @assert length(seen)==91
    if !isempty(lens)
        s=sort(lens); n=length(s); med=isodd(n) ? s[(n+1)÷2] : (s[n÷2]+s[n÷2+1])/2
        println("move-stats\tn=",n,"\tmedian=",med,"\tmean=",round(sum(s)/n;digits=2),"\tmin=",s[1],"\tmax=",s[end],"\ttotal=",sum(s))
    end
    println("move-turned-readings\t",turned_total,"\t(6 shown as 9, 9 as 6 and 0 only; no other turned reading is accepted)")
    println("move-verdict\t",fails==0 ? "ACCEPT_ALL_91" : "REJECT",'\t',91-fails,'\t',fails)
    exit(fails==0 ? 0 : 1)
end
if abspath(PROGRAM_FILE)==(@__FILE__); main(ARGS[1],ARGS[2]); end
