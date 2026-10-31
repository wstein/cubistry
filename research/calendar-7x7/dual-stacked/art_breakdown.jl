#!/usr/bin/env julia
# Descriptive listing, not a proof (Julia only; the checkers' inventory decides).
# Per-orbit demand by artwork class for a layout, with the PR #99 artwork rules
# (artwork() from ../orientation_screen.jl: HALF table, 6/9, O/0, I/1, any core
# rotation) and with modified glyph profiles for what-if comparisons.
include(joinpath(@__DIR__,"stacked_common.jl"))
const OBSTRUCTED=[(-3,-3),(-3,-1),(-3,1),(-2,-1),(-1,-1),(-1,0),(0,0)]
# Artwork class under a profile: half = Dict of half-turn glyph images (PR #99: HALF).
function art_class(g,ink,r,c,half;quarter=Dict{String,String}())
    k=orbit(r,c);x,y=c-4,4-r;q=0
    while (x,y)!=k;x,y=-y,x;q+=1;end
    g=replace(g,'O'=>'0','I'=>'1')
    g=="0" && return (g,0,ink)
    variants=Tuple{String,Int,String}[]
    for a in (k==(0,0) ? (0:3) : (q:q))
        push!(variants,(g,mod(a,4),ink))
        all(ch->haskey(half,ch),g) && push!(variants,(join(half[ch] for ch in reverse(collect(g))),mod(a+2,4),ink))
        haskey(quarter,g) && (push!(variants,(quarter[g],mod(a+1,4),ink));push!(variants,(quarter[g],mod(a+3,4),ink)))
    end
    minimum(variants)
end
function demand(goals,k,classify)
    peak=Dict{Any,Int};peak=Dict{Any,Int}();who=Dict{Any,Vector{Int}}();texts=Dict{Any,Set{String}}()
    blanks=0;bwho=Int[]
    for (id,t) in enumerate(goals)
        counts=Dict{Any,Int}();b=0
        for r in 1:7,c in 1:7
            orbit(r,c)==k || continue
            g,ink=t.board[r,c]
            if isempty(g);b+=1;continue;end
            a=classify(g,ink,r,c);counts[a]=get(counts,a,0)+1
            push!(get!(texts,a,Set{String}()),g*"@"*string(art_class(g,ink,r,c,Dict{Char,Char}())[2]))
        end
        for (a,n) in counts
            if n>get(peak,a,0);peak[a]=n;who[a]=[id];elseif n==peak[a];push!(who[a],id);end
        end
        if b>blanks;blanks=b;bwho=[id];elseif b==blanks;push!(bwho,id);end
    end
    (;peak,who,texts,blanks,bwho)
end
ym(goals,ids)=join(["$(goals[i].year)-$(lpad(goals[i].month,2,'0'))" for i in ids[1:min(3,end)]],",")*(length(ids)>3 ? ",+$(length(ids)-3)" : "")
function breakdown(variant,label)
    goals=stacked_goals(variant);std=(g,ink,r,c)->art_class(g,ink,r,c,HALF)
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        d=demand(goals,k,std);cap=capacity(k);need=sum(values(d.peak))
        println("orbit\t",label,'\t',k,"\tprinted=",need,"\tblank=",d.blanks,"\tcapacity=",cap,"\tslack=",cap-need-d.blanks)
        for a in sort!(collect(keys(d.peak)))
            ts=join(sort!(collect(d.texts[a])),"|");merged=length(d.texts[a])>1 ? "merged" : "single"
            println("class\t",label,'\t',k,'\t',ts,'\t',a[3],"\tangle=",a[2],'\t',merged,"\tpeak=",d.peak[a],"\tdisplays=",length(d.who[a]),"\te.g.=",ym(goals,d.who[a]))
        end
        println("blank\t",label,'\t',k,"\tpeak=",d.blanks,"\tdisplays=",length(d.bwho),"\te.g.=",ym(goals,d.bwho))
    end
end
function total(variant,classify)
    goals=stacked_goals(variant);res=Dict{Any,Tuple{Int,Int}}();sum_all=0;bad=Tuple{Int,Int}[]
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        d=demand(goals,k,classify);need=sum(values(d.peak));sum_all+=need;res[k]=(need,d.blanks)
        capacity(k)-need-d.blanks<0 && push!(bad,k)
    end
    (;res,sum_all,bad)
end
const ROWS=[("row1","F31=keep,S30=keep,S31=keep"),("row6","F31=keep,S30=bfold,S31=bfold"),("row7","F31=keep,S30=bfold,S31=bfold30"),
            ("row13","F31=bfold,S30=keep,S31=keep"),("row18","F31=bfold,S30=bfold,S31=bfold")]
println("# descriptive listing, not a proof; Julia only; class lines: orbit, printed glyph@angle (angle without half-turn merging) of every cell in the class, ink, class angle, merged or single, peak, displays at peak, examples")
breakdown(ROWS[1][2],"row1");breakdown(ROWS[5][2],"row18")
nohalf69=filter(p->!(p[1] in ('6','9')),HALF)
profiles=[("pr99",(g,i,r,c)->art_class(g,i,r,c,HALF)),
          ("no-6/9",(g,i,r,c)->art_class(g,i,r,c,nohalf69)),
          ("no-half-turn",(g,i,r,c)->art_class(g,i,r,c,Dict{Char,Char}()))]
for (name,f) in profiles,(row,v) in ROWS
    t=total(v,f)
    println("profile\t",name,'\t',row,"\tbound=",t.sum_all,"\tobstructed=",isempty(t.bad) ? "-" : join(t.bad," "),"\t",join(["$(k):$(t.res[k][1])+$(t.res[k][2])" for k in sort!(collect(keys(t.res)))],' '))
end
# What-if equalities for the corner orbit (Julia only, descriptive, not a proof).
whatif=[("N-quarter-turn-equal",(g,i,r,c)->art_class(g,i,r,c,HALF;quarter=Dict("N"=>"N"))),
        ("29-quarter-turn-equal",(g,i,r,c)->art_class(g,i,r,c,HALF;quarter=Dict("29"=>"29"))),
        ("black-24/31-as-red",(g,i,r,c)->art_class(g,g=="24/31" ? "red" : i,r,c,HALF)),
        ("stacked-also-top-date(rejected-context)",(g,i,r,c)->art_class(g=="23/30" ? "23" : g=="24/31" ? "24" : g,i,r,c,HALF))]
for (name,f) in whatif,(row,v) in ROWS
    t=total(v,f)
    println("whatif\t",name,'\t',row,"\tbound=",t.sum_all,"\tobstructed=",isempty(t.bad) ? "-" : join(t.bad," "),"\tcorner=",t.res[(-3,-3)][1],"+",t.res[(-3,-3)][2])
end
