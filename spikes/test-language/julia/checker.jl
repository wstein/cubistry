using JSON
using SHA
using Test

struct Sticker
    id::Int
    cubie::Int
    p::NTuple{3,Int}
    n::NTuple{3,Int}
    up::NTuple{3,Int}
    image::String
end
key(s::Sticker) = (s.id, s.cubie, s.p, s.n, s.up, s.image)
Base.:(==)(a::Sticker, b::Sticker) = key(a) == key(b)
require(ok, message) = ok || throw(ArgumentError(message))
wireint(v) = !(v isa Bool) && v isa Real && isfinite(v) && isinteger(v)
function vector(v)
    require(v isa AbstractVector && length(v) == 3 && all(wireint, v), "integer frame")
    Tuple(Int.(v))
end
const AXES = Set([(s*(i==1), s*(i==2), s*(i==3)) for i in 1:3 for s in (-1,1)])
const POSITIONS = Set([(x,y,z) for x in (-1,1) for y in (-1,1) for z in (-1,1)])
dot3(a,b) = sum(a[i]*b[i] for i in 1:3)
cross3(a,b) = (a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1])
function quarter(v, axis)
    # Integer Rodrigues formula for +90 degrees: axis x v + axis*(axis . v).
    a = ntuple(i -> Int(i == axis), 3)
    c, d = cross3(a,v), dot3(a,v)
    ntuple(i -> c[i]+a[i]*d, 3)
end
function rotated(v, axis, amount)
    for _ in 1:mod(amount,4)
        v = quarter(v,axis)
    end
    v
end
const MOVES = Dict('R'=>(1,1,-1), 'L'=>(1,-1,1), 'U'=>(2,1,-1),
                   'D'=>(2,-1,1), 'F'=>(3,1,-1), 'B'=>(3,-1,1))
function apply(state, word)
    for token in split(word)
        m = match(r"^([RLUDFB])(2|')?$", token)
        require(m !== nothing, "illegal move")
        axis, layer, direction = MOVES[first(m[1])]
        amount = direction*(m[2] == "2" ? 2 : m[2] == "'" ? -1 : 1)
        state = [s.p[axis] == layer ? Sticker(s.id,s.cubie,rotated(s.p,axis,amount),
                  rotated(s.n,axis,amount),rotated(s.up,axis,amount),s.image) : s for s in state]
    end
    state
end
inverse(word) = join([endswith(t,"2") ? t : endswith(t,"'") ? t[1:end-1] : t*"'"
                     for t in reverse(split(word))]," ")
function parseprinting(rows)
    require(rows isa AbstractVector && length(rows)==24, "24 stickers")
    result = Sticker[]
    for s in rows
        require(wireint(s["id"]) && wireint(s["cubie"]), "integer identity")
        require(s["image"] isa AbstractString, "string image")
        push!(result, Sticker(Int(s["id"]),Int(s["cubie"]),vector(s["p"]),
                              vector(s["n"]),vector(s["up"]),String(s["image"])))
    end
    result
end
function validateprinting(state)
    require(sort([s.id for s in state]) == collect(0:23), "distinct identities")
    expected = Set((p,n) for p in POSITIONS for n in AXES if dot3(p,n)==1)
    require(Set((s.p,s.n) for s in state)==expected, "physical lattice")
    require(sort(unique([s.cubie for s in state]))==collect(0:7), "eight cubies")
    positions = Set{NTuple{3,Int}}()
    for s in state
        require(s.p in POSITIONS && s.n in AXES && s.up in AXES, "axis frames")
        require(dot3(s.n,s.up)==0 && dot3(s.p,s.n)==1, "outward tangent frame")
    end
    for cubie in 0:7
        group = filter(s -> s.cubie==cubie, state)
        require(length(group)==3 && length(Set(s.p for s in group))==1, "whole cubie")
        push!(positions, group[1].p)
    end
    require(length(positions)==8, "distinct cubie positions")
