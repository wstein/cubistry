#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Verifier of a coverage summary (coverage.tsv and coverage.json) against the pinned month list; shares no code with
# month_coverage.jl. It recomputes the headline, exact runs, best-effort months, gaps, bridges and before_start months from the list
# alone and fails on any mismatch. Evidence rules:
#   gap unavailable_unsat      two byte-identical Julia and Flix corner receipts that say UNSAT and contain the gap month;
#   best_effort                two byte-identical Julia and Flix chain receipts with the edge line of that month ending in
#                              BEST_EFFORT, the number of wrong cells and the same cells;
#   best_effort_unverified     a Hall-witness table (february_hall.jl format, Julia only) with the same wrong cells; no chain receipt.
#   verify_coverage.jl LIST LIST_SHA256 COVERAGE_TSV COVERAGE_JSON EVIDENCE_DIR START_MONTH ROOT_MONTH
# Coverage bookkeeping only: the facts are the cited receipts of the Julia and Flix checkers.
using SHA, Dates
list,pin,tsvpath,jsonpath,evdir,startt,roott=ARGS
d(s)=Date(parse(Int,s[1:4]),parse(Int,s[6:7]),1)
txt(x)=Dates.format(x,"yyyy-mm")
mdiff(a,b)=(year(a)-year(b))*12+month(a)-month(b)
function cellsof(s);isempty(s) ? Tuple{Int,Int}[] : [Tuple(parse.(Int,split(t,','))) for t in split(s,';')];end
function main()
    bytes=read(list);@assert bytes2hex(sha256(bytes))==pin "month list pin"
    raw=String(bytes);@assert endswith(raw,"\n") && !occursin('\r',raw)
    rows=split(chop(raw),'\n');@assert all(r->occursin(r"^\d{4}-\d{2}$",r),rows)
    S=[d(r) for r in rows];@assert issorted(S) && allunique(S) "increasing list"
    inS=Set(S);START=d(startt);ROOT=d(roott);FIRST=Date(2026,1,1);@assert START in inS "start in list"
    L=readlines(tsvpath);@assert endswith(read(tsvpath,String),"\n")
    f(i)=split(L[i],'\t')
    h=f(2);@assert h[1]=="list" && h[2]==pin && parse(Int,h[3])==length(S) && h[4]=="root" && h[5]==txt(ROOT) && h[6]=="start" && h[7]==txt(START) && h[8]=="range" && h[9]==txt(FIRST) "list line"
    LAST=d(h[10]);@assert LAST in inS "range end is a member"
    @assert L[4]=="kind\tfrom\tto\tcount\tstatus\tevidence"
    got=[f(i) for i in 5:length(L)]
    runrows=[r for r in got if r[1]=="run"];berows=[r for r in got if r[1]=="best_effort"];gaprows=[r for r in got if r[1]=="gap"];bridgerows=[r for r in got if r[1]=="bridge"];beforerows=[r for r in got if r[1]=="before_start"]
    @assert length(runrows)+length(berows)+length(gaprows)+length(bridgerows)+length(beforerows)==length(got) "unknown row kind"
    members=[m for m in S if m>=START && m<=LAST]
    bemonths=[r[2] for r in berows]
    @assert bemonths==sort(bemonths) && allunique(bemonths) && all(m->d(m) in members,bemonths) "best-effort months are chain members"
    exact=[m for m in members if !(txt(m) in bemonths)]
    gaps=[m for m in START:Month(1):LAST if !(m in inS)]
    before=[(m,m in inS) for m in FIRST:Month(1):START-Month(1)]
    runs=Tuple{Date,Date}[]
    if !isempty(exact)
        s=exact[1];p=s;for m in exact[2:end];m==p+Month(1) || (push!(runs,(s,p));s=m);p=m;end;push!(runs,(s,p))
    end
    # headline recomputed: the exact run that starts at START
    hrun=START;n0=0
    if !(txt(START) in bemonths)
        while (hrun+Month(1)) in inS && hrun+Month(1)<=LAST && !(txt(hrun+Month(1)) in bemonths);hrun+=Month(1);end
        n0=mdiff(hrun,START)+1
    end
    expect=n0==0 ? ["headline","exact-gapless","-","-","0"] : ["headline","exact-gapless",txt(START),txt(hrun),string(n0)]
    @assert f(1)==expect "headline mismatch: recomputed $(join(expect[3:5]," "))"
    bridges=[(a,b) for (a,b) in zip(members[1:end-1],members[2:end]) if mdiff(b,a)>1]
    c=f(3);@assert c==["counts","chain_members",string(length(members)),"exact_runs",string(length(runs)),"best_effort",string(length(berows)),"gaps",string(length(gaps)),"bridges",string(length(bridges)),"before_start",string(length(before))] "counts mismatch"
    @assert [(r[2],r[3],r[4],r[5]) for r in runrows]==[(txt(a),txt(b),string(mdiff(b,a)+1),"exact") for (a,b) in runs] "runs mismatch"
    @assert [r[2] for r in gaprows]==txt.(gaps) && all(r->r[2]==r[3] && r[4]=="1",gaprows) "gaps mismatch"
    @assert [(r[2],r[3],r[4]) for r in bridgerows]==[(txt(a),txt(b),string(mdiff(b,a)-1)) for (a,b) in bridges] "bridges mismatch"
    @assert [(r[2],r[6]) for r in beforerows]==[(txt(m),"print_member="*(inp ? "yes" : "no")) for (m,inp) in before] "before_start mismatch"
    runmonths=Set(m for (a,b) in runs for m in a:Month(1):b)
    @assert isempty(intersect(runmonths,Set(gaps))) && union(runmonths,Set(gaps),Set(d.(bemonths)))==Set(START:Month(1):LAST) "partition of the range"
    for r in gaprows
        @assert r[5] in ("unavailable_unsat","unknown") "gap status"
        if r[5]=="unavailable_unsat"
            ev=split(r[6],';');@assert length(ev)==2 "UNSAT needs a Julia and a Flix receipt"
            a,b=joinpath(evdir,ev[1]),joinpath(evdir,ev[2]);@assert isfile(a) && isfile(b) "receipts exist"
            @assert read(a)==read(b) "Julia and Flix receipts byte-identical"
            rl=readlines(a);@assert "verdict\tUNSAT\tfixed-print-corner-body-matching\tunique-always-visible-face" in rl "receipt says UNSAT"
            tm=[string(t[3],'-',lpad(t[4],2,'0')) for t in (split(l,'\t') for l in rl if startswith(l,"target\t"))]
            @assert r[2] in tm "receipt contains the gap month"
            @assert all(t->t==r[2] || d(t) in inS,tm) "receipt targets are members of the list"
        else
            @assert r[6]=="not tested" || !occursin("UNSAT",r[6]) "unknown gap must not claim UNSAT"
        end
    end
    for r in berows
        @assert r[5] in ("best_effort","best_effort_unverified") "best-effort status";@assert r[2]==r[3] && r[4]=="1"
        mm=match(r"^wrong=(\S+) evidence=(.+)$",r[6]);@assert !isnothing(mm) "best-effort evidence field";cells=cellsof(mm.captures[1]);@assert !isempty(cells) "best-effort month lists its wrong cells"
        ev=mm.captures[2]
        if r[5]=="best_effort"
            ps=split(ev,';');@assert length(ps)==2 "best-effort needs a Julia and a Flix chain receipt"
            a,b=joinpath(evdir,ps[1]),joinpath(evdir,ps[2]);@assert isfile(a) && isfile(b) "receipts exist"
            @assert read(a)==read(b) "Julia and Flix receipts byte-identical"
            want="\tBEST_EFFORT\t$(length(cells))\t$(mm.captures[1])"
            y,mo=parse.(Int,split(r[2],'-'))
            @assert any(l->startswith(l,"edge\t") && endswith(l,want) && split(l,'\t')[3]==string(y) && split(l,'\t')[4]==string(mo),readlines(a)) "chain receipt has the best-effort edge line of the month"
        else
            file=joinpath(evdir,ev);@assert isfile(file) "Hall witness table exists"
            rr=[split(l,'\t') for l in readlines(file)[2:end] if startswith(l,r[2]*"\t")]
            u=sort(vcat([cellsof(x[4]) for x in rr]...),by=rc->rc[1]*7+rc[2])
            @assert u==sort(cells,by=rc->rc[1]*7+rc[2]) "Hall witness table gives the same wrong cells"
        end
    end
    J=read(jsonpath,String)
    @assert occursin("\"headline\": {\"kind\": \"exact-gapless\", \"from\": "*(n0==0 ? "null, \"to\": null, \"months\": 0}" : "\"$(txt(START))\", \"to\": \"$(txt(hrun))\", \"months\": $n0}"),J) "json headline mismatch"
    @assert occursin("\"counts\": {\"chain_members\": $(length(members)), \"exact_runs\": $(length(runs)), \"best_effort\": $(length(berows)), \"gaps\": $(length(gaps)), \"bridges\": $(length(bridges)), \"before_start\": $(length(before))}",J) "json counts mismatch"
    @assert [m.captures[1] for m in eachmatch(r"\{\"gap\": \"(\d{4}-\d{2})\"",J)]==txt.(gaps) "json gaps mismatch"
    @assert [m.captures[1] for m in eachmatch(r"\{\"month\": \"(\d{4}-\d{2})\", \"status\": \"best_effort",J)]==bemonths "json best-effort mismatch"
    @assert [(m.captures[1],m.captures[2]) for m in eachmatch(r"\{\"month\": \"(\d{4}-\d{2})\", \"status\": \"(best_effort\w*)\"",J)]==[(r[2],r[5]) for r in berows] "json best-effort status mismatch"
    @assert [(m.captures[1],m.captures[2]) for m in eachmatch(r"\{\"from\": \"(\d{4}-\d{2})\", \"to\": \"(\d{4}-\d{2})\", \"count\"",J)]==[(txt(a),txt(b)) for (a,b) in runs] "json runs mismatch"
    @assert [(m.captures[1],m.captures[2]) for m in eachmatch(r"\{\"month\": \"(\d{4}-\d{2})\", \"print_member\": (true|false)\}",J)]==[(txt(m),string(inp)) for (m,inp) in before] "json before_start mismatch"
    println("coverage verified\texact ",n0==0 ? "none" : txt(START)*" .. "*txt(hrun)*" ("*string(n0)*" months)","\texact runs ",length(runs),"\tbest-effort ",length(berows),"\tgaps ",length(gaps),"\tunsat gaps ",count(r->r[5]=="unavailable_unsat",gaprows),"\tbefore_start ",length(before))
end
try main() catch e;println(stderr,"INVALID\t",sprint(showerror,e));exit(1) end
