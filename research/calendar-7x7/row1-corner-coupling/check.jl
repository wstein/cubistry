#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# A fixed-print corner-body obstruction, not a search or a print generator.
include(joinpath(@__DIR__, "..", "pure-split-states", "pure_common.jl"))
include(joinpath(@__DIR__, "..", "upright-feasibility", "strict_rule.jl"))
apply_strict_rule!(Main)
include(joinpath(@__DIR__,"lemma.jl"))
const COUPLED_CELLS = [(1,1),(1,7),(7,1),(7,7)]
const COUPLED_MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"]
function coupled_labels(raw)
    @assert endswith(raw,"\n") && !occursin('\r',raw) "canonical LF layout"
    lines=split(chop(raw;tail=1),'\n')
    @assert length(lines)==13 && lines[1]=="month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7" "layout header and twelve rows"
    labels=Vector{Vector{String}}()
    for (m,line) in enumerate(lines[2:end])
        f=String.(split(line,'\t';keepempty=true))
        @assert length(f)==8 && f[1]==string(m) "ordered unique month rows"
        ss=f[2:8]
        @assert all(s->isempty(s)||occursin(r"^[A-Z]+$",s),ss) "uppercase labels"
        @assert !isempty(ss[1]) && all(isempty,ss[4:7]) "names in columns one to three"
        @assert join(ss)==COUPLED_MONTHS[m] "full English month name"
        push!(labels,ss)
    end
    labels
end
function coupled_angle(r,c)
    x,y=c-4,4-r;k=orbit(r,c);q=0
    while (x,y)!=k;x,y=-y,x;q+=1;end
    q
end
function coupled_optic(text,angle,ink)
    if isempty(text)
        @assert ink in ("band","blank") "empty artwork ink"
        return ink=="band" ? ("",mod(angle,4),"band") : ("",0,"blank")
    end
    image_normal(text,mod(angle,4),ink)
end
coupled_art(text,ink,r,c)=coupled_optic(text,coupled_angle(r,c),ink)
# Number of window months from May 2026 through WINDOW_END (YYYY-MM); the default is January 2028.
function window_end_months(window_end)
    m=match(r"^(\d{4})-(\d{2})\z",window_end);@assert !isnothing(m) "window end is YYYY-MM"
    y,mo=parse.(Int,m.captures);@assert 1<=mo<=12 "window end month"
    n=(y-2026)*12+mo-4;@assert n>=1 && (y,mo)<=(2100,1) "window end lies within May 2026 to January 2100"
    n
end
# Explicit ordered month list S (file with one YYYY-MM per line, strictly increasing, LF, pinned by SHA-256).
# CAL7_WINDOW_MONTHS=path and CAL7_WINDOW_MONTHS_SHA256=hex select it; it excludes WINDOW_END.
function read_month_list(path,expected_sha)
    @assert occursin(r"^[0-9a-f]{64}\z",expected_sha) "month list SHA-256 pin is 64 lowercase hex"
    bytes=read(path);@assert bytes2hex(sha256(bytes))==expected_sha "month list pin"
    raw=String(bytes);@assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw) && sizeof(raw)<=100000 "canonical month list UTF-8/LF"
    ms=Tuple{Int,Int}[]
    for t in split(chop(raw;tail=1),'\n')
        m=match(r"^(\d{4})-(\d{2})\z",t);@assert !isnothing(m) "month list row is YYYY-MM"
        y,mo=parse.(Int,m.captures);@assert 1<=mo<=12 && (1900,1)<=(y,mo)<=(2100,1) "month list row lies within 1900-01 to 2100-01"
        @assert isempty(ms) || ms[end]<(y,mo) "month list strictly increasing"
        push!(ms,(y,mo))
    end
    ms
end
# bridge[i] is true when the edge into member i+1 skips calendar months (a state edge across a gap).
month_list_bridges(ms)=[(b[1]*12+b[2])-(a[1]*12+a[2])>1 for (a,b) in zip(ms[1:end-1],ms[2:end])]
month_text((y,m))=string(y,'-',lpad(m,2,'0'))
# Chain root month (CAL7_ROOT_MONTH=YYYY-MM, 1900-01 .. 2100-01): the month whose board the identity pose shows. Default: first month of S.
# When it differs from the first month of S the chain has one extra root edge from the identity pose to S[1].
function chain_root_month(first_member)
    t=get(ENV,"CAL7_ROOT_MONTH","");isempty(t) && return first_member
    m=match(r"^(\d{4})-(\d{2})\z",t);@assert !isnothing(m) "root month is YYYY-MM"
    y,mo=parse.(Int,m.captures);@assert 1<=mo<=12 && (1900,1)<=(y,mo)<=(2100,1) "root month lies within 1900-01 to 2100-01"
    (y,mo)
