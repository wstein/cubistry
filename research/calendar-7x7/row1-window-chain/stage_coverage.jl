#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Composition of stage chains: generator of the stage summary.
#   stage_coverage.jl STAGES_TSV EVIDENCE_DIRECTORY
# STAGES_TSV: name<TAB>Julia chain receipt<TAB>Flix chain receipt, in time order, receipt paths relative to the evidence directory.
# A stage is a chain run (chain.v1 to v3) whose Julia and Flix receipts are byte-identical. Adjacent stages A, B are joined when
#   A ends in the month B starts in, A's end digest equals B's start digest, and both receipts carry the junction line the checker
#   writes only after comparing the digest to its parameter (`join end` in A, `join start` in B). Otherwise the junction is reported
#   as mismatch (digests differ or months differ) or unchecked (no junction lines). Composition states `composed FIRST LAST N`
#   for maximal runs of exact stages (verdict SAT, no bridge or root edge) whose junctions are all joined; every other stage is listed per stage.
function read_receipt(path)
    t=read(path,String);@assert endswith(t,"\n") && !occursin('\r',t) "canonical receipt"
    ls=split(chop(t),'\n');root=nothing;last=nothing;ends=nothing;free=false;verdict=nothing;jstart=nothing;jend=nothing;gappy=false;count=nothing
    for l in ls
        f=split(l,'\t')
        if f[1]=="root";root=(parse(Int,f[2]),parse(Int,f[3]),String(f[4]));
        elseif f[1]=="edge";last=(parse(Int,f[3]),parse(Int,f[4]));ends=String(f[10]);gappy|=any(x->x in ("BRIDGE","ROOTEDGE"),f[12:end])
        elseif f[1]=="start" && f[2]=="free";free=true
        elseif f[1]=="join";f[2]=="start" ? (jstart=String(f[3])) : (jend=String(f[3]))
        elseif f[1]=="verdict";verdict=String(f[2]);count=parse(Int,f[4])
        end
    end
    @assert root!==nothing && last!==nothing && verdict in ("SAT","BEST_EFFORT") "receipt has root, edges and verdict"
    (first=(root[1],root[2]),last=last,start=root[3],finish=ends,verdict=verdict,count=count,jstart=jstart,jend=jend,free=free,exact=(verdict=="SAT" && !gappy))
end
mt((y,m))=string(y,'-',lpad(m,2,'0'))
function stage_summary(stagesfile,evdir)
    rows=[split(l,'\t') for l in readlines(stagesfile)];@assert all(r->length(r)==3,rows) && !isempty(rows) "stage rows"
    st=[]
    for (n,j,f) in rows
        a=joinpath(evdir,j);b=joinpath(evdir,f);@assert realpath(a)!=realpath(b) "$n: Julia and Flix receipts are distinct files";@assert read(a)==read(b) "$n: Julia and Flix receipts byte-identical"
        push!(st,merge((name=String(n),),read_receipt(a)))
    end
    out=String[]
    for s in st;push!(out,join(("stage",s.name,mt(s.first),mt(s.last),s.count,s.verdict,s.exact ? "exact" : "not_exact_gapless",s.start,s.finish),'\t'));end
    joined=Bool[]
    for (a,b) in zip(st[1:end-1],st[2:end])
        same=a.last==b.first && a.finish==b.start
        status=same ? ((a.jend==a.finish && b.jstart==b.start) ? "joined" : "unchecked") : "mismatch"
        push!(joined,status=="joined");push!(out,join(("junction",a.name,b.name,mt(a.last),status,a.finish,b.start),'\t'))
    end
    i=1;runs=0
    while i<=length(st)
        if !st[i].exact;i+=1;continue;end
        j=i;while j<length(st) && joined[j] && st[j+1].exact;j+=1;end
        n=sum(s.count for s in st[i:j])-(j-i)
        push!(out,join(((st[i].free ? "free_" : "")*(j>i ? "composed" : "single"),mt(st[i].first),mt(st[j].last),n,join((s.name for s in st[i:j]),',')),'\t'));runs+=1
        i=j+1
    end
    push!(out,join(("counts","stages",length(st),"joined",count(joined),"junctions",length(joined),"exact_runs",runs),'\t'))
    join(out,"\n")*"\n"
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    @assert length(ARGS)==2 "stage_coverage.jl STAGES_TSV EVIDENCE_DIRECTORY"
    print(stage_summary(ARGS...))
end
