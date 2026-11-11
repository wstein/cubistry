# SPDX-License-Identifier: AGPL-3.0-or-later
# Explicit ordered month list for the fixed-print checkers (Julia only, not yet Flix-confirmed).
# Setting WINDOW_MONTHS="YYYY-MM,YYYY-MM,..." makes the `window` domain of the corner-coupling
# and window-print checkers use exactly that list, in that order. The first month is the root
# month (the front of the print). Without WINDOW_MONTHS the window is May 2026 through WINDOW_END,
# as before. Redefines `coupled_goals` of row1-corner-coupling/check.jl.
include(joinpath(@__DIR__,"..","..","..","row1-window-print","common.jl"))
function parse_months(s)
    ms=Tuple{Int,Int}[]
    for t in split(s,',')
        m=match(r"^(\d{4})-(\d{2})\z",strip(t));@assert !isnothing(m) "month is YYYY-MM"
        y,mo=parse.(Int,m.captures);@assert 1<=mo<=12 && (2026,1)<=(y,mo)<=(2100,1) "month lies within 2026-01 to 2100-01"
        push!(ms,(y,mo))
    end
    @assert !isempty(ms) && length(unique(ms))==length(ms) "non-empty list of distinct months"
    ms
end
function coupled_goals(labels,profile,domain;window_end=get(ENV,"WINDOW_END","2028-01"))
    @assert profile in ("names-band","names","scheme-a") "known profile"
    @assert domain=="window" "months.jl supports only the window domain"
    s=get(ENV,"WINDOW_MONTHS","")
    ms=if isempty(s)
        n=window_end_months(window_end);[(year(d),month(d)) for d in Date(2026,5,1):Month(1):Date(2026,5,1)+Month(n-1)]
    else
        parse_months(s)
    end
    goals=[(year=y,month=m,board=stacked_board(y,m,PURE_VARIANT)) for (y,m) in ms]
    if profile!="scheme-a"
        for g in goals,c in 1:7
            t=labels[g.month][c]
            g.board[1,c]=(t,isempty(t) ? (profile=="names-band" ? "band" : "blank") : "month")
        end
    end
    goals
end
# Corner demand for a month list: (classes, required, peaks, band peak, lemma verdict).
function corner_demand(labels,ms)
    goals=[(year=y,month=m,board=stacked_board(y,m,PURE_VARIANT)) for (y,m) in ms]
    for g in goals,c in 1:7
        t=labels[g.month][c];g.board[1,c]=(t,isempty(t) ? "band" : "month")
    end
    per=[[coupled_art(g.board[r,c]...,r,c) for (r,c) in COUPLED_CELLS] for g in goals]
    classes=sort!(unique(vcat(per...)));peaks=Dict(a=>maximum(count(==(a),xs) for xs in per) for a in classes)
    required=sum(values(peaks));blank=get(peaks,("",0,"blank"),0)
    anchors=[a for a in classes if peaks[a]==1 && all(count(==(a),xs)==1 for xs in per)]
    lemma=any(corner_anchor_contradiction(required,8,3,peaks[a],count(xs->a in xs,per),length(goals)) for a in anchors)
    (;n=length(goals),classes=length(classes),required,blank,lemma,peaks)
end
