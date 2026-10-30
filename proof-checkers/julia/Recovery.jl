# Native Julia recovery proof. Reuses only this language's existing native HSM
# physical model; no production mechanics, Python verifier, or Flix output.
module IndependentRecovery
using SHA
using ..IndependentProof
using ..IndependentHsm
const IP = IndependentProof
const H = IndependentHsm
const PROFILE = "cubistry.hsm-seconds-first-recovery"
const ROW_KEYS = ("letter", "maximum", "direction", "sourceDirection", "traversal", "graphNodes",
    "edgesAtMostLimitOrForced", "periodNodes", "unreachable", "poseWithoutEdgeAtMostLimit",
    "stepsHistogram", "edgesAboveLimitHistogram", "maximumSteps", "meanSteps", "maximumRecoveryHTM", "samples")
const Pose = NTuple{8,UInt8}
const Triple = NTuple{3,Int}
need(ok, msg; code="INVALID") = IP.need(ok, msg; code=code)
integer(x, lo=0, hi=10^9) = IP.integer(x, lo, hi)
posecode(t) = sum(Int64(t[c]-1) * Int64(24)^(c-1) for c in 1:8)
function read_raw(path)
    need(read(path, 3) != UInt8[0xef, 0xbb, 0xbf], "byte order mark before JSON"; code="INVALID_JSON")
    IP.read_json(path)
end
function header(data, schema, keys)
    need(data isa AbstractDict && get(data, "schema", nothing) == schema, "unsupported recovery input schema"; code="UNSUPPORTED")
    need(get(data, "version", nothing) isa Integer && !(data["version"] isa Bool) && data["version"] == 1,
        "unsupported recovery input version"; code="UNSUPPORTED")
    H.exact_keys(data, keys, "recovery input")
    IP.scalar_string(data["label"])
end
function histogram(raw)
    need(raw isa AbstractDict && !isempty(raw), "nonempty histogram object")
    out = Dict{Int,Int}()
    for (k, v) in raw
        need(occursin(r"^(0|[1-9][0-9]{0,8})\z", k), "canonical ASCII histogram key")
        out[parse(Int,k)] = integer(v, 1)
    end
    out
end
function parse_inputs(recovery, modes)
    header(recovery, PROFILE, ("schema", "version", "label", "printCode", "edgeLimitHTM", "objective", "modes"))
    header(modes, H.PROFILE_MODES, ("schema", "version", "label", "printCode", "universalArbitrarySourceHTM", "printing", "modes", "edgeLimitHTM", "appModes"))
    need(integer(recovery["edgeLimitHTM"]) == 5 && integer(modes["edgeLimitHTM"]) == 5, "five-HTM edge limit")
    need(integer(modes["universalArbitrarySourceHTM"]) == 6, "declared six-HTM HSM bound")
    need(recovery["objective"] == "lexicographic: edges above the limit, steps, HTM", "exact recovery objective")
    pr = H.parse_print(modes["printing"])
    need(recovery["printCode"] == modes["printCode"] == H.print_code(pr), "recovery bound to physical witness print")
    raw = recovery["modes"]
    need(raw isa AbstractVector && length(raw) == 18, "exactly eighteen ordered recovery modes")
    for (r, identity) in zip(raw, H.ALL_MODES)
        H.exact_keys(r, ROW_KEYS, "recovery row")
        need((r["letter"], integer(r["maximum"]), integer(r["direction"], -1, 1)) == identity, "canonical recovery mode order")
        need(integer(r["sourceDirection"], -1, 1) in (-1,1), "source direction")
        need(r["traversal"] in ("forward", "inverse"), "traversal")
        for k in ("graphNodes", "edgesAtMostLimitOrForced", "periodNodes", "maximumSteps", "maximumRecoveryHTM")
            integer(r[k], 1)
        end
        integer(r["unreachable"]); integer(r["poseWithoutEdgeAtMostLimit"])
        histogram(r["stepsHistogram"]); histogram(r["edgesAboveLimitHistogram"])
        mean = r["meanSteps"]
        need(mean isa Real && !(mean isa Bool) && isfinite(mean) && 0 <= mean <= 100000, "finite bounded meanSteps")
        samples = r["samples"]
        need(samples isa AbstractVector && 2 <= length(samples) <= 100000, "at least two bounded recovery samples")
        for s in samples
            H.exact_keys(s, ("fromValue", "setupFromSolved", "steps", "words"), "recovery sample")
            integer(s["fromValue"], 0, r["maximum"]); H.parse_word(s["setupFromSolved"])
            count = integer(s["steps"], 0, 100000)
            need(s["words"] isa AbstractVector && length(s["words"]) == count, "honest sample step count")
            for word in s["words"]
                need(1 <= length(H.parse_word(word)) <= 6, "sample edge of one to six HTM")
            end
        end
        need(samples[1]["steps"] == r["maximumSteps"], "first sample attains maximum steps")
    end
    own = modes["modes"]
    need(own isa AbstractVector && length(own) == 18, "eighteen own periods")
    parsed = [H.parse_mode(m) for m in own]
    need(Set((m.letter,m.maximum,m.direction) for m in parsed) == Set(H.ALL_MODES), "distinct complete own periods")
    need(all(m -> m.cap in (5,6) && m.max_htm <= 5, parsed), "own-period cap and maximum")
    pr, parsed
