#!/usr/bin/env julia
# Candidate semantics and necessary inventory only. No SAT/UNSAT verdict.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))
function compact_board(year,month;all_saturdays=false)
    offset_value=offset(year,month,"EN");n=daysinmonth(Date(year,month,1))
    fold_first=offset_value==6 && (all_saturdays || n>=30)
    fold_last=offset_value==5 && n==31
    a=board(year,month,"EN";wrap=false,merge_six_nine=false)
    for r in 3:7,c in 1:7;a[r,c]=("","blank");end
    for day in 1:n
        index=offset_value+day-1;week,col=div(index,7),mod(index,7)+1
        if fold_first
            day==1 && continue
            week-=1
        end
        fold_last && day==31 && continue
        r=week+3;@assert 3<=r<=7
        text=fold_first && day==8 ? "1/8" : fold_last && day==24 ? "24/31" : string(day)
        a[r,col]=(text,red(col,"EN") ? "red" : "dark")
    end
    start=month<=9 ? 5 : 1
    for c in 1:7;a[1,c]=start<=c<=start+2 ? (string(collect(MONTHS["EN"][month])[c-start+1]),"month") : ("","blank");end
    # Both labels are real dates, sharing the weekday, not alternative values.
    seen=Int[]
    for r in 3:7,c in 1:7
        text,_=a[r,c];isempty(text)&&continue
        for value in parse.(Int,split(text,'/'))
            @assert mod(offset_value+value-1,7)+1==c
            push!(seen,value)
        end
    end
    @assert sort(seen)==collect(1:n)
    a
end
function compact_screen(all_saturdays)
    goals=Any[];seen=Set{String}()
    for year in 2026:2099,month in 1:12
        a=compact_board(year,month;all_saturdays)
        signature=join(string.(a),';')
        signature in seen && continue;push!(seen,signature);push!(goals,(year=year,month=month,board=a))
    end
    required=Dict{Tuple{Int,Int},Dict{Tuple{String,Int,String},Int}}();blanks=Dict{Tuple{Int,Int},Int}()
    for t in goals
        counts=Dict{Tuple{Int,Int},Dict{Tuple{String,Int,String},Int}}();empty=Dict{Tuple{Int,Int},Int}()
        for r in 1:7,c in 1:7
            text,ink=t.board[r,c];key=orbit(r,c)
            if isempty(text);empty[key]=get(empty,key,0)+1
            else
                art=artwork(text,ink,r,c);items=get!(counts,key,Dict{Tuple{String,Int,String},Int}());items[art]=get(items,art,0)+1
            end
        end
        for(key,items)in counts
            maxima=get!(required,key,Dict{Tuple{String,Int,String},Int}())
            for(art,n)in items;maxima[art]=max(get(maxima,art,0),n);end
        end
        for(key,n)in empty;blanks[key]=max(get(blanks,key,0),n);end
    end
    println("profile\t",all_saturdays ? "all-Saturday-first-fold" : "six-week-only-fold","\t",length(goals))
    for(key,items)in sort!(collect(required);by=first)
        nonblank=sum(values(items));blank=get(blanks,key,0);cap=capacity(key)
        println("necessary-orbit\t",join(key,','),'\t',nonblank,'\t',blank,'\t',cap,'\t',nonblank+blank>cap ? "EXCEEDS_CAPACITY" : "NOT_OBSTRUCTED")
    end
    println("UNKNOWN: these are unconfirmed necessary bounds, not a coupled legal-move proof.")
end
if abspath(PROGRAM_FILE)==@__FILE__;compact_screen(false);compact_screen(true);end
