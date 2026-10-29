# Lower bounds for this specific two-corner-per-category print family only.
include("model.jl")
using .QualityModel
using SHA
const Q=QualityModel
const EDGES=[(1,2),(2,3),(2,4),(4,2),(3,2),(1,4),(2,1),(3,1),(4,1),
             (1,5),(2,5),(5,2),(5,1)]

function digest(print,pose)
    state=physical_state(print,pose)
    bytes2hex(sha256(Q.JSON.json([[b["id"],b["position"],b["orientation"]] for b in state["cubies"]])))
end

function main()
    out=length(ARGS)>0 ? abspath(ARGS[1]) : joinpath(@__DIR__,"evidence")
    d=read(joinpath(out,"distances.u8"));graph=build_graph()
    length(d)==136080 || error("distance domain")
    families=readjson(joinpath(out,"candidates.json"))
    candidates=only(f for f in families if f["name"]=="5-state-labeled")["candidates"]
    pairs=[(FRONTPOS[c],findfirst(==((FRONT[c][1],FRONT[c][2],-1)),POSITIONS)) for c in 1:4]
    records=Any[]
    for (index,candidate) in enumerate(candidates)
        pattern=Int.(candidate["pattern"])
        unique_state=findfirst(s->count(==(s),pattern)==1,1:5)
        isnothing(unique_state) && error("unchanged categories need a unique artwork")
        unique_tile=findfirst(==(unique_state),pattern)
        obstruction=nothing
        for (old,new) in EDGES,source in findall(==(old),pattern)
            targets=findall(==(new),pattern)
            if all(t->(t-1)÷3==(source-1)÷3,targets)
                obstruction=(old,new,source,targets)
                break
            end
        end
        isnothing(obstruction) && error("candidate has no same-front-body obstruction")
        old,new,source,targets=obstruction
        print=print_definition(pairs,fill(Tuple(pattern),4),"ci-quality-lower-bound-$index-v1")
        source_tiles=ntuple(c->c==1 ? source : unique_tile,4)
        bodies=ntuple(c->pairs[c][(source_tiles[c]-1)÷3+1],4)
        twists=ntuple(c->(source_tiles[c]-1)%3,4)
        source_word=shortest_word(ntuple(c->identity_pose()[bodies[c]],4),twists,graph,d)
        source_pose=apply_word(identity_pose(),source_word)
        source_states=fill(unique_state,4);source_states[1]=old
        target_states=copy(source_states);target_states[1]=new
        distances=Int[];target_words=Vector{Int}[]
        for tile in targets
            goal_twists=ntuple(c->c==1 ? (tile-1)%3 : twists[c],4)
            q=ntuple(c->source_pose[bodies[c]],4)
            push!(distances,Int(d[target_index(q,goal_twists)]))
            push!(target_words,shortest_word(q,goal_twists,graph,d))
        end
        all(==(6),distances) || error("same-body lower bound is not six")
        target_word=first(target_words)
        target_pose=apply_word(source_pose,target_word)
        for (pose,labels) in ((source_pose,source_states),(target_pose,target_states))
            tiles=front_tiles(print,pose)
            for c in 1:4
                tiles[c]["assetId"]=="quality-$(lowercase(Q.CATEGORIES[c]))-$(lowercase(Q.STATES[labels[c]]))" || error("lower-bound display")
                tiles[c]["up"]==Q.Y || error("lower-bound print-up")
            end
        end
        push!(records,Dict("pattern"=>pattern,"print"=>print,
            "sourceStates"=>source_states,"targetStates"=>target_states,
            "sourceMoves"=>MOVES[source_word],"sourcePhysicalStateSHA256"=>digest(print,source_pose),
            "targetMoves"=>MOVES[target_word],"targetPhysicalStateSHA256"=>digest(print,target_pose),
            "exactHTM"=>6,"targetAlternativeDistances"=>distances,
            "unchangedCategoryArtworksUnique"=>true,
            "changedTargetCopiesOnCurrentFrontBody"=>true))
    end
    result=Dict("schema"=>"cubistry.ci-quality-family-lower-bounds","version"=>1,
        "evidenceStatus"=>"UNKNOWN","independentReview"=>"pending",
        "scope"=>"100 cyclic/body-swap representatives of five-state fully labeled two-corner/category prints; not arbitrary prints.",
        "distanceSHA256"=>bytes2hex(sha256(d)),"records"=>records)
    writejson(joinpath(out,"five-state-family-lower-bounds.json"),result)
    println(Q.JSON.json(Dict("candidateCounterexamples"=>length(records),"exactHTM"=>6,
        "status"=>"UNKNOWN","independentReview"=>"pending")))
end
main()