end
function bind_periods(E, parsed, raw)
    replays = [H.replay_mode(E, m, H.source_state(E.pr)) for m in parsed]
    apps = H.check_app_modes(raw, parsed, replays, 5)
    own = Dict((m.letter,m.maximum,m.direction) => r for (m,r) in zip(parsed,replays))
    goals = Dict{Tuple{String,Int,Int},Set{Int64}}()
    for a in apps
        goals[(a.letter,a.maximum,a.direction)] = Set(posecode(p) for p in own[(a.letter,a.maximum,a.sourceDirection)].poses)
    end
    apps, goals
end

# Complete full poses: four displayed corners are fixed (including the blank's
# three physical facelets); remaining corners range over all permutations/twists.
function enumerate_nodes(E, letter, maximum)
    fixedpose = Dict{Tuple{Int,Int},Int}()
    for i in 1:24, cell in 1:4
        c,j = E.corner_of[i], E.local_of[i]
        for k in 1:24
            E.poses[c][k][j] == H.GOAL[cell] && (fixedpose[(i,cell)] = k)
        end
    end
    nodes = Pose[]; layers = Int[]; index = Dict{Int64,Int32}()
    freepositions = [i for i in 1:8 if !(i-1 in (H.position_index(f) for f in H.FRONT))]
    for value in 0:maximum, option in H.options(E, letter, value)
        fixed = zeros(Int,8)
        for (cell,i) in enumerate(option)
            fixed[E.corner_of[i]] = fixedpose[(i,cell)]
        end
        rest = findall(==(0),fixed)
        for perm in H.perms4(freepositions), a in E.at[rest[1]][perm[1]], b in E.at[rest[2]][perm[2]], c in E.at[rest[3]][perm[3]], d in E.at[rest[4]][perm[4]]
            t = copy(fixed)
            t[rest[1]],t[rest[2]],t[rest[3]],t[rest[4]] = a,b,c,d
            sum(E.twist[x][t[x]] for x in 1:8) % 3 == 0 || continue
            code = posecode(t)
            if !haskey(index, code)
                push!(nodes, Tuple(UInt8.(t))); push!(layers,value); index[code] = length(nodes)
            else
                need(layers[index[code]] == value, "unique display value per pose")
            end
        end
    end
    nodes,layers,index
end

# Only algebraically redundant words are omitted: adjacent same-face turns and
# the noncanonical order of commuting opposite-face turns. Target-distance
# pruning is a lower bound; it does not impose shortestness on routes <= five.
mutable struct WordSearch
    E::H.Engine
    memo::Dict{Tuple{Int,Tuple,Int},Vector{Vector{UInt8}}}
    cached_words::Int
