#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Raw witnesses for the explicit month list S; this program makes no proof decision.
#   month_list_cases.jl CHAIN STATES_DIRECTORY OUT
# CHAIN is a contiguous chain from May 2026 (the stored 21-month chain). The generator writes
#   OUT/skip-positive/{months.tsv,moves.tsv,states}: S = months minus one interior month, the two edges around it merged into one
#                                                    bridge edge (concatenated moves; no solver, the end state is a real state);
#   OUT/<negative>/...: variants that every checker must reject;
#   OUT/cases.tsv: name, Julia reason, Flix reason, independent reason.
using SHA
@assert length(ARGS)==3 "month_list_cases.jl CHAIN STATES_DIRECTORY OUT"
chain,states,out=ARGS;mkpath(out)
rows=readlines(chain);@assert rows[1]=="cubistry.calendar7.chain.v1" && rows[end]=="finish"
head=rows[1:2]
function parse_edges(rows)
    edges=[];i=3
    while rows[i]!="finish"
        f=split(rows[i],'\t');@assert f[1]=="edge";j=i+1;mv=String[]
        while rows[j]!="end";push!(mv,rows[j]);j+=1;end
        push!(edges,(ym=(parse(Int,f[2]),parse(Int,f[3])),src=String(f[8]),fin=String(f[9]),moves=mv));i=j+1
    end
    edges
end
edges=parse_edges(rows)
months=[(2026,5);[e.ym for e in edges]]                    # months[k+1] is the month of state-(k+1).tsv
@assert length(months)==length(edges)+1
mtext((y,m))=string(y,'-',lpad(m,2,'0'))
listtext(ms)=join(mtext.(ms),"\n")*"\n"
sha(s)=bytes2hex(sha256(codeunits(s)))
function metrics(mv)
    g=[parse(Int,split(l,'\t')[2]) for l in mv];e=[parse(Int,split(l,'\t')[3]) for l in mv]
    h=count(x->x%7!=0,g);q=sum(abs(e[k]) for k in eachindex(g) if g[k]%7!=0;init=0)
    r=count(x->x%7==0,g);rq=sum(abs(e[k]) for k in eachindex(g) if g[k]%7==0;init=0)
    (h,q,r,rq)
end
edge_rows(e,ym,mv,src,fin)=vcat(["edge\t$(ym[1])\t$(ym[2])\t"*join(metrics(mv),'\t')*"\t$src\t$fin"],mv,["end"])
function chain_text(es;head=head)         # es: list of (ym,src,fin,moves)
    r=copy(head)
    for e in es;append!(r,edge_rows(nothing,e.ym,e.moves,e.src,e.fin));end
    join(vcat(r,["finish"]),"\n")*"\n"
end
function write_fixture(name,ms,chaintext;pin=nothing,listtext_override=nothing,statesidx=nothing)
    d=joinpath(out,name);mkpath(d)
    lt=isnothing(listtext_override) ? listtext(ms) : listtext_override
    write(joinpath(d,"months.tsv"),lt);write(joinpath(d,"months.sha256"),something(pin,sha(lt)))
    write(joinpath(d,"moves.tsv"),chaintext)
    sd=joinpath(d,"states");mkpath(sd)
    idx=isnothing(statesidx) ? collect(1:length(months)) : statesidx
    for (new,old) in enumerate(idx)
        cp(joinpath(states,"state-"*lpad(old,2,'0')*".tsv"),joinpath(sd,"state-"*lpad(new,2,'0')*".tsv");force=true)
    end
