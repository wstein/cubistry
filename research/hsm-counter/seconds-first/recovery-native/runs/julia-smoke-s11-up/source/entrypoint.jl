# Additive entrypoint: preserve every pinned issue-74 and HSM source byte.
include("Checker.jl")
include("Hsm.jl")
include("Recovery.jl")
function main(args)
    length(args) == 2 || (println("{\"valid\":false,\"status\":\"UNSUPPORTED\",\"reason\":\"RECOVERY.json MODES.json required\"}"); return 2)
    valid,status,output = IndependentRecovery.evaluate(args[1],args[2])
    println(output)
    valid ? 0 : status == "UNSUPPORTED" ? 2 : status == "ERROR" ? 3 : 1
end
exit(main(ARGS))
