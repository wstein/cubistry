println("CUBISTRY_PHASE {\"event\":\"READY\"}")
flush(stdout)
started=time_ns()
include("Checker.jl")
using .IndependentProof, JSON
loaded=(time_ns()-started)/1e6
function marker(value)
    println("CUBISTRY_PHASE "*JSON.json(value));flush(stdout)
end
marker(Dict("event"=>"LOAD","elapsedMs"=>loaded,"scope"=>"load full independent checker, parser and definitions; first-call JIT remains"))
function lifecycle(root)
    for iteration in 0:3
        started=time_ns()
        result=IndependentProof.conformance(root)
        elapsed=(time_ns()-started)/1e6
        marker(Dict("event"=>"RESULT","iteration"=>iteration,"elapsedMs"=>elapsed,
            "values"=>result["counterAccepted"]*100+result["geometryAccepted"]+result["kernelReferences"]+result["centerGenerators"],
            "negativeControls"=>result["counterRejected"]+result["geometryRejected"],
            "counterCases"=>result["counterCases"],"geometryCases"=>result["geometryCases"],
            "kernelReferences"=>result["kernelReferences"],"centerGenerators"=>result["centerGenerators"],
            "geometryWitnessesReplayed"=>result["geometryWitnessesReplayed"],
            "checksum"=>result["fullStateAggregateSHA256"],"manifestSHA256"=>result["manifestSHA256"],
            "scope"=>"complete raw certificate and marked-cube conformance; all pinned negatives, generators, references and inverses"))
    end
    marker(Dict("event"=>"DONE","completedRuns"=>4))
end
lifecycle(ARGS[1])
