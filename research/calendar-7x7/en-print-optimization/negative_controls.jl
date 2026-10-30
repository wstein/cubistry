#!/usr/bin/env julia
# Native Julia mutation controls for the optimized immutable print reader.
include(joinpath(@__DIR__,"assemble_and_check.jl"))

function check_negative_controls()
    original=read(joinpath(OUT,"minimum-print.tsv"),String)
    lines=split(chomp(original),'\n')
    change(row,column,value)=begin
        mutated=copy(lines);fields=split(mutated[row],'\t';keepempty=true)
        fields[column]=value;mutated[row]=join(fields,'\t');join(mutated,'\n')*"\n"
    end
    corner=findfirst(line->startswith(line,"corner\t") && !isempty(split(line,'\t';keepempty=true)[6]),lines)
    center=findfirst(line->startswith(line,"center_"),lines)
    mutations=["missing-row"=>join(lines[1:end-1],'\n')*"\n",
        "duplicate-identity"=>join(vcat(lines[1:2],[lines[2]],lines[4:end]),'\n')*"\n",
        "repainted-glyph"=>change(corner,6,"BAD"),
        "wrong-orientation"=>change(corner,7,"1"),
        "wrong-ink"=>change(corner,8,"weekday"),
        "invalid-center-identity"=>change(center,2,"25"),
        "wrong-orbit"=>change(corner,4,"0")]
    for (name,raw) in mutations
        @assert raw!=original
        mktemp() do path,io
            write(io,raw);close(io)
            rejected=false
            try
                redirect_stdout(devnull) do;check_minimum(path);end
            catch error
                error isa AssertionError || error isa BoundsError || rethrow()
                rejected=true
            end
            @assert rejected "Ineffective negative control: $name"
        end
        println("PASS rejected\t",name,"\t",bytes2hex(sha256(codeunits(raw))))
    end
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    check_negative_controls()
end
