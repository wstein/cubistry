# Adversarial controls for the additive recovery checker; independent native
# computation is exercised, and no input digest is an acceptance condition.
include("Checker.jl")
include("Hsm.jl")
include("Recovery.jl")
using JSON, Test
const R = IndependentRecovery
const H = IndependentHsm
const IP = IndependentProof
length(ARGS) == 2 || error("RECOVERY.json MODES.json required")
recovery,rsha = R.read_raw(ARGS[1]); modes,msha = R.read_raw(ARGS[2])
results = Pair{String,Any}[]
function reject(name, action; status="INVALID")
    exception = try action(); nothing catch e; e end
    @test exception isa IP.Invalid
    @test exception.code == status
    push!(results,name => (valid=false,status=exception.code,reason=exception.message))
end
function mutate(name, change)
    data = deepcopy(recovery)
    change(data)
    reject(name,() -> R.parse_inputs(data,modes))
end
@testset "strict raw reader and recovery binding" begin
    mktempdir() do dir
        for (name,text,status) in [
            ("duplicate-key","{\"schema\":1,\"schema\":2}","INVALID_JSON"),
            ("truncated-json","{\"schema\":","INVALID_JSON"),
            ("byte-order-mark","\ufeff{}","INVALID_JSON"),
            ("nonfinite-json","{\"x\":NaN}","INVALID_JSON")]
            path = joinpath(dir,name*".json");write(path,text)
            reject(name,() -> R.read_raw(path);status=status)
        end
    end
    for (name,change) in [
        ("extra-top-key",d -> d["extra"] = true),
        ("floating-edge-limit",d -> d["edgeLimitHTM"] = 5.0),
        ("Boolean-count",d -> d["modes"][1]["graphNodes"] = true),
        ("wrong-print-binding",d -> d["printCode"] *= " changed"),
        ("wrong-objective",d -> d["objective"] = "steps first"),
        ("unordered-mode",d -> reverse!(d["modes"])),
        ("noncanonical-histogram",d -> d["modes"][1]["stepsHistogram"]["00"] = 1),
        ("nonASCII-histogram",d -> d["modes"][1]["stepsHistogram"]["١"] = 1),
        ("zero-histogram-count",d -> d["modes"][1]["stepsHistogram"]["0"] = 0),
        ("mean-out-of-range",d -> d["modes"][1]["meanSteps"] = 100001),
        ("unknown-sample-key",d -> d["modes"][1]["samples"][1]["extra"] = 1),
        ("illegal-word",d -> d["modes"][1]["samples"][1]["words"][1] = "x"),
        ("noncanonical-word-space",d -> d["modes"][1]["samples"][1]["words"][1] *= " ")]
        mutate(name,change)
    end
    changed = deepcopy(recovery);changed["schema"] = "unknown"
    reject("unknown-schema",() -> R.parse_inputs(changed,modes);status="UNSUPPORTED")
    changed = deepcopy(recovery);changed["version"] = 1.0
    reject("floating-version",() -> R.parse_inputs(changed,modes);status="UNSUPPORTED")
    changed = deepcopy(recovery);changed["label"] = "different informational label"
    @test R.parse_inputs(changed,modes)[1] isa H.Print
    push!(results,"label-is-informational" => (parsed=true,hashWhitelist=false))
end
@testset "exact lexicographic objective and rounding" begin
    # Goals 4 and 6. Node 1 can take a single six-HTM step or two five-HTM
    # steps: the latter must win. Node 2 chooses steps ahead of total HTM.
    # Node 5 has equal above-limit and step counts and must choose lower HTM.
    starts = [1,1,2,3,7,7,8]
    sources = Int32[1,2,1,2,3,5,5]
    costs = UInt8[5,5,6,5,1,5,3]
    d,_ = R.distances(starts,sources,costs,Int32[4,6])
    @test d[1] == (0,2,10)
    @test d[2] == (0,1,5)
    @test d[5] == (0,1,3)
    @test R.round_mean(1,32) == "0.0312"
    @test R.round_mean(3,32) == "0.0938"
    push!(results,"lexicographic-traps-and-ties-to-even" => (passed=true,))