end
WordSearch(E) = WordSearch(E, Dict{Tuple{Int,Tuple,Int},Vector{Vector{UInt8}}}(), 0)
face(m) = (m-1) ÷ 3
function bounded_words(W::WordSearch, remaining::Int, keys::Tuple, previous::Int)
    remaining == 0 && return any(k -> W.E.dist[k+1] == 0, keys) ? [UInt8[]] : Vector{UInt8}[]
    cachekey = (remaining,keys,previous)
    hit = get(W.memo,cachekey,nothing)
    hit !== nothing && return hit
    out = Vector{UInt8}[]
    for m in 1:18
        f = face(m)
        (f == previous || (previous >= 0 && f ÷ 2 == previous ÷ 2 && f < previous)) && continue
        nextkeys = Int[]
        for k in keys
            nk = H.key_move(m,k)
            W.E.dist[nk+1] <= remaining-1 && push!(nextkeys,nk)
        end
        isempty(nextkeys) && continue
        for tail in bounded_words(W,remaining-1,Tuple(sort!(unique!(nextkeys))),f)
            push!(out,vcat(UInt8(m),tail))
        end
    end
    need(length(W.memo) < 500000 && W.cached_words + length(out) <= 10000000,
        "bounded-word cache resource limit"; code="ERROR")
    W.memo[cachekey] = out
    W.cached_words += length(out)
    out
end
function target_keys(E, t, opts)
    fac = zeros(Int,24)
    for c in 1:8, j in 1:3
        fac[E.members[c][j]] = E.poses[c][t[c]][j]
    end
    sort!(unique!([H.encode_key(fac[a],fac[b],fac[c],fac[d]) for (a,b,c,d) in opts]))
end
function endpoints(W, t, keys)
    E = W.E
    shortest = minimum(Int(E.dist[k+1]) for k in keys)
    need(1 <= shortest <= 6, "next display has a route of one to six HTM")
    limit = shortest <= 5 ? 5 : shortest
    ends = Dict{Int64,UInt8}()
    for length in shortest:limit
        live = Tuple(k for k in keys if E.dist[k+1] <= length)
        for word in bounded_words(W,length,live,-1)
            endpoint = t
            for m in word
                endpoint = ntuple(c -> UInt8(E.ptrans[c][m][endpoint[c]]),8)
            end
            code = posecode(endpoint)
            ends[code] = min(get(ends,code,0xff),UInt8(length))
        end
    end
    need(!isempty(ends), "every source has next-display endpoints")
    ends, shortest
end

# Reverse CSR retains minimum endpoint costs; memory is proportional to the
# graph, not the space of unreduced move words.
function build_graph(E, nodes, layers, index, letter, maximum, direction)
    W = WordSearch(E)
    need(length(nodes) <= 1000000, "graph node resource limit"; code="ERROR")
    opts = [H.options(E,letter,v) for v in 0:maximum]
    source = Int32[]; target = Int32[]; costs = UInt8[]; forced = falses(length(nodes))
    for i in eachindex(nodes)
        nextvalue = mod(layers[i]+direction,maximum+1)
        ends, distance = endpoints(W,nodes[i],target_keys(E,nodes[i],opts[nextvalue+1]))
        forced[i] = distance > 5
        for code in sort!(collect(keys(ends)))
            need(haskey(index,code), "every recovery endpoint belongs to exhaustive enumeration")
            j = index[code]
            need(layers[j] == nextvalue, "endpoint has next modular display")
            push!(source,i); push!(target,j); push!(costs,ends[code])
            need(length(costs) <= 50000000, "graph edge resource limit"; code="ERROR")
        end
        i % 25000 == 0 && println(stderr,"graph ",letter," 0-",maximum," ",direction,": ",i,"/",length(nodes)," nodes, ",length(costs)," edges, ",length(W.memo)," word-cache entries")
    end
    N = length(nodes)
    starts = ones(Int,length(nodes)+1)
    for j in target
        starts[j+1] += 1
    end
    starts[1] = 1
    for i in 2:N+1
        starts[i] += starts[i-1]-1
    end
    cursor = copy(starts)
    reverse_source = Vector{Int32}(undef,length(source)); reverse_cost = similar(costs)
    for k in eachindex(source)
        j = target[k]; p = cursor[j]
        reverse_source[p] = source[k]; reverse_cost[p] = costs[k]; cursor[j] += 1
    end
    starts,reverse_source,reverse_cost,forced
end

