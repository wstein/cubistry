#!/usr/bin/env julia
# Necessary geometry and immutable-source audit only; not a SAT certificate.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))
function source_options(source,pos,wanted)
    result=Any[]
    for (id,s) in enumerate(source),r in ROTATIONS
        rotate(s.home,r)==pos && rotate(s.normal,r)==FRONT_NORMAL || continue
        up=rotate(s.up,r);q=findfirst(==(up),IMAGE_UPS)-1
        image_normal(s.text,q,s.ink)==image_normal(wanted[1],0,wanted[2]) || continue
        push!(result,(id=id,piece=s.piece,home=s.home,normal=s.normal,up=s.up,rotation=r))
    end
    result
end
function main_probe()
    source=read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    for (name,pos,wanted) in [("one-center",(0,1,3),("1","dark")),("eight-center",(1,0,3),("8","dark")),("twentyfour-corner",(-3,-3,3),("24","red")),("thirtyone-corner",(3,-3,3),("31","red"))]
        options=source_options(source,pos,wanted)
        println("role\t",name,"\t",length(options))
        for s in options
            println("source\t",name,'\t',s.id,'\t',s.piece,'\t',join(s.home,','),'\t',join(s.normal,','),'\t',join(s.up,','))
        end
    end
    println("UNKNOWN: source inventory and geometric compatibility do not establish coupled legal reachability or move savings.")
end
if abspath(PROGRAM_FILE)==@__FILE__;main_probe();end
