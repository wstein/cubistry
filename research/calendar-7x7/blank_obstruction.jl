#!/usr/bin/env julia
# Exact coupled-wing obstruction under the declared artwork/color profile.
# Independent reconstruction from root's targets; no solver verdict is trusted.
include(joinpath(@__DIR__,"coupled_synthesis.jl"))

function prove_blank_obstruction(;last=2099)
    keys=[(-3,-1),(-3,1)]
    targets=filter(t->t.year<=last,physical_targets("DE"))
    classes=[sort!(unique([isempty(t.board[r,c][1]) ? BLANK : artwork(t.board[r,c]...,r,c)
        for t in targets for r in 1:7,c in 1:7 if orbit(r,c)==k])) for k in keys]
    states=Vector{Vector{Vector{Int}}}()
    for t in targets
        v=[zeros(Int,length(cs)) for cs in classes]
        for r in 1:7,c in 1:7
            side=findfirst(==(orbit(r,c)),keys);isnothing(side) && continue
            g,ink=t.board[r,c];a=isempty(g) ? BLANK : artwork(g,ink,r,c)
            v[side][findfirst(==(a),classes[side])]+=1
        end
        push!(states,v)
    end
    quota=[[maximum(v[side][j] for v in states) for j in eachindex(classes[side])] for side in 1:2]
    @assert sum.(quota)==[24,24] "Inventory not tight; this proof does not apply"
    b=findfirst(==(BLANK),classes[2]);@assert quota[2][b]==2
    excluded=Any[];allowed=Int[]
    for a in eachindex(classes[1])
        witness=findfirst(v->v[1][a]==quota[1][a] && v[2][b]==2,states)
        if isnothing(witness)
            push!(allowed,a)
        else
            t=targets[witness]
            push!(excluded,Dict("A_class"=>collect(classes[1][a]),"A_inventory"=>quota[1][a],
                "year"=>t.year,"month"=>t.month,"A_demand"=>states[witness][1][a],"B_blank_demand"=>2))
        end
    end
    @assert all(quota[1][a]==1 for a in allowed)
    obstruction=findfirst(i->targets[i].year==2026 && targets[i].month==11 &&
        states[i][2][b]>0 && all(states[i][1][a]==1 for a in allowed),eachindex(states))
    @assert !isnothing(obstruction) "No complete blank-partner obstruction"
    t=targets[obstruction]
    occupied=Any[]
    for r in 1:7,c in 1:7
        orbit(r,c)==keys[1] || continue
        g,ink=t.board[r,c];a=isempty(g) ? BLANK : artwork(g,ink,r,c)
        a in classes[1][allowed] && push!(occupied,Dict("row"=>r,"column"=>c,"text"=>g,"ink"=>ink,"class"=>collect(a)))
    end
    certificate=Dict("format"=>"cubistry.calendar7.blank-obstruction.v1","language"=>"DE",
        "first_year"=>2026,"last_year"=>last,"start_columns"=>vcat(fill(5,9),fill(1,3)),
        "component"=>"wing1","orbit_A"=>collect(keys[1]),"orbit_B"=>collect(keys[2]),
        "physical_pieces"=>24,"inventory_totals"=>sum.(quota),
        "classes"=>[[collect(a) for a in cs] for cs in classes],"minimum_multiplicities"=>quota,
        "B_blank_inventory"=>2,"peak_exclusions"=>excluded,
        "possible_A_partners"=>[collect(classes[1][a]) for a in allowed],
        "obstruction_year"=>t.year,"obstruction_month"=>t.month,
        "obstruction_A_cells"=>occupied,"obstruction_B_blank_demand"=>states[obstruction][2][b],
        "claim"=>"No immutable paired-wing printing serves all specified German target fronts under the declared glyph equivalence/color profile.",
        "independent_confirmation"=>"PENDING")
    path=joinpath(ROOT,"evidence","DE-blank-obstruction-$last.json")
    open(path,"w") do io;json(io,certificate);println(io);end
    println("JULIA native obstruction: domain2026–",last,"; inventories24/24; exclusions=",length(excluded),
        "; possibleA=",classes[1][allowed],"; contradiction=",t.year,"-",t.month,
        "; requiredBblank=",states[obstruction][2][b],". Independent confirmation pending.")
    certificate
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    prove_blank_obstruction()
end
