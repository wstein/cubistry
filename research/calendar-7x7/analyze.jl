#!/usr/bin/env julia
# New research analysis; historical certificates and their verifiers are untouched.
using Dates, SHA

const ROOT = @__DIR__
const MONTHS = Dict(
    "EN" => ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    "DE" => ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"])
const DAYS = Dict("EN" => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
                  "DE" => ["MON", "DIE", "MIT", "DON", "FRE", "SAM", "SON"])

# A face's residual rotations classify sticker surfaces under proper cube rotations.
# Every noncentral surface orbit has 24 stickers; the fixed-center orbit has six.
function orbit(row, col)
    x, y = col - 4, 4 - row
    minimum([(x,y), (-y,x), (-x,-y), (y,-x)])
end
capacity(k) = k == (0,0) ? 6 : 24
offset(y,m,lang) = mod(dayofweek(Date(y,m,1)) - (lang == "DE" ? 1 : 0), 7)
red(col, lang) = lang == "DE" ? col in (6,7) : col in (1,7)

# Deliberately permissive for a lower bound: numerical 6 and 9 may share artwork.
# No other cross-glyph rotation or letter/digit ambiguity is assumed.
function token(text, ink)
    (text in ("6", "9") ? "6/9" : text, ink)
end

function board(y,m,lang; wrap=true, merge_six_nine=true)
    a = Matrix{Union{Nothing,Tuple{String,String}}}(nothing, 7, 7)
    for c in 1:7
        a[2,c] = (DAYS[lang][c], red(c,lang) ? "red" : "weekday")
        for r in 3:7
            a[r,c] = ("", "blank")
        end
    end
    off, n = offset(y,m,lang), daysinmonth(Date(y,m,1))
    for d in 1:n
        index = off + d - 1
        week, c = div(index,7), mod(index,7) + 1
        if week >= 5
            wrap || continue
            r = 3
            @assert a[r,c] == ("", "blank") "overflow collided with a date"
        else
            r = week + 3
        end
        ink = red(c,lang) ? "red" : "dark"
        a[r,c] = merge_six_nine ? token(string(d),ink) : (string(d),ink)
    end
    # Markers are intentionally omitted: adding them cannot lower this resource bound.
    a
end

function demands(first_year,last_year,lang,month_start)
    inventory = Dict{Tuple{Int,Int},Set{Tuple{String,String}}}()
    maxblank = Dict{Tuple{Int,Int},Int}()
    examples = Dict{Tuple{Int,Int},Tuple{Int,Int}}()
    for y in first_year:last_year, m in 1:12
        a = board(y,m,lang)
        if !isnothing(month_start)
            letters = collect(MONTHS[lang][m])
            for i in 1:3
                a[1,month_start+i-1] = (string(letters[i]), "month")
            end
        end
        blankcount = Dict{Tuple{Int,Int},Int}()
        for r in 1:7, c in 1:7
            t = a[r,c]
            isnothing(t) && continue # Year and other header fields relaxed away.
            k = orbit(r,c)
            if t[1] == ""
                blankcount[k] = get(blankcount,k,0) + 1
            else
                push!(get!(inventory,k,Set{Tuple{String,String}}()), t)
            end
        end
        for (k,n) in blankcount
            if n > get(maxblank,k,0)
                maxblank[k] = n
                examples[k] = (y,m)
            end
        end
    end
    rows = Any[]
    for k in sort!(collect(union(keys(inventory),keys(maxblank))))
        labels = sort!(collect(get(inventory,k,Set{Tuple{String,String}}())))
        blanks = get(maxblank,k,0)
        push!(rows, Dict("orbit"=>collect(k), "capacity"=>capacity(k),
            "nonblank_classes"=>length(labels), "simultaneous_blanks"=>blanks,
            "lower_bound"=>length(labels)+blanks,
            "labels"=>[collect(t) for t in labels],
            "blank_example"=>collect(get(examples,k,(first_year,1)))))
    end
    rows
end

function census(first,last,lang)
    n6, maxoverflow, center = 0, 0, Set{Int}()
    examples = Any[]
    for y in first:last,m in 1:12
        off,n = offset(y,m,lang),daysinmonth(Date(y,m,1))
        extra = max(0, off+n-35)
        n6 += extra > 0
        maxoverflow = max(maxoverflow,extra)
        push!(center,11-off)
        y == first && extra > 0 && push!(examples,Dict("year"=>y,"month"=>m,"overflow"=>extra))
    end
    Dict("first_year"=>first,"last_year"=>last,"language"=>lang,
        "months"=>12*(last-first+1),"six_week_months"=>n6,
        "maximum_overflow"=>maxoverflow,"center_dates"=>sort!(collect(center)),
        "first_year_examples"=>examples)
end

function json(io,x)
    if x isa AbstractDict
        print(io,'{'); first=true
        for k in sort!(collect(keys(x)))
            first || print(io,',');first=false;json(io,k);print(io,':');json(io,x[k])
        end
        print(io,'}')
    elseif x isa AbstractVector || x isa Tuple
        print(io,'[')
        for (i,v) in enumerate(x); i>1 && print(io,',');json(io,v);end
        print(io,']')
    elseif x isa AbstractString
        print(io,'"')
        for c in x
            if c=='"';print(io,"\\\"")
            elseif c=='\\';print(io,"\\\\")
            elseif c=='\n';print(io,"\\n")
            else;print(io,c)
            end
        end
        print(io,'"')
    elseif x === nothing; print(io,"null")
    else; print(io,x)
    end
end

function main()
    out=joinpath(ROOT,"evidence");mkpath(out)
    cases=Any[]
    for (first,last) in [(2000,2099),(2026,2026),(2026,2039),(2026,2099)],lang in ["DE","EN"]
        push!(cases,census(first,last,lang))
    end
    bounds=Any[]
    for last in [2026,2027,2028,2029,2039,2099], lang in ["DE","EN"], start in 1:5
        rows=demands(2026,last,lang,start)
        violations=filter(r->r["lower_bound"]>r["capacity"],rows)
        push!(bounds,Dict("first_year"=>2026,"last_year"=>last,"language"=>lang,
            "month_start_column"=>start,"orbits"=>rows,"violations"=>violations))
    end
    result=Dict("format"=>"cubistry.calendar7.orbit-audit.v1","julia_version"=>string(VERSION),
        "research_baseline"=>"7c05d28","physical_feasibility"=>"UNKNOWN",
        "canonical_checker_confirmation"=>"UNKNOWN",
        "scope"=>"Necessary inventory bounds only; not a legal-move witness or global print optimum.",
        "census"=>cases,"contiguous_month_header_bounds"=>bounds)
    open(joinpath(out,"analysis.json"),"w") do io;json(io,result);println(io);end
    open(joinpath(out,"calendar-months.tsv"),"w") do io
        println(io,"cubistry.calendar7.months.v1\t2026\t2099")
        for y in 2026:2099,m in 1:12
            println(io,join([y,m,dayofweek(Date(y,m,1))-1,daysinmonth(Date(y,m,1))],'\t'))
        end
    end
    for x in cases
        println(x["language"]," ",x["first_year"],"–",x["last_year"],": ",
            x["months"]," months; ",x["six_week_months"]," six-week; max overflow ",x["maximum_overflow"])
    end
    for last in [2026,2027,2028,2029,2039,2099],lang in ["DE","EN"]
        selected=filter(x->x["last_year"]==last && x["language"]==lang,bounds)
        println(lang," 2026–",last,": ",count(x->!isempty(x["violations"]),selected),
            "/5 contiguous month placements violate a necessary orbit bound")
    end
end
if abspath(PROGRAM_FILE) == (@__FILE__)
    main()
end
