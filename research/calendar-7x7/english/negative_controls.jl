#!/usr/bin/env julia
# Native Julia consumes the SAME corrupt raw inputs as the independent Flix run.
# Fixture generation is in the Flix process driver; it makes no proof decisions.
include(joinpath(@__DIR__,"replay_legal.jl"))

function native_negative_checks()
    fixture=joinpath(@__DIR__,"flix","negative-controls")
    report=String["case\texpected\tactual\tinput-sha256\n"]
    function expect_rejection(name,path,check)
        rejected=false
        try
            check()
        catch e
            e isa InterruptException && rethrow()
            rejected=true
        end
        @assert rejected "Corrupt input accepted: $name"
        push!(report,"$name\treject\treject\t$(bytes2hex(sha256(read(path))))\n")
        println("PASS rejected\t",name)
        GC.gc(false)
    end
    for name in ["foreign-seed","missing-seed","forward-reference","node-gap",
        "product-after-result","unknown-result","duplicate-result","missing-result",
        "noncanonical-integer","wrong-degree","crlf","missing-final-lf"]
        path=joinpath(fixture,"$name.dag.tsv")
        expect_rejection(name,path,()->replay_dag(path))
    end
    for name in ["core-up","nonblank239","missing-sticker","wrong-targets",
        "overflow-unused-blank","up-int32-min","up-int32-max","up-out-of-range",
        "up-zero","up-diagonal","normal-overflow","up-not-tangent","normal-inward"]
        dir=joinpath(fixture,name)
        input=name=="wrong-targets" ? "targets.tsv" : "physical-print.tsv"
        expect_rejection(name,joinpath(dir,input),()->check_data(dir))
    end
    identity_path=joinpath(fixture,"identity-legal.dag.tsv")
    identity=replay_dag(identity_path)
    @assert all(iszero,values(identity.targets))
    println("PASS: identity-only DAG is legal but does not imply correct target optics.")
    expect_rejection("identity-wrong-targets",identity_path,()->main_replay(identity_path))
    check_data(joinpath(fixture,"valid-unused-blank-axis"))
    push!(report,"valid-unused-blank-axis\taccept\taccept\t$(bytes2hex(sha256(read(joinpath(fixture,"valid-unused-blank-axis","physical-print.tsv")))))\n")
    println("PASS accepted\tvalid-unused-blank-axis")
    write(joinpath(@__DIR__,"evidence","julia-negative-checks.tsv"),join(report))
    println("PASS:26 shared raw corrupt cases rejected; valid alternative blank axis accepted. No cross-checker dissent remains on these controls.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    native_negative_checks()
end
