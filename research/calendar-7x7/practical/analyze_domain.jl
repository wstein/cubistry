#!/usr/bin/env julia
# Untrusted experiment: artwork differences are NOT legal-move counts or proofs.
using Dates, SHA, Statistics
const MONTH_NAMES = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
const WEEK_NAMES = ("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
function calendar_art(date)
    y, m = year(date), month(date)
    a = fill(("", "blank"), 7, 7)
    start = m <= 9 ? 5 : 1
    for i in 1:3
        a[1, start + i - 1] = (string(MONTH_NAMES[m][i]), "month")
    end
    for c in 1:7
        a[2,c] = (WEEK_NAMES[c], c in (1,7) ? "red" : "weekday")
    end
    offset = mod(dayofweek(date), 7)
    for d in 1:daysinmonth(date)
        slot = offset + d - 1
        c = mod(slot,7) + 1
        r = div(slot,7) + 3
        overflow = r > 7
        overflow && (r = 3)
        @assert a[r,c] == ("", "blank")
        a[r,c] = (string(d) * (overflow ? "↶" : ""), c in (1,7) ? "red" : "dark")
    end
    a
end
# Proper signed rotations, independently enumerated; preserves the chiral center orbits.
function piece_orbit(p)
    choices = NTuple{3,Int}[]
    for perm in ((1,2,3),(1,3,2),(2,1,3),(2,3,1),(3,1,2),(3,2,1))
        signperm = iseven(sum(perm[i] > perm[j] for i in 1:3 for j in i+1:3)) ? 1 : -1
        for a in (-1,1), b in (-1,1), c in (-1,1)
            signperm*a*b*c == 1 || continue
            push!(choices, (a*p[perm[1]], b*p[perm[2]], c*p[perm[3]]))
        end
    end
    @assert length(choices) == 24
    minimum(choices)
end
orbit_label(p) = join(p, ',')
function run(out)
    mkpath(out)
    dates = collect(Date(2026,1,1):Month(1):Date(2099,12,1))
    @assert length(dates) == 888
    boards = calendar_art.(dates)
    keys = sort!(unique(piece_orbit((c-4,4-r,3)) for r in 1:7 for c in 1:7))
    @assert length(keys) == 11
    rows = Any[]
    open(joinpath(out,"transitions.tsv"), "w") do io
        println(io, join(vcat(["from","to","changed-front-art","changed-date-cells","same-date-grid","december-january","leap-february-march"], "orbit=" .* orbit_label.(keys)), '\t'))
        for i in 1:length(dates)-1
            src,dst = boards[i],boards[i+1]
            changed = [(r,c) for r in 1:7 for c in 1:7 if src[r,c] != dst[r,c]]
            ndates = count(rc -> rc[1] >= 3, changed)
            counts = [count(rc -> piece_orbit((rc[2]-4,4-rc[1],3)) == key, changed) for key in keys]
            @assert sum(counts) == length(changed)
            samegrid = dayofweek(dates[i]) == dayofweek(dates[i+1])
            decjan = month(dates[i]) == 12
            leapfeb = month(dates[i]) == 2 && isleapyear(year(dates[i]))
            record = (from=dates[i],to=dates[i+1],changed=length(changed),datecells=ndates,samegrid=samegrid,decjan=decjan,leapfeb=leapfeb)
            push!(rows, record)
            println(io, join(vcat(string.([record.from,record.to,record.changed,ndates,samegrid,decjan,leapfeb]),string.(counts)), '\t'))
        end
    end
    @assert length(rows) == 887 && count(r->r.decjan,rows) == 73 && count(r->r.leapfeb,rows) == 18
    open(joinpath(out,"same-date-grid.tsv"),"w") do io
        println(io,"from\tto\tchanged-front-art\tchanged-date-cells")
        for r in rows
            r.samegrid || continue
            println(io, join([r.from,r.to,r.changed,r.datecells],'\t'))
        end
    end
    vals = [r.changed for r in rows]
    println("classification\tEXPERIMENT_ONLY_NOT_MOVE_COUNTS")
    println("months\t",length(dates))
    println("unique-artwork-boards\t",length(unique(vec.(boards))))
    println("chronological-edges\t",length(rows))
    println("december-january-edges\t",count(r->r.decjan,rows))
    println("leap-february-march-edges\t",count(r->r.leapfeb,rows))
    println("same-date-grid-edges\t",count(r->r.samegrid,rows))
    for (label,value) in (("min",minimum(vals)),("median",median(vals)),("p90",quantile(vals,.9)),("p95",quantile(vals,.95)),("p99",quantile(vals,.99)),("max",maximum(vals)))
        println("changed-artwork-cells-",label,'\t',value)
    end
    println("transitions-sha256\t",bytes2hex(sha256(read(joinpath(out,"transitions.tsv")))))
end
if abspath(PROGRAM_FILE) == @__FILE__
    run(length(ARGS) == 1 ? ARGS[1] : error("Usage: julia analyze_domain.jl OUTPUT_DIRECTORY"))
end