end
function showfront(state,value,padded)
    front = [(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)]
    expected = ["title-left","title-right", !padded && value<10 ? " " : string(div(value,10)), string(mod(value,10))]
    for (p,image) in zip(front,expected)
        faces = filter(s -> s.p==p && s.n==(0,0,1), state)
        require(length(faces)==1 && faces[1].image==image, "immutable front image")
        require(image==" " || faces[1].up==(0,1,0), "upright image")
    end
end
function check(data)
    require(wireint(data["schema"]) && data["schema"]==1 && data["puzzle"]=="2x2x2", "schema")
    source = parseprinting(data["printing"])
    validateprinting(source)
    witnesses = data["witnesses"]
    require(all(w -> wireint(w["value"]) && w["word"] isa AbstractString, witnesses), "witness types")
    require([w["value"] for w in witnesses]==collect(0:99), "all 100 values")
    words = String[w["word"] for w in witnesses]
    unpadded = [Sticker(s.id,s.cubie,s.p,s.n,s.up,s.cubie<4 && s.image=="0" ? " " : s.image) for s in source]
    require(parseprinting(data["unpaddedPrinting"])==unpadded, "fixed unpadded print")
    require(sum(source .!= unpadded)==1, "one fixed print difference")
    states = Vector{Sticker}[]
    for value in 0:99
        state = apply(source,words[value+1])
        showfront(state,value,true)
        require(apply(state,inverse(words[value+1]))==source, "complete inverse")
        showfront(apply(unpadded,words[value+1]),value,false)
        push!(states,state)
    end
    source,words,states
end
wire(state) = [[s.id,s.cubie,collect(s.p),collect(s.n),collect(s.up),s.image] for s in state]

@testset "integer conventions" begin
    @test mod(-1,4)==3
    @test !wireint(true)
    @test wireint(1.0)
    @test !wireint(0.5)
    @test quarter((1,0,0),3)==(0,1,0)
    @test rotated((1,2,3),2,-1)==(-3,2,1)
end

function main(args)
    input, casesdir, output, repetitions = args[1],args[2],args[3],parse(Int,args[4])
    started = time_ns()
    data = JSON.parse(read(input,String))
    source,words,states = check(data)
    validation_ms = (time_ns()-started)/1e6
    controls = Dict{String,Any}[]
    for file in sort(readdir(casesdir))
        endswith(file,".json") || continue
        rejected, reason = false,""
        try
            check(JSON.parse(read(joinpath(casesdir,file),String)))
        catch err
            rejected = true
            reason = sprint(showerror,err)
        end
        require(rejected, "corruption accepted: "*file)
        push!(controls,Dict("case"=>file,"rejected"=>rejected,"reason"=>reason))
    end
    # Exact same 100 source/word replays as the Python benchmark, excluding validation.
    for word in words
        apply(source,word)
    end
    timings = Float64[]
    checksum = 0
    for _ in 1:5
        t = time_ns()
        for _ in 1:repetitions, word in words
            frame = apply(source,word)[1]
            checksum += sum(a*b for (a,b) in zip((frame.p...,frame.up...),(1,3,7,11,17,23)))
        end
        push!(timings,(time_ns()-t)/1e6)
    end
    result = Dict("juliaVersion"=>string(VERSION), "inputSHA256"=>bytes2hex(sha256(read(input))),
                  "canonicalStates"=>[wire(s) for s in states],"corruptionControls"=>controls,
                  "validationIncludingJITMs"=>validation_ms,"warmKernelSamplesMs"=>timings,
                  "repetitions"=>repetitions,"kernelWordsPerSample"=>100repetitions,
                  "checksum"=>checksum,"status"=>"PASS_FINITE_SCOPE")
    open(output,"w") do io
        write(io,JSON.json(result))
    end
end
if abspath(PROGRAM_FILE)==@__FILE__
    main(ARGS)
end