end
K=11                                          # state index of the skipped month (an interior month)
skipped=months[K]
full=[(ym=e.ym,src=e.src,fin=e.fin,moves=e.moves) for e in edges]
# bridge edge: the edges of months[K] and months[K+1] merged
merged=(ym=edges[K].ym,src=edges[K-1].src,fin=edges[K].fin,moves=vcat(edges[K-1].moves,edges[K].moves))
bridged=vcat(full[1:K-2],[merged],full[K+1:end])
ms_skip=[m for (i,m) in enumerate(months) if i!=K]
idx_skip=[i for i in 1:length(months) if i!=K]
write_fixture("skip-positive",ms_skip,chain_text(bridged);statesidx=idx_skip)
write(joinpath(out,"skipped.txt"),mtext(skipped)*"\n")
# positive with another start: 2037-05 shows the same board as 2026-05 (same weekday and leap pattern), so the stored print and the first
# seven stored edges are a chain 2037-05 .. 2037-12 once the edge months are relabeled.
rh0=split(rows[2],'\t')
write_fixture("start-2037-05",[(2037,5+k) for k in 0:7],chain_text([(ym=(2037,5+k),src=full[k].src,fin=full[k].fin,moves=full[k].moves) for k in 1:7];head=[rows[1],join(["source","5","2037","5",rh0[5]],'\t')]);statesidx=1:8)
cases=String[]
add(name,j,f,ind)=push!(cases,join((name,j,f,ind),'\t'))
# 1. a skipped month with an edge into it: S loses the month and gains a later one (same count); the original chain still has the edge into it.
ms=vcat(ms_skip,[(2028,2)]);write_fixture("skipped-month-with-edge",ms,join(vcat(rows),"\n")*"\n")
add("skipped-month-with-edge","chronological month adjacency","chronological month adjacency","chronological adjacency")
# 2. a missing member: the list lacks a month, the chain still has all edges (too many edges).
write_fixture("missing-member",ms_skip,join(rows,"\n")*"\n")
add("missing-member","at most 19 edges","at most 19 edges","edge")
# 3. wrong list hash
write_fixture("wrong-list-hash",ms_skip,chain_text(bridged);pin=repeat("0",64),statesidx=idx_skip)
add("wrong-list-hash","month list pin","month list pin","list hash")
# 4. an interior-gap chain presented as contiguous: S is the contiguous window of the same length, the chain bridges a month.
cont=[months[1]; [(2026+(4+k)÷12,(4+k)%12+1) for k in 1:length(ms_skip)-1]]
write_fixture("interior-gap-as-contiguous",cont,chain_text(bridged);statesidx=idx_skip)
add("interior-gap-as-contiguous","chronological month adjacency","chronological month adjacency","chronological adjacency")
# 5. list not increasing (two rows swapped)
sw=copy(ms_skip);sw[3],sw[4]=sw[4],sw[3];write_fixture("list-not-increasing",sw,chain_text(bridged);statesidx=idx_skip)
add("list-not-increasing","month list strictly increasing","month list strictly increasing","list strictly increasing")
# 6. duplicate member
du=copy(ms_skip);du[4]=du[3];write_fixture("list-duplicate-month",du,chain_text(bridged);statesidx=idx_skip)
add("list-duplicate-month","month list strictly increasing","month list strictly increasing","list strictly increasing")
# 7. start mismatch: the list starts at June 2026 but the chain record says May 2026
write_fixture("root-mismatch",ms_skip[2:end],chain_text(bridged);statesidx=idx_skip)
add("root-mismatch","identity root record is the first month of S","identity root record is the first month of S","root record")
# 7b. the start month is a parameter, but the identity front of the print shows May: a list starting at April 2026 with a matching record is rejected at the front
rh=split(rows[2],'\t');head_apr=[rows[1],join(["source","4","2026","4",rh[5]],'\t')]
write_fixture("start-front-mismatch",vcat([(2026,4)],ms_skip[2:end]),chain_text(bridged;head=head_apr);statesidx=idx_skip)
add("start-front-mismatch","identity root front","identity root front","identity root front")
# 7c. start 2037-05 chain presented with the list of 2026-05
rel(e,k)=(ym=(2037,5+k),src=e.src,fin=e.fin,moves=e.moves)
shifted=[rel(full[k],k) for k in 1:7]
write_fixture("start-record-mismatch",months[1:8],chain_text(shifted;head=[rows[1],join(["source","5","2037","5",rh[5]],'\t')]);statesidx=1:8)
add("start-record-mismatch","identity root record is the first month of S","identity root record is the first month of S","root record")
# 8. bridge edge declares the skipped month instead of the next member
wrong=(ym=skipped,src=merged.src,fin=merged.fin,moves=merged.moves)
write_fixture("bridge-edge-declares-skipped-month",ms_skip,chain_text(vcat(full[1:K-2],[wrong],full[K+1:end]));statesidx=idx_skip)
add("bridge-edge-declares-skipped-month","chronological month adjacency","chronological month adjacency","chronological adjacency")
# 9. bridge edge with a wrong end digest
bad=(ym=merged.ym,src=merged.src,fin=repeat("0",64),moves=merged.moves)
write_fixture("bridge-edge-wrong-end-digest",ms_skip,chain_text(vcat(full[1:K-2],[bad],full[K+1:end]));statesidx=idx_skip)
add("bridge-edge-wrong-end-digest","edge end digest","edge end digest","end hash")
# 10. non-canonical list (CRLF) and a month outside the range
write_fixture("list-crlf",ms_skip,chain_text(bridged);listtext_override=replace(listtext(ms_skip),"\n"=>"\r\n"),statesidx=idx_skip)
add("list-crlf","canonical month list UTF-8/LF","CR forbidden in canonical TSV","list is canonical LF")
write_fixture("list-month-out-of-range",ms_skip,chain_text(bridged);listtext_override=listtext(ms_skip)*"2100-02\n",statesidx=idx_skip)
add("list-month-out-of-range","month list row lies within 2026-01 to 2100-01","month list row lies within 2026-01 to 2100-01","list row in range")
open(joinpath(out,"cases.tsv"),"w") do io;for c in cases;println(io,c);end;end
println("skipped\t",mtext(skipped),"\tmembers\t",length(ms_skip),"\tcases\t",length(cases))