# Binary heap of exact lexicographic labels, with lazy stale-entry removal.
function heappush!(heap, item)
    push!(heap,item); i = length(heap)
    while i > 1
        p = i ÷ 2
        heap[p] <= item && break
        heap[i] = heap[p]; i = p
    end
    heap[i] = item
end
function heappop!(heap)
    result = heap[1]; last = pop!(heap)
    isempty(heap) && return result
    i = 1
    while 2i <= length(heap)
        child = 2i
        child < length(heap) && heap[child+1] < heap[child] && (child += 1)
        heap[child] >= last && break
        heap[i] = heap[child]; i = child
    end
    heap[i] = last
    result
end
function distances(starts, sources, costs, goals)
    INF = (typemax(Int)÷4,typemax(Int)÷4,typemax(Int)÷4)
    dist = fill(INF,length(starts)-1)
    heap = Tuple{Triple,Int32}[]
    for i in goals
        dist[i] = (0,0,0); heappush!(heap,((0,0,0),Int32(i)))
    end
    while !isempty(heap)
        distance,j = heappop!(heap)
        distance == dist[j] || continue
        for edge in starts[j]:starts[j+1]-1
            i = sources[edge]; cost = Int(costs[edge])
            candidate = (distance[1]+Int(cost>5),distance[2]+1,distance[3]+cost)
            if candidate < dist[i]
                dist[i] = candidate; heappush!(heap,(candidate,i))
            end
        end
    end
    dist,INF
end
function round_mean(total, count)
    scaled,remainder = divrem(total*10000,count)
    twice = 2remainder
    (twice > count || (twice == count && isodd(scaled))) && (scaled += 1)
    string(scaled ÷ 10000,".",lpad(string(scaled % 10000),4,'0'))
end
histwire(h) = Pair{String,Any}[string(k) => h[k] for k in sort!(collect(keys(h)))]
function replay_samples(E, row, index, goals, dist)
    totalsteps = 0; inverses = 0
    for sample in row["samples"]
        state = H.turn(H.source_state(E.pr),H.parse_word(sample["setupFromSolved"]))
        start = state; value = sample["fromValue"]
        H.show_display(E.pr,state,row["letter"],value)
        code = posecode(H.pose_of(E,state))
        need(haskey(index,code), "sample source is enumerated")
        optimum = dist[index[code]]; observed = (0,0,0)
        words = [H.parse_word(w) for w in sample["words"]]
        for word in words
            need(!(code in goals), "sample cannot pass through an earlier period goal")
            nextvalue = mod(value+row["direction"],row["maximum"]+1)
            shortest = H.shortest(E,state,row["letter"],nextvalue)
            need(length(word) <= 5 || (shortest > 5 && length(word) == shortest), "sample edge is bounded or forced shortest")
            old = state; state = H.turn(state,word)
            H.show_display(E.pr,state,row["letter"],nextvalue)
            need(H.turn(state,H.inverse_moves(word)) == old, "sample full-frame edge inverse")
            code = posecode(H.pose_of(E,state)); need(haskey(index,code), "sample endpoint is enumerated")
            observed = (observed[1]+Int(length(word)>5),observed[2]+1,observed[3]+length(word))
            value = nextvalue; inverses += 1
        end
        need(code in goals && observed == optimum, "sample ends on period with exact optimal cost triple")
        for word in reverse(words)
            state = H.turn(state,H.inverse_moves(word))
        end
        need(state == start, "complete sample inverse returns every sticker frame")
        totalsteps += length(words)
    end
    (samples=length(row["samples"]),steps=totalsteps,edgeInverses=inverses,fullInverses=length(row["samples"]))
