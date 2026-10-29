const STARTED = time_ns()
include("model.jl")
using .QualityModel
using SHA

const Q = QualityModel
const EDGES4 = [(1,2),(2,3),(2,4),(4,2),(3,2),(1,4),(2,1),(3,1),(4,1)]
const EDGES5 = unique(vcat(EDGES4,[(1,5),(2,5),(5,2),(5,1)]))
const BACKPOS = setdiff(collect(1:8),FRONTPOS)

function canonical_pattern(pattern)
    alternatives=NTuple{6,Int}[]
    for swap in (false,true),a in 0:2,b in 0:2
        left=swap ? pattern[4:6] : pattern[1:3]
        right=swap ? pattern[1:3] : pattern[4:6]
        push!(alternatives,Tuple(vcat(circshift(collect(left),a),circshift(collect(right),b))))
    end
    minimum(alternatives)
end

function patterns(nstates,neutral)
    result=Set{NTuple{6,Int}}();rawcount=0
    labels=neutral ? (0:nstates) : (1:nstates)
    for pattern in Iterators.product(ntuple(_->labels,6)...)
        all(s->s in pattern,1:nstates) || continue
        if neutral
            all(s->count(==(s),pattern)==1,1:nstates) || continue
            count(==(0),pattern)==6-nstates || continue
        end
        rawcount+=1
        push!(result,canonical_pattern(pattern))
    end
    sort(collect(result)),rawcount
end

function profiles(d)
    front=zeros(Int,4,3);back=zeros(Int,4,4,3)
    canonical=Q.CANONICAL
    for c in 1:4,t in 0:2
        front[c,t+1]=d[rank4(ntuple(i->i==c ? 3(FRONTPOS[c]-1)+t+1 : canonical[i],4))]
        for (b,p) in enumerate(BACKPOS)
            back[c,b,t+1]=d[rank4(ntuple(i->i==c ? 3(p-1)+t+1 : canonical[i],4))]
        end
    end
    front,back
end

"""Exact shortest paths subject to keeping the other three physical tiles."""
function score(pattern,edges,front,back)
    worst=0;means=Float64[];rows=Any[]
    for c in 1:4,(old,new) in edges
        sources=findall(==(old),collect(pattern))
        targets=findall(==(new),collect(pattern))
        values=Int[]
        for source in sources,b in 1:4,t in 0:2
            body=(source-1)÷3;twist=(source-1)%3
            best=minimum(((target-1)÷3==body ?
                front[c,mod(twist-(target-1)%3,3)+1] :
                back[c,b,mod(t-(target-1)%3,3)+1]) for target in targets)
            push!(values,best)
        end
        worst=max(worst,maximum(values))
        push!(means,sum(values)/length(values))
        push!(rows,Dict("slot"=>c,"from"=>Q.STATES[old],"to"=>Q.STATES[new],
            "maximumHTM"=>maximum(values),"meanHTM"=>sum(values)/length(values),
            "physicalSourceCases"=>length(values)))
    end
    Dict("pattern"=>collect(pattern),"maximumHTM"=>worst,
        "meanHTM"=>sum(means)/length(means),"edges"=>rows)
end

function choose_pairs()
    [(FRONTPOS[c],findfirst(==((FRONT[c][1],FRONT[c][2],-1)),POSITIONS)) for c in 1:4]
end

function pose_hash(print,pose)
    state=physical_state(print,pose)
    compact=[[body["id"],body["position"],body["orientation"]] for body in state["cubies"]]
    bytes2hex(sha256(Q.JSON.json(compact)))
end

function plan(pose,labels,pairs,pattern,graph,d)
    choices=[[(pairs[c][(j-1)÷3+1],(j-1)%3) for j in 1:6 if pattern[j]==labels[c]] for c in 1:4]
    best=typemax(Int);selected=nothing
    for options in Iterators.product(choices...)
        q=ntuple(c->pose[options[c][1]],4)
        twists=ntuple(c->options[c][2],4)
        cost=Int(d[target_index(q,twists)])
        if cost<best
            best=cost;selected=(q,twists)
        end
    end
    shortest_word(selected[1],selected[2],graph,d)
end

