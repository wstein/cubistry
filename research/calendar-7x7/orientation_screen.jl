#!/usr/bin/env julia
# Stronger necessary bounds preserve position/artwork rotation compatibility.
# This is a specified optimistic font profile, not a final licensed font or SAT proof.
include(joinpath(@__DIR__,"analyze.jl"))

const HALF = Dict('0'=>'0','1'=>'1','2'=>'2','5'=>'5','6'=>'9','9'=>'6','8'=>'8',
                  'H'=>'H','N'=>'N','S'=>'S','X'=>'X','Z'=>'Z')
function artwork(g,ink,row,col)
    k=orbit(row,col);x,y=col-4,4-row;q=0
    while (x,y)!=k; x,y=-y,x;q+=1;end
    g=replace(g,'O'=>'0','I'=>'1') # circular zero/O and bar one/I permitted.
    g=="0" && return (g,0,ink)
    rotations=k==(0,0) ? (0:3) : (q:q)
    variants=Tuple{String,Int,String}[]
    for a in rotations
        push!(variants,(g,mod(a,4),ink))
        chars=collect(g)
        if all(c->haskey(HALF,c),chars)
            h=join(HALF[c] for c in reverse(chars))
            push!(variants,(h,mod(a+2,4),ink))
        end
    end
    minimum(variants)
end

function oriented_base(last,lang)
    labels=Dict{Tuple{Int,Int},Set{Tuple{String,Int,String}}}()
    blanks=Dict{Tuple{Int,Int},Int}()
    for y in 2026:last,m in 1:12
        a=board(y,m,lang;merge_six_nine=false)
        counts=Dict{Tuple{Int,Int},Int}()
        for r in 2:7,c in 1:7
            g,ink=a[r,c];k=orbit(r,c)
            set=get!(labels,k,Set{Tuple{String,Int,String}}())
            if isempty(g);counts[k]=get(counts,k,0)+1
            else;push!(set,artwork(g,ink,r,c))
            end
        end
        for (k,n) in counts;blanks[k]=max(get(blanks,k,0),n);end
    end
    labels,blanks
end

function oriented_header(base,blank_base,last,lang,cols,year_start,ink;prefix=true)
    free=setdiff(Set(1:7),Set([cols...,year_start,year_start+1]))
    quote_col=year_start-1
    prefix && !(quote_col in free) && return nothing
    prefix && delete!(free,quote_col)
    labels=Dict(k=>copy(v) for (k,v) in base);blanks=copy(blank_base)
    for i in 1:3,month in MONTHS[lang]
        c=cols[i];push!(labels[orbit(1,c)],artwork(string(collect(month)[i]),"month",1,c))
    end
    for y in 2026:last,(c,d) in [(year_start,div(y%100,10)),(year_start+1,y%10)]
        push!(labels[orbit(1,c)],artwork(string(d),ink,1,c))
    end
    prefix && push!(labels[orbit(1,quote_col)],artwork("'","prefix",1,quote_col))
    for c in free;k=orbit(1,c);blanks[k]=get(blanks,k,0)+1;end
    rows=[Dict("orbit"=>collect(k),"capacity"=>capacity(k),"nonblank_classes"=>length(v),
        "simultaneous_blanks"=>get(blanks,k,0),"lower_bound"=>length(v)+get(blanks,k,0))
        for (k,v) in sort!(collect(labels);by=first)]
    any(r->r["lower_bound"]>r["capacity"],rows) && return nothing
    Dict("language"=>lang,"first_year"=>2026,"last_year"=>last,"month_columns"=>collect(cols),
        "year_columns"=>[year_start,year_start+1],"year_ink"=>ink,"prefix"=>prefix,
        "orbits"=>rows,"physical_feasibility"=>"UNKNOWN")
end

function main_oriented()
    counts=Any[];best=Dict{String,Any}();tested=0
    for last in 2026:2099,lang in ["DE","EN"]
        base,blanks=oriented_base(last,lang);wins=Any[]
        for i in 1:5,j in i+1:6,k in j+1:7,start in 1:6,ink in ["dark","red","year"],prefix in [true,false]
            cols=(i,j,k);(start in cols || start+1 in cols) && continue
            tested+=1
            candidate=oriented_header(base,blanks,last,lang,cols,start,ink;prefix)
            isnothing(candidate) || push!(wins,candidate)
        end
        push!(counts,Dict("language"=>lang,"last_year"=>last,"passing_relaxations"=>length(wins)))
        isempty(wins) || (best[lang]=wins)
    end
    result=Dict("format"=>"cubistry.calendar7.oriented-header-screen.v1","first_year"=>2026,
        "candidate_evaluations"=>tested,"physical_feasibility"=>"UNKNOWN",
        "scope"=>"Necessary oriented-artwork inventory only; no coupled-cubie placement or legal-move witness.",
        "font_profile"=>"Circular 0/O; bar 1/I; 180-degree 2,5,8,H,N,S,X,Z; 6/9 dual; all other glyphs orientation-sensitive.",
        "prefix_results"=>counts,"largest_passing_prefixes"=>best)
    open(joinpath(ROOT,"evidence","oriented-header-screen.json"),"w") do io;json(io,result);println(io);end
    println("Oriented header relaxation evaluations: ",tested)
    for lang in ["DE","EN"]
        if haskey(best,lang)
            wins=best[lang];println(lang,": last passing prefix end ",wins[1]["last_year"],
                "; ",length(wins)," relaxations; UNKNOWN physical feasibility")
            for x in wins[1:min(end,4)]
                println("  month columns ",x["month_columns"],", year ",x["year_columns"],
                    ", ink ",x["year_ink"],", apostrophe ",x["prefix"])
            end
        else
            println(lang,": no header passes this necessary relaxation, even for 2026")
        end
    end
end
if abspath(PROGRAM_FILE) == (@__FILE__)
    main_oriented()
end