end
# One goal (names-band profile) for any month, used for the root month outside the list.
function coupled_month_goal(labels,y,m)
    g=(year=y,month=m,board=stacked_board(y,m,PURE_VARIANT))
    for c in 1:7;t=labels[m][c];g.board[1,c]=(t,isempty(t) ? "band" : "month");end
    g
end
# Receipt line for a list-mode run (nothing for the WINDOW_END default, so legacy receipts are unchanged).
function month_list_line(ms)
    isempty(get(ENV,"CAL7_WINDOW_MONTHS","")) && return nothing
    string("months\t",ENV["CAL7_WINDOW_MONTHS_SHA256"],'\t',length(ms),'\t',month_text(ms[1]),'\t',month_text(ms[end]),'\t',count(month_list_bridges(ms)))
end
# Window months: the explicit list when CAL7_WINDOW_MONTHS is set, else May 2026 through the window end.
function window_month_list(;window_end=get(ENV,"WINDOW_END","2028-01"))
    path=get(ENV,"CAL7_WINDOW_MONTHS","")
    if isempty(path)
        @assert !haskey(ENV,"CAL7_WINDOW_MONTHS_SHA256") "month list pin without a month list"
        n=window_end_months(window_end);return [(year(d),month(d)) for d in Date(2026,5,1):Month(1):Date(2026,5,1)+Month(n-1)]
    end
    @assert !haskey(ENV,"WINDOW_END") "month list and WINDOW_END are exclusive"
    @assert haskey(ENV,"CAL7_WINDOW_MONTHS_SHA256") "month list needs CAL7_WINDOW_MONTHS_SHA256"
    read_month_list(path,ENV["CAL7_WINDOW_MONTHS_SHA256"])
end
function coupled_goals(labels,profile,domain;window_end=get(ENV,"WINDOW_END","2028-01"))
    @assert profile in ("names-band","names","scheme-a") "known profile"
    @assert domain in ("all","window") "known domain"
    goals=if domain=="all"
        reps=stacked_goals(PURE_VARIANT)
        shapes=Set((g.month,offset(g.year,g.month,"EN"),daysinmonth(Date(g.year,g.month,1))) for g in reps)
        @assert length(shapes)==91
        @assert all((m,offset(y,m,"EN"),daysinmonth(Date(y,m,1))) in shapes for y in 1900:2099 for m in 1:12) "2400-month shape coverage"
        [(year=g.year,month=g.month,board=copy(g.board)) for g in reps]
    else
        [(year=y,month=m,board=stacked_board(y,m,PURE_VARIANT)) for (y,m) in window_month_list(;window_end)]
    end
    if profile!="scheme-a"
        for g in goals,c in 1:7
            t=labels[g.month][c]
            g.board[1,c]=(t,isempty(t) ? (profile=="names-band" ? "band" : "blank") : "month")
        end
    end
    goals
end
function coupled_geometry()
    axes=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    hs=sort!([(x,y,z) for x in (-3,3) for y in (-3,3) for z in (-3,3)])
    @assert length(hs)==8 && length(ROTATIONS)==24
    @assert length(unique((rotate((1,0,0),r),rotate((0,1,0),r),rotate((0,0,1),r)) for r in ROTATIONS))==24 "24 distinct proper frames"
    for r in ROTATIONS
        x,y,z=rotate((1,0,0),r),rotate((0,1,0),r),rotate((0,0,1),r)
        xy=(x[2]*y[3]-x[3]*y[2],x[3]*y[1]-x[1]*y[3],x[1]*y[2]-x[2]*y[1])
        @assert xy==z "proper rotation only"
    end
    front_body_poses=0;frame_records=[]
    for h in hs
        ns=normal_faces(h);@assert length(ns)==3
        for r in ROTATIONS
            p=rotate(h,r)
            count_front=count(n->rotate(n,r)==FRONT_NORMAL,ns)
            @assert count_front==(p[3]==3 ? 1 : 0) "one visible face per front corner body"
            front_body_poses+=count_front
        end
        for n in ns,u in axes
            sum(n.*u)==0 || continue
            phases=Int[]
            for r in ROTATIONS
                rotate(n,r)==FRONT_NORMAL || continue
                p=rotate(h,r);rr,cc=4-p[2],p[1]+4
                @assert p[3]==3 && (rr,cc) in COUPLED_CELLS
                a=findfirst(==(rotate(u,r)),IMAGE_UPS)
                @assert !isnothing(a)
                push!(phases,mod(a-1+coupled_angle(rr,cc),4))
            end
            @assert length(phases)==4 && length(unique(phases))==1 "one canonical phase per physical face"
            push!(frame_records,(h,n,u,only(unique(phases))))
        end
    end
    @assert length(frame_records)==96 && front_body_poses==96
    hs,frame_records
