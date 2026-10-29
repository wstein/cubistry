include("Checker.jl")
using .IndependentProof
using JSON
exitcode(result)=result["valid"] ? 0 : result["status"]=="UNSUPPORTED" ? 2 : result["status"]=="ERROR" ? 3 : 1
function main(args)
    root=normpath(joinpath(@__DIR__,"../.."))
    try
        length(args)>=2 || throw(IndependentProof.Invalid("UNSUPPORTED","counter FILE or state3 FILE required"))
        result=if args[1]=="conformance"
            IndependentProof.conformance(args[2];export_path=length(args)>=3 ? args[3] : nothing)
        elseif args[1] in ("counter","state3")
            IndependentProof.evaluate(args[1],args[2],length(args)>=3 ? args[3] : root)
        else
            throw(IndependentProof.Invalid("UNSUPPORTED","unknown command"))
        end
        println(JSON.json(result));return exitcode(result)
    catch e
        result=IndependentProof.invalid_result(e);println(JSON.json(result));return exitcode(result)
    end
end
exit(main(ARGS))
