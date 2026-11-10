#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Prepare only explicit targeted mutants in an unused workspace scratch folder.
@assert length(ARGS)==3 && ARGS[1]=="--mutations" "prepare_mutants.jl --mutations FLIX_BUILD NEW_OUT"
build=abspath(ARGS[2]);out=abspath(ARGS[3]);@assert !ispath(out) "fresh mutation scratch directory"
mkpath(out)
julia_source=read(joinpath(@__DIR__,"lemma.jl"),String)
flix_source=read(joinpath(@__DIR__,"flix/src/Main.flix"),String)
mutants=[
    ("capacity","required==bodies*faces &&","true &&","required==bodies*faces and","true and"),
    ("singleton","peak==1 &&","peak>=0 &&","peak==1 and","peak>=0 and"),
    ("nonempty-domain","total>0 &&","true &&","total>0 and","true and"),
    ("all-targets","present==total &&","true &&","present==total and","true and"),
    ("body-faces","required-1>(bodies-1)*faces","required-1>bodies*faces","required-1>(bodies-1)*faces","required-1>bodies*faces")
]
for (name,julia_from,julia_to,flix_from,flix_to) in mutants
    @assert occursin(julia_from,julia_source) && occursin(flix_from,flix_source)
    dir=joinpath(out,name);mkpath(joinpath(dir,"julia"))
    write(joinpath(dir,"julia/lemma.jl"),replace(julia_source,julia_from=>julia_to;count=1))
    cp(joinpath(@__DIR__,"test_lemma.jl"),joinpath(dir,"julia/test_lemma.jl"))
    cp(build,joinpath(dir,"flix"))
    write(joinpath(dir,"flix/src/Main.flix"),replace(flix_source,flix_from=>flix_to;count=1))
    println(name)
end
println("mutants prepared: five, Julia and Flix; full sweep not run")
