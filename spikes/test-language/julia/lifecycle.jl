# Emit runtime readiness before loading project modules; never compare this clock
# with a parent timestamp. Only relative child durations cross the pipe.
println("CUBISTRY_PHASE {\"event\":\"READY\"}")
flush(stdout)
load_started = time_ns()
include("checker.jl")
load_elapsed = (time_ns()-load_started)/1e6
function emit_phase(event)
    println("CUBISTRY_PHASE " * JSON.json(event))
    flush(stdout)
end
emit_phase(Dict("event"=>"LOAD", "elapsedMs"=>load_elapsed,
                "scope"=>"load JSON/SHA/Test modules and checker definitions; no validation omitted"))
function lifecycle(input,casesdir)
    for iteration in 0:3
        started = time_ns()
        _,_,states,controls,_,contracts = verify_suite(input,casesdir)
        checksum = bytes2hex(sha256(JSON.json([wire(s) for s in states])))
        elapsed = (time_ns()-started)/1e6
        emit_phase(Dict("event"=>"RESULT", "iteration"=>iteration, "elapsedMs"=>elapsed,
                        "values"=>length(states), "fullStickerFrames"=>24length(states),
                        "inverseChecks"=>length(states), "negativeControls"=>length(controls),
                        "languageAssertions"=>contracts, "checksum"=>checksum,
                        "scope"=>"fresh JSON, full padded/unpadded suite, all negatives and output checksum"))
    end
    emit_phase(Dict("event"=>"DONE", "completedRuns"=>4))
end
lifecycle(ARGS[1],ARGS[2])
