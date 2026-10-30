#!/usr/bin/env julia
# Finite DE wing1 search: only blank-incident edges need branch enumeration.
include(joinpath(@__DIR__,"construct_wing_pairing.jl"))

function exhaustive_blank_pairs()
    profile=projected_inventory("DE")
    @assert sum.(profile.peaks)==[24,24]
    blankA=findfirst(a->a==("",0,"blank"),profile.classes[1])
    bb=findfirst(a->a==("",0,"blank"),profile.classes[2])
    @assert profile.peaks[1][blankA]==2 && profile.peaks[2][bb]==2
    @assert all(n==1 for (i,n) in enumerate(profile.peaks[1]) if i!=blankA)
    @assert all(n==1 for (i,n) in enumerate(profile.peaks[2]) if i!=bb)
    left=vcat([fill(a,n) for (a,n) in enumerate(profile.peaks[1])]...)
    right=vcat([fill(a,n) for (a,n) in enumerate(profile.peaks[2])]...)
    forbidden=falses(length(profile.classes[1]),length(profile.classes[2]))
    for t in profile.targets,a in eachindex(profile.classes[1]),b in eachindex(profile.classes[2])
        t[1][a]==profile.peaks[1][a] && t[2][b]==profile.peaks[2][b] && (forbidden[a,b]=true)
    end
    left_blanks=findall(==(blankA),left);right_blanks=findall(==(bb),right)
    neighbors=[j for j in eachindex(right) if !forbidden[blankA,right[j]]]
    total=0;nomatch=0;frontfail=0;solutions=0
    for j1 in neighbors,j2 in neighbors
        j1<j2 || continue
        fixed=[(left_blanks[1],j1),(left_blanks[2],j2)]
        free_rb=[j for j in right_blanks if j!=j1 && j!=j2]
        available_la=[i for i in eachindex(left) if !(i in left_blanks) && !forbidden[left[i],bb]]
        options=length(free_rb)==0 ? [Int[]] : length(free_rb)==1 ? [[i] for i in available_la] :
            [[i,j] for i in available_la for j in available_la if i<j]
        for used_la in options
            total+=1
            fixed_edges=vcat(fixed,collect(zip(used_la,free_rb)))
            used_left=Set(first.(fixed_edges));used_right=Set(last.(fixed_edges))
            remaining_l=[i for i in eachindex(left) if !(i in used_left)]
            remaining_r=[j for j in eachindex(right) if !(j in used_right)]
            completion=maximum_pair_matching(left[remaining_l],right[remaining_r],forbidden)
            if completion.successes!=length(remaining_l)
                nomatch+=1;continue
            end
            edges=vcat(fixed_edges,[(remaining_l[completion.matched[j]],remaining_r[j]) for j in eachindex(remaining_r)])
            @assert length(edges)==24 && length(unique(first.(edges)))==24 && length(unique(last.(edges)))==24
            pairs=[(left[i],right[j]) for (i,j) in edges]
            if all(front_matching(pairs,t) for t in profile.targets)
                solutions+=1
                out=joinpath(@__DIR__,"DE-wing-exhaustive-candidate.tsv")
                open(out,"w") do io
                    println(io,"language\tpiece\tA-text\tA-angle\tA-ink\tB-text\tB-angle\tB-ink")
                    for (p,(a,b)) in enumerate(pairs)
                        ga=profile.classes[1][a];gb=profile.classes[2][b]
                        println(io,join(["DE",p,ga...,gb...],'\t'))
                    end
                end
                println("FOUND DE wing1 fixed printing after ",total," blank-incident branches; all ",
                    length(profile.targets)," fronts replayed; unmatched branches ",nomatch,"; front failures ",frontfail)
                println("UNKNOWN physical feasibility: coupled front matching is not complete cube reachability.")
                return
            else
                frontfail+=1
            end
        end
    end
    println("EXHAUSTED DE blank branches=",total," no-completion=",nomatch," frontfail=",frontfail," solutions=",solutions)
    println("UNKNOWN pending independent checking and review of branch completeness; no proof certificate yet.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    exhaustive_blank_pairs()
end
