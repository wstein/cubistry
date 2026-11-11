#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Verifier of a stage summary: re-reads the receipts with its own regular expressions (no code shared with stage_coverage.jl).
#   verify_stage_coverage.jl STAGES_TSV EVIDENCE_DIRECTORY SUMMARY_TSV
stages,evdir,summary=ARGS
rx_root=r"(?m)^root\t(\d+)\t(\d+)\t([0-9a-f]{64})$";rx_edge=r"(?m)^edge\t\d+\t(\d+)\t(\d+)\t\d+\t\d+\t\d+\t\d+\t[0-9a-f]{64}\t([0-9a-f]{64})\tPASS([^\n]*)$"
function info(p)
    t=read(p,String);r=match(rx_root,t);es=collect(eachmatch(rx_edge,t));v=match(r"(?m)^verdict\t(SAT|BEST_EFFORT)\t\S+\t(\d+)\t",t)
    @assert !isnothing(r) && !isempty(es) && !isnothing(v) "receipt shape"
    js=match(r"(?m)^join\tstart\t([0-9a-f]{64})$",t);je=match(r"(?m)^join\tend\t([0-9a-f]{64})$",t)
    ym(a,b)=string(a,'-',lpad(b,2,'0'))
    (free=occursin(r"(?m)^start\tfree\t",t),first=ym(r[1],r[2]),last=ym(es[end][1],es[end][2]),start=String(r[3]),fin=String(es[end][3]),verdict=String(v[1]),count=parse(Int,v[2]),
     js=isnothing(js) ? "" : String(js[1]),je=isnothing(je) ? "" : String(je[1]),exact=(v[1]=="SAT" && !any(e->occursin(r"BRIDGE|ROOTEDGE",e[4]),es)))
end
S=[]
for l in readlines(stages)
    n,j,f=split(l,'\t');@assert realpath(joinpath(evdir,j))!=realpath(joinpath(evdir,f)) "$n: receipts are one file";@assert read(joinpath(evdir,j))==read(joinpath(evdir,f)) "$n: receipts differ"
    push!(S,(name=n,i=info(joinpath(evdir,j))))
end
want=String[]
for s in S;push!(want,"stage\t$(s.name)\t$(s.i.first)\t$(s.i.last)\t$(s.i.count)\t$(s.i.verdict)\t$(s.i.exact ? "exact" : "not_exact_gapless")\t$(s.i.start)\t$(s.i.fin)");end
J=Bool[]
for k in 1:length(S)-1
    a,b=S[k].i,S[k+1].i;ok=a.last==b.first && a.fin==b.start
    st=!ok ? "mismatch" : (a.je==a.fin && b.js==b.start ? "joined" : "unchecked")
    push!(J,st=="joined");push!(want,"junction\t$(S[k].name)\t$(S[k+1].name)\t$(a.last)\t$st\t$(a.fin)\t$(b.start)")
end
let k=1,runs=0
    while k<=length(S)
        if !S[k].i.exact;k+=1;continue;end
        e=k;while e<length(S) && J[e] && S[e+1].i.exact;e+=1;end
        n=sum(S[x].i.count for x in k:e)-(e-k)
        push!(want,"$(S[k].i.free ? "free_" : "")$(e>k ? "composed" : "single")\t$(S[k].i.first)\t$(S[e].i.last)\t$n\t$(join([S[x].name for x in k:e],','))");runs+=1;k=e+1
    end
    push!(want,"counts\tstages\t$(length(S))\tjoined\t$(count(J))\tjunctions\t$(length(J))\texact_runs\t$runs")
end
@assert read(summary,String)==join(want,"\n")*"\n" "stage summary mismatch"
println("stage coverage verified: ",length(S)," stages, ",count(J)," of ",length(J)," junctions joined")
