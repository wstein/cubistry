#!/usr/bin/env julia
# Descriptive listing (not a proof): piece type behind every front cell of the
# repository's lattice model, and the same-column cell pairs seven days apart.
# Centres are named by their rotation orbit key (x,y) on the front face; (-2,-1)
# and (-2,1) are the two mirror-image oblique orbits.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))
function piece_type(p)
    a=sort(abs.(collect(p)));outer=count(==(3),a)
    outer==3 && return "corner"
    if outer==2
        return a[1]==0 ? "midge" : a[1]==1 ? "inner-wing" : "outer-wing"
    end
    a[1]==0 && a[2]==0 && return "core-centre"
    "centre($(a[1]),$(a[2]))"
end
cell_type(r,c)=(t=piece_type((c-4,4-r,3));startswith(t,"centre(") ? "centre"*replace(string(orbit(r,c))," "=>"") : t)
println("front-grid\trow\t",join(1:7,'\t'))
for r in 1:7;println("front-grid\t",r,'\t',join([cell_type(r,c) for c in 1:7],'\t'));end
for r in 3:6,c in 1:7
    println("week-pair\tr$(r)c$(c)/r$(r+1)c$(c)\t",cell_type(r,c),'\t',cell_type(r+1,c))
end
for (path,label) in ((joinpath(@__DIR__,"evidence","print-B.tsv"),"B"),(joinpath(@__DIR__,"evidence","print-A.tsv"),"A"))
    for (id,s) in enumerate(read_physical(path))
        occursin('/',s.text) && println("stacked-surface\t",label,'\t',id,'\t',s.text,'\t',s.ink,'\t',piece_type(s.home),'\t',join(s.home,','))
    end
end
