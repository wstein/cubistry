#!/usr/bin/env julia
include(joinpath(@__DIR__,"blank_obstruction_certificate.jl"))

function negative_certificate_checks()
    source=joinpath(@__DIR__,"DE-blank-obstruction.tsv")
    raw=read(source,String)
    lines=split(raw,'\n';keepempty=false)
    excluded=findfirst(l->startswith(l,"excluded-partner\t"),lines)
    @assert !isnothing(excluded)
    changes=Dict(
        "wrong-inventory"=>replace(raw,"inventory\tA\t24\t23"=>"inventory\tA\t25\t23"),
        "wrong-language"=>replace(raw,"scope\tDE\t"=>"scope\tEN\t"),
        "wrong-start-rule"=>replace(raw,"555555555111"=>"111555555555"),
        "missing-exclusion"=>join([l for (i,l) in enumerate(lines) if i!=excluded],'\n')*"\n",
        "missing-overflow-mark"=>replace(raw,"30↶"=>"30"),
        "wrong-obstruction-month"=>replace(raw,"obstruction\t2026\t11"=>"obstruction\t2026\t10"),
        "wrong-year-domain"=>replace(raw,"scope\tDE\t2026\t2099"=>"scope\tDE\t2026\t2026"),
        "missing-final-lf"=>chop(raw;tail=1),
        "crlf"=>replace(raw,"\n"=>"\r\n"),
        "extra-record"=>raw*"allowed-partner\t3\n")
    dir=joinpath(@__DIR__,"negative-controls");mkpath(dir)
    for (name,changed) in sort!(collect(changes);by=first)
        @assert changed!=raw
        path=joinpath(dir,"$name.tsv");write(path,changed)
        rejected=false
        try
            check_blank_obstruction(path)
        catch e
            if e isa AssertionError
                rejected=true
            else
                rethrow()
            end
        end
        @assert rejected "mutated certificate accepted: $name"
        println("PASS rejected\t",name,"\t",bytes2hex(sha256(codeunits(changed))))
    end
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    negative_certificate_checks()
end
