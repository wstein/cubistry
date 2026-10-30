#!/usr/bin/env julia
# Independent constructive search in the necessary paired-wing relaxation.
using Random
include(joinpath(@__DIR__,"peak_hall_audit.jl"))

function front_matching(pairing,target)
    slots=Tuple{Int,Int}[]
    for side in 1:2,a in eachindex(target[side])
        append!(slots,fill((side,a),target[side][a]))
    end
    occupied=zeros(Int,length(pairing))
    function augment(s,seen)
        side,a=slots[s]
        for p in eachindex(pairing)
            seen[p] && continue
            pairing[p][side]==a || continue
            seen[p]=true
            if occupied[p]==0 || augment(occupied[p],seen)
                occupied[p]=s;return true
            end
        end
        false
    end
    all(augment(s,falses(length(pairing))) for s in eachindex(slots))
end

function construct_wings()
    rng=Xoshiro(20261030)
    out=joinpath(@__DIR__,"wing-pairing-candidate.tsv")
    open(out,"w") do io
        println(io,"language\tpiece\tA-text\tA-angle\tA-ink\tB-text\tB-angle\tB-ink")
        for lang in ["DE","EN"]
            profile=projected_inventory(lang)
            inventory=deepcopy(profile.peaks)
            slack=24-sum(inventory[1]);@assert slack in (0,1)
            @assert sum(inventory[2])==24
            found=false;attempts=0
            for extra in (slack==0 ? [0] : collect(eachindex(profile.classes[1])))
                counts=deepcopy(inventory)
                extra!=0 && (counts[1][extra]+=1)
                forbidden=falses(length(profile.classes[1]),length(profile.classes[2]))
                for t in profile.targets,a in eachindex(profile.classes[1]),b in eachindex(profile.classes[2])
                    t[1][a]==counts[1][a] && t[2][b]==counts[2][b] && (forbidden[a,b]=true)
                end
                left=vcat([fill(a,n) for (a,n) in enumerate(counts[1])]...)
                right=vcat([fill(a,n) for (a,n) in enumerate(counts[2])]...)
                for trial in 1:1000
                    attempts+=1
                    if trial>1
                        shuffle!(rng,left);shuffle!(rng,right)
                    end
                    matching=maximum_pair_matching(left,right,forbidden)
                    matching.successes==24 || continue
                    pairs=[(left[matching.matched[j]],right[j]) for j in eachindex(right)]
                    if all(front_matching(pairs,t) for t in profile.targets)
                        found=true
                        for (p,(a,b)) in enumerate(pairs)
                            ga=profile.classes[1][a];gb=profile.classes[2][b]
                            println(io,join([lang,p,ga...,gb...],'\t'))
                        end
                        println(lang," coupled wing1 candidate found after ",attempts,
                            " attempts; all ",length(profile.targets)," projected targets replayed; extra category ",extra)
                        break
                    end
                end
                found && break
            end
            found || println(lang," UNKNOWN: no candidate found after ",attempts," bounded randomized attempts")
        end
    end
    println("UNKNOWN physical feasibility: no complete cube state or legal-move reachability was proved.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    construct_wings()
end