end
function check_row(E, row, app, goals)
    need((row["sourceDirection"],row["traversal"]) == (app.sourceDirection,app.traversal), "recovery selection and traversal bound to witness")
    nodes,layers,index = enumerate_nodes(E,row["letter"],row["maximum"])
    need(length(nodes) == row["graphNodes"], "exact independently enumerated graph node count")
    need(all(haskey(index,g) for g in goals) && length(goals) == row["periodNodes"], "exact period goal membership and count")
    println(stderr,"enumerated ",length(nodes)," full display poses; rebuilding endpoint graph")
    starts,sources,costs,forced = build_graph(E,nodes,layers,index,row["letter"],row["maximum"],row["direction"])
    need(length(costs) == row["edgesAtMostLimitOrForced"], "exact independently rebuilt recovery edge count")
    println(stderr,"rebuilt ",length(costs)," endpoint edges; reverse lexicographic Dijkstra")
    dist,INF = distances(starts,sources,costs,[index[g] for g in goals])
    unreachable = count(==(INF),dist)
    need(unreachable == row["unreachable"] == 0, "every legal settled pose recovers")
    need(count(forced) == row["poseWithoutEdgeAtMostLimit"], "exact forced-source count")
    steps = Dict{Int,Int}(); above = Dict{Int,Int}()
    for (i,d) in enumerate(dist)
        need(d[1] in (0,1) && (d[1] == 1) == forced[i], "only forced sources require one above-limit edge")
        steps[d[2]] = get(steps,d[2],0)+1; above[d[1]] = get(above,d[1],0)+1
    end
    need(steps == histogram(row["stepsHistogram"]), "exact independently recomputed steps histogram")
    need(above == histogram(row["edgesAboveLimitHistogram"]), "exact independently recomputed above-limit histogram")
    maxsteps = maximum(d[2] for d in dist); maxhtm = maximum(d[3] for d in dist)
    totalsteps = sum(d[2] for d in dist); mean = round_mean(totalsteps,length(nodes))
    need(maxsteps == row["maximumSteps"] && maxhtm == row["maximumRecoveryHTM"], "honest maximum recovery metrics")
    need(row["meanSteps"] == parse(Float64,mean), "exact four-decimal rounded mean steps")
    samples = replay_samples(E,row,index,goals,dist)
    (letter=row["letter"],maximum=row["maximum"],direction=row["direction"],sourceDirection=app.sourceDirection,traversal=app.traversal,
     graphNodes=length(nodes),edgesAtMostLimitOrForced=length(costs),periodNodes=length(goals),unreachable=unreachable,
     poseWithoutEdgeAtMostLimit=count(forced),stepsHistogram=histwire(steps),edgesAboveLimitHistogram=histwire(above),
     maximumSteps=maxsteps,meanStepsExact=H.frac_string(totalsteps,length(nodes)),meanStepsFourPlaces=mean,maximumRecoveryHTM=maxhtm,sampleReplay=samples)
end
function evaluate(recovery_path,modes_path; smoke_index=nothing)
    try
        recovery,rsha = read_raw(recovery_path); modes,msha = read_raw(modes_path)
        println(stderr,"strict raw JSON loaded; parsing recovery and all-mode bindings")
        pr,parsed = parse_inputs(recovery,modes)
        println(stderr,"building native HSM physical model and four-sticker distances")
        E = H.build_engine(pr)
        println(stderr,"replaying eighteen own periods and inverse closures")
        apps,goals = bind_periods(E,parsed,modes["appModes"])
        appindex = Dict((a.letter,a.maximum,a.direction) => a for a in apps)
        summaries = Any[]
        indices = smoke_index === nothing ? eachindex(recovery["modes"]) : [smoke_index]
        for i in indices
            row = recovery["modes"][i]; identity = (row["letter"],row["maximum"],row["direction"])
            println(stderr,"checking recovery ",identity)
            push!(summaries,check_row(E,row,appindex[identity],goals[identity]))
        end
        valid = smoke_index === nothing
        status = valid ? "VALID" : "UNKNOWN"
        output = H.emit(["valid"=>valid,"status"=>status,"profile"=>PROFILE,"profileVersion"=>1,
            "recoveryInputSHA256"=>rsha,"modesInputSHA256"=>msha,"printSHA256"=>H.print_digest(pr),
            "edgeLimitHTM"=>5,"modes"=>summaries,
            "claims"=>(recoveryReturnOntoPeriod=valid ? "VERIFIED" : "PARTIAL",globalPrintOptimality="UNKNOWN",
                runtimeReachabilityOfForcedPoses="NOT_CHECKED",minimumMeanPeriodCertificates="NOT_CHECKED")])
        valid,status,output
    catch error
        d = IP.invalid_result(error)
        false,d["status"],H.emit(["valid"=>false,"status"=>d["status"],"reason"=>d["reason"]])
    end
end
end
