# Focused exact-decimal regression controls; no graph or saved verdict is used.
include("Checker.jl")
include("Hsm.jl")
include("Recovery.jl")
using JSON, Test, SHA
const R = IndependentRecovery
const IP = IndependentProof
length(ARGS) == 2 || error("RECOVERY.json MODES.json required")
raw = read(ARGS[1],String); recovery,rsha = R.read_raw(ARGS[1]); modes,_ = R.read_raw(ARGS[2])
records = Pair{String,Any}[]
@testset "canonical exact JSON decimals" begin
    expected = R.decimal_canonical("3.3199")
    for token in ("3.3199","3.31990000000000000000","33199e-4","3.3199e+0","0.33199E1")
        @test R.decimal_canonical(token) == expected
    end
    @test R.decimal_canonical("3.31990000000000000001") != expected
    @test JSON.parse("3.31990000000000000001") == JSON.parse("3.3199")
    @test R.decimal_canonical("-0.000e-999999999999999999999") == R.decimal_canonical("0")
    @test R.decimal_canonical("1e-" * repeat("9",100)) != expected
    @test R.decimal_canonical("1e+" * repeat("9",100)) != expected
    for token in ("03.3199","+3.3199","3.","3e","3.3199\n",repeat("1",129))
        @test_throws IP.Invalid R.decimal_canonical(token)
    end
    push!(records,"exact-canonical-decimal-controls" => (passed=true,))
end
@testset "raw tokens, escaped keys, decoys and input binding" begin
    original = R.mean_lexemes(ARGS[1],rsha)
    @test length(original) == 18
    @test original[5] == "3.3199"
    mktempdir() do dir
        function readvariant(name,text)
            path = joinpath(dir,name*".json");write(path,text)
            parsed,sha = R.read_raw(path)
            R.parse_inputs(parsed,modes)
            path,sha,R.mean_lexemes(path,sha)
        end
        scientific = replace(raw,"\"meanSteps\": 3.3199" => "\"meanSteps\": 33199e-4";count=1)
        @test scientific != raw
        _,_,tokens = readvariant("scientific-equivalent",scientific)
        @test R.check_mean_token(tokens[5],original[5])
        push!(records,"scientific-equivalent-raw-number" => (passed=true,))
        colliding = replace(raw,"\"meanSteps\": 3.3199" => "\"meanSteps\": 3.31990000000000000001";count=1)
        _,_,tokens = readvariant("float-colliding-nearby-number",colliding)
        @test_throws IP.Invalid R.check_mean_token(tokens[5],original[5])
        push!(records,"float-colliding-raw-number-rejected-exactly" => (passed=true,))
        decoy = deepcopy(recovery)
        decoy["label"] = "a label containing \"meanSteps\": 0 and \\\"meanSteps\\\": 9999"
        text = replace(JSON.json(decoy),"\"meanSteps\":" => "\"mean\\u0053teps\":")
        path,sha,tokens = readvariant("escaped-key-and-label-decoys",text)
        @test all(R.decimal_canonical(a) == R.decimal_canonical(b) for (a,b) in zip(tokens,original))
        push!(records,"escaped-real-keys-and-label-string-decoys" => (passed=true,))
        write(path,text*" ")
        error = try R.mean_lexemes(path,sha);nothing catch e;e end
        @test error isa IP.Invalid && error.code == "ERROR"
        push!(records,"changed-raw-input-binding-rejected" => (passed=true,))
    end
end
println(IndependentHsm.emit(["status"=>"PASS","recoveryInputSHA256"=>rsha,"controls"=>records]))