end
function coupled_closure(text,ink)
    xs=[(text,ink)]
    if !isempty(text) && all(c->haskey(HALF,c),text)
        push!(xs,(join(HALF[c] for c in reverse(collect(text))),ink))
    end
    unique(xs)
end
function coupled_optics(tags)
    @assert coupled_optic("",0,"band")!=coupled_optic("",1,"band") "band line is asymmetric"
    @assert coupled_optic("",0,"band")!=coupled_optic("",0,"blank") "band differs from blank"
    @assert coupled_optic("29",0,"red")!=coupled_optic("29",3,"red") "red 29 transport remains distinct"
    @assert coupled_optic("6",0,"red")==coupled_optic("9",2,"red") "strict six-nine twin"
    @assert coupled_optic("O",0,"month")!=coupled_optic("0",0,"month") "no letter-digit alias"
    @assert coupled_optic("O",0,"month")!=coupled_optic("O",2,"month") "upright O"
    checked=0
    for (g,ink) in unique(vcat(tags,[("0","red"),("6","red"),("9","red"),("O","month")]))
        for (s,si) in coupled_closure(g,ink),a in 0:3
            coupled_optic(s,a,si)==coupled_optic(g,0,ink) || continue
            for shift in 0:3
                @assert coupled_optic(s,a+shift,si)==coupled_optic(g,shift,ink) "optical equivalence is rotation-congruent"
                checked+=1
            end
        end
    end
    checked
end
function coupled_check(path,profile,domain)
    raw=read(path,String);labels=coupled_labels(raw)
    goals=coupled_goals(labels,profile,domain)
    @assert all(Date(2000,1,1)<=Date(g.year,g.month,1)<=Date(2100,1,1) for g in goals) "targets lie within requested extended domain"
    homes,frames=coupled_geometry()
    per=[[coupled_art(g.board[r,c]...,r,c) for (r,c) in COUPLED_CELLS] for g in goals]
    classes=sort!(unique(vcat(per...)))
    peaks=Dict(a=>maximum(count(==(a),xs) for xs in per) for a in classes)
    tags=unique([g.board[r,c] for g in goals for (r,c) in COUPLED_CELLS])
    optic_checks=coupled_optics(tags)
    @assert coupled_art("29","red",7,1)!=coupled_art("29","red",7,7)
    capacity=length(homes)*3;required=sum(values(peaks))
    println("input\t",bytes2hex(sha256(codeunits(raw))),"\t",profile,"\t",domain,"\t",length(goals))
    ml=month_list_line([(g.year,g.month) for g in goals]);isnothing(ml) || println(ml)
    println("subset\t2000-01\t2100-01\t",length(goals))
    println("geometry\t24\t",length(homes),"\t3\t",capacity,"\t",length(frames),"\t96\t",optic_checks)
    for (h,n,u,phase) in frames
        println("frame\t",join(h,','),'\t',join(n,','),'\t',join(u,','),'\t',phase)
    end
    for (i,g) in enumerate(goals)
        println("target\t",i,'\t',g.year,'\t',g.month,'\t',join([join(a,'~') for a in per[i]],'\t'))
    end
    for a in classes
        first_peak=findfirst(xs->count(==(a),xs)==peaks[a],per)
        println("class\t",join(a,'\t'),'\t',peaks[a],'\t',first_peak)
    end
    anchors=[a for a in classes if peaks[a]==1 && all(count(==(a),xs)==1 for xs in per)]
    println("demand\t",length(classes),'\t',required,'\t',capacity)
    for a in anchors
        # At equality every demanded copy consumes a physical surface, so an
        # always-visible class with peak one has exactly one physical copy.
        available_other=(length(homes)-1)*3
        needed_other=required-1
        present=count(xs->a in xs,per)
        applies=corner_anchor_contradiction(required,length(homes),3,peaks[a],present,length(goals))
        println("anchor\t",join(a,'\t'),"\t1\t",length(goals),'\t',needed_other,'\t',available_other,'\t',applies ? "CONTRADICTION" : "INAPPLICABLE")
    end
    obstructed=any(corner_anchor_contradiction(required,length(homes),3,peaks[a],count(xs->a in xs,per),length(goals)) for a in anchors)
    println("verdict\t",obstructed ? "UNSAT" : "UNKNOWN","\tfixed-print-corner-body-matching\t",obstructed ? "unique-always-visible-face" : "lemma-not-applicable")
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS)==3 "check.jl LAYOUT_TSV names-band|names|scheme-a all|window"
        coupled_check(ARGS...)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