end
println(stderr,"semantic controls: native model and eighteen period bindings")
pr,parsed = R.parse_inputs(recovery,modes); E = H.build_engine(pr)
apps,goals = R.bind_periods(E,parsed,modes["appModes"])
row = recovery["modes"][5]; identity = ("S",11,1)
app = only(a for a in apps if (a.letter,a.maximum,a.direction) == identity)
@testset "bounded search versus unpruned full-frame enumeration" begin
    sample = first(s for s in row["samples"] if length(H.parse_word(s["words"][1])) <= 3)
    state = H.turn(H.source_state(pr),H.parse_word(sample["setupFromSolved"]))
    targetvalue = mod(sample["fromValue"]+1,12)
    expected = ["","S",string(targetvalue ÷ 10),string(targetvalue % 10)]
    function matches(state)
        for cell in 1:4
            i = findfirst(i -> state.p[i] == H.FRONT[cell] && state.n[i] == H.Z,1:24)
            i === nothing && return false
            pr.image[i] == expected[cell] || return false
            expected[cell] != "" && state.up[i] != H.Y && return false
        end
        true
    end
    brute = Dict{Int64,Int}()
    function visit(state,depth)
        if depth > 0 && matches(state)
            code = R.posecode(H.pose_of(E,state))
            brute[code] = min(get(brute,code,999),depth)
        end
        depth == 3 && return
        for m in 1:18
            visit(H.turn(state,[m]),depth+1)
        end
    end
    visit(state,0)
    t = Tuple(UInt8.(H.pose_of(E,state))); W = R.WordSearch(E)
    keys = R.target_keys(E,t,H.options(E,"S",targetvalue)); bounded = Dict{Int64,Int}()
    for depth in 1:3
        live = Tuple(k for k in keys if E.dist[k+1] <= depth)
        for word in R.bounded_words(W,depth,live,-1)
            endpoint = t
            for m in word
                endpoint = ntuple(c -> UInt8(E.ptrans[c][m][endpoint[c]]),8)
            end
            code = R.posecode(endpoint);bounded[code] = min(get(bounded,code,999),depth)
        end
    end
    @test !isempty(brute)
    @test bounded == brute
    push!(results,"unpruned-full-frame-depth-three-endpoints" => (passed=true,endpoints=length(brute),wordsEnumerated=18+18^2+18^3))
end
@testset "semantic count and sample controls" begin
    bad = deepcopy(row);bad["sourceDirection"] = -app.sourceDirection
    reject("wrong-selected-source-period",() -> R.check_row(E,bad,app,goals[identity]))
    bad = deepcopy(row);bad["graphNodes"] += 1
    reject("wrong-node-count",() -> R.check_row(E,bad,app,goals[identity]))
    bad = deepcopy(row);bad["edgesAtMostLimitOrForced"] += 1
    reject("wrong-complete-endpoint-count",() -> R.check_row(E,bad,app,goals[identity]))
    for (name,change) in [
        ("wrong-period-goal-count",d -> d["periodNodes"] += 1),
        ("wrong-unreachable-count",d -> d["unreachable"] = 1),
        ("wrong-forced-pose-count",d -> d["poseWithoutEdgeAtMostLimit"] += 1),
        ("wrong-step-histogram",d -> d["stepsHistogram"]["3"] += 1),
        ("wrong-above-limit-histogram",d -> d["edgesAboveLimitHistogram"]["0"] -= 1),
        ("wrong-maximum-steps",d -> d["maximumSteps"] += 1),
        ("wrong-maximum-HTM",d -> d["maximumRecoveryHTM"] += 1),
        ("wrong-rounded-mean",d -> d["meanSteps"] += 0.0001)]
        bad = deepcopy(row);change(bad)
        reject(name,() -> R.check_row(E,bad,app,goals[identity]))
    end
    # Recompute one complete graph for histogram and sample adversaries. These
    # retained distances are independently computed here, never imported verdicts.
    nodes,layers,index = R.enumerate_nodes(E,"S",11)
    starts,sources,costs,forced = R.build_graph(E,nodes,layers,index,"S",11,1)
    dist,INF = R.distances(starts,sources,costs,[index[g] for g in goals[identity]])
    @test count(==(INF),dist) == 0
    @test length(costs) == row["edgesAtMostLimitOrForced"]
    @test R.replay_samples(E,row,index,goals[identity],dist).samples == length(row["samples"])
    bad = deepcopy(row);bad["samples"][1]["words"][1] = "R"
    reject("legal-turn-wrong-display",() -> R.replay_samples(E,bad,index,goals[identity],dist))
    bad = deepcopy(row)
    for sample in bad["samples"]
        sample["words"][1] = "R R' " * sample["words"][1]
    end
    reject("reducible-nonoptimal-sample",() -> R.replay_samples(E,bad,index,goals[identity],dist))
    # A legal closed detour keeps the original source and final goal but changes
    # cost. It must not inherit the saved sample's optimality.
    bad = deepcopy(row);word = bad["samples"][1]["words"][end]
    bad["samples"][1]["words"][end] = word * " R R'"
    reject("legal-detour-honest-final-pose",() -> R.replay_samples(E,bad,index,goals[identity],dist))
end
println(H.emit(["status"=>"PASS","recoveryInputSHA256"=>rsha,"modesInputSHA256"=>msha,"controls"=>results]))