function witnesses(name,nstates,pattern,graph,d,out)
    pairs=choose_pairs()
    print=print_definition(pairs,fill(pattern,4),"ci-quality-$name-v1")
    records=Any[]
    for labels in Iterators.product(ntuple(_->1:nstates,4)...)
        word=plan(identity_pose(),labels,pairs,pattern,graph,d)
        pose=apply_word(identity_pose(),word)
        front=front_tiles(print,pose)
        for c in 1:4
            expected="quality-$(lowercase(Q.CATEGORIES[c]))-$(lowercase(Q.STATES[labels[c]]))"
            front[c]["assetId"]==expected || error("witness has wrong front artwork")
            front[c]["up"]==Q.Y || error("witness has a rotated front label")
        end
        push!(records,Dict("states"=>collect(labels),"moves"=>MOVES[word],
            "htm"=>length(word),"qtm"=>sum((m-1)%3==1 ? 2 : 1 for m in word;init=0),
            "physicalStateSHA256"=>pose_hash(print,pose),"front"=>front))
    end
    # Continue through real poses instead of restarting at each display.
    sequence=Any[];pose=identity_pose()
    for (i,record) in enumerate(vcat(records,reverse(records)))
        labels=Tuple(record["states"])
        word=plan(pose,labels,pairs,pattern,graph,d)
        pose=apply_word(pose,word)
        push!(sequence,Dict("index"=>i,"states"=>collect(labels),"moves"=>MOVES[word],
            "htm"=>length(word),"physicalStateSHA256"=>pose_hash(print,pose)))
    end
    document=Dict("schema"=>"cubistry.ci-quality-witness","version"=>1,
        "evidenceStatus"=>"UNKNOWN","note"=>"Generator checks only; independent review pending.",
        "stateNames"=>collect(Q.STATES[1:nstates]),"categories"=>collect(Q.CATEGORIES),
        "pairs"=>[collect(p).-1 for p in pairs],"pattern"=>collect(pattern),
        "print"=>print,"setupWitnesses"=>records,"continuousSequence"=>sequence)
    writejson(joinpath(out,"$name-witnesses.json"),document)
    Dict("name"=>name,"displayCount"=>length(records),"sequenceLength"=>length(sequence),
        "setupMaximumHTM"=>maximum(r["htm"] for r in records),
        "setupMeanHTM"=>sum(r["htm"] for r in records)/length(records),
        "sequenceMaximumHTM"=>maximum(r["htm"] for r in sequence),
        "sequenceMeanHTM"=>sum(r["htm"] for r in sequence)/length(sequence))
end

function main()
    out=length(ARGS)>0 ? abspath(ARGS[1]) : joinpath(@__DIR__,"evidence")
    mkpath(out)
    primitive_checks()
    started=time_ns();graph=build_graph();d=distances(graph)
    bfsseconds=(time_ns()-started)/1e9
    for i in 1:136080
        rank4(unrank4(i))==i || error("rank bijection")
        for m in 1:18
            graph[MOVE_INVERSE[m],graph[m,i]]==i || error("graph inverse")
            Int(d[i])<=Int(d[graph[m,i]])+1 || error("distance inequality")
        end
        i==Q.GOAL || any(m->Int(d[graph[m,i]])+1==Int(d[i]),1:18) || error("distance descent")
    end
    count(==(0),d)==1 || error("unique goal")
    open(joinpath(out,"distances.u8"),"w") do io;write(io,d);end
    front,back=profiles(d)
    summaries=Any[];candidate_groups=Any[]
    for nstates in (4,5),neutral in (true,false)
        label=neutral ? "neutral" : "labeled"
        candidates,rawcount=patterns(nstates,neutral)
        scored=[score(p,nstates==4 ? EDGES4 : EDGES5,front,back) for p in candidates]
        sort!(scored;by=r->(r["maximumHTM"],r["meanHTM"],Tuple(r["pattern"])))
        best=first(scored)
        name="$(nstates)-state-$label"
        push!(candidate_groups,Dict("name"=>name,"rawPatternCount"=>rawcount,
            "symmetryRepresentatives"=>length(candidates),"candidates"=>scored))
        push!(summaries,merge(Dict("policyMaximumHTM"=>best["maximumHTM"],
            "policyMeanHTM"=>best["meanHTM"]),
            witnesses(name,nstates,Tuple(best["pattern"]),graph,d,out)))
    end
    writejson(joinpath(out,"candidates.json"),candidate_groups)
    summary=Dict("schema"=>"cubistry.ci-quality-research","version"=>1,
        "evidenceStatus"=>"UNKNOWN","independentReview"=>"pending",
        "juliaVersion"=>string(VERSION),"domainSize"=>length(d),"goalIndex"=>Q.GOAL,
        "distanceHistogram"=>[count(==(i),d) for i in 0:maximum(d)],
        "arbitraryFixedTargetMaximumHTM"=>Int(maximum(d)),
        "distanceSHA256"=>bytes2hex(sha256(read(joinpath(out,"distances.u8")))),
        "bfsBuildSeconds"=>bfsseconds,"scriptSeconds"=>(time_ns()-STARTED)/1e9,
        "frontTwistProfile"=>[collect(front[c,:]) for c in 1:4],
        "backPoseProfile"=>[[collect(back[c,b,:]) for b in 1:4] for c in 1:4],
        "candidateSummaries"=>summaries,
        "scope"=>"Finite pair construction; preserving other three physical front IDs; no global print optimality claim.")
    writejson(joinpath(out,"summary.json"),summary)
    println(Q.JSON.json(summary))
end

main()
