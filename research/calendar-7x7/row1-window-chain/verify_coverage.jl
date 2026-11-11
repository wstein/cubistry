#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Verifier of a coverage summary (coverage.tsv and coverage.json) against the pinned month list; shares no code with
# month_coverage.jl. It recomputes the headline, runs, gaps and before_root months from the list alone and fails on any mismatch.
# A gap marked unavailable_unsat must cite a Julia and a Flix corner receipt that are byte-identical and say UNSAT.
#   verify_coverage.jl LIST LIST_SHA256 COVERAGE_TSV COVERAGE_JSON EVIDENCE_DIR
# Coverage bookkeeping only: the UNSAT facts are the cited receipts of the Julia and Flix corner checkers.
using SHA, Dates
list,pin,tsvpath,jsonpath,evdir=ARGS
d(s)=Date(parse(Int,s[1:4]),parse(Int,s[6:7]),1)
txt(x)=Dates.format(x,"yyyy-mm")
mdiff(a,b)=(year(a)-year(b))*12+month(a)-month(b)
function main()
    bytes=read(list);@assert bytes2hex(sha256(bytes))==pin "month list pin"
    raw=String(bytes);@assert endswith(raw,"\n") && !occursin('\r',raw)
    rows=split(chop(raw),'\n');@assert all(r->occursin(r"^\d{4}-\d{2}$",r),rows)
    S=[d(r) for r in rows];@assert issorted(S) && allunique(S) "increasing list"
    inS=Set(S);ROOT=Date(2026,5,1);FIRST=Date(2026,1,1);@assert ROOT in inS "root in list"
    L=readlines(tsvpath);@assert endswith(read(tsvpath,String),"\n")
    f(i)=split(L[i],'\t')
    # range and list line
    h=f(2);@assert h[1]=="list" && h[2]==pin && parse(Int,h[3])==length(S) && h[4]=="root" && h[5]==txt(ROOT) && h[6]=="range" && h[7]==txt(FIRST) "list line"
    LAST=d(h[8]);@assert LAST in inS "range end is a member"
    # headline
    last_run=ROOT;while (last_run+Month(1)) in inS && last_run+Month(1)<=LAST;last_run+=Month(1);end
    n=mdiff(last_run,ROOT)+1
    hl=f(1);@assert hl==["headline","chain-gapless",txt(ROOT),txt(last_run),string(n)] "headline mismatch: recomputed $(txt(ROOT)) .. $(txt(last_run)) ($n months)"
    # classify every month of the range
    members=[m for m in S if m>=ROOT && m<=LAST]
    gaps=[m for m in ROOT:Month(1):LAST if !(m in inS)]
    before=[(m,m in inS) for m in FIRST:Month(1):ROOT-Month(1)]
    runs=Tuple{Date,Date}[];s=members[1];p=s
    for m in members[2:end];m==p+Month(1) || (push!(runs,(s,p));s=m);p=m;end;push!(runs,(s,p))
    c=f(3);@assert c==["counts","chain_members",string(length(members)),"runs",string(length(runs)),"gaps",string(length(gaps)),"bridges",string(length(runs)-1),"before_root",string(length(before))] "counts mismatch"
    @assert L[4]=="kind\tfrom\tto\tcount\tstatus\tevidence"
    got=[f(i) for i in 5:length(L)]
    runrows=[r for r in got if r[1]=="run"];gaprows=[r for r in got if r[1]=="gap"];bridgerows=[r for r in got if r[1]=="bridge"];beforerows=[r for r in got if r[1]=="before_root"]
    @assert length(runrows)+length(gaprows)+length(bridgerows)+length(beforerows)==length(got) "unknown row kind"
    @assert [(r[2],r[3],r[4]) for r in runrows]==[(txt(a),txt(b),string(mdiff(b,a)+1)) for (a,b) in runs] "runs mismatch"
    @assert [r[2] for r in gaprows]==txt.(gaps) && all(r->r[2]==r[3] && r[4]=="1",gaprows) "gaps mismatch"
    @assert [(r[2],r[3],r[4]) for r in bridgerows]==[(txt(runs[k][2]),txt(runs[k+1][1]),string(mdiff(runs[k+1][1],runs[k][2])-1)) for k in 1:length(runs)-1] "bridges mismatch"
    @assert [(r[2],r[6]) for r in beforerows]==[(txt(m),"print_member="*(inp ? "yes" : "no")) for (m,inp) in before] "before_root mismatch"
    @assert all(r->r[5]=="before_root",beforerows)
    # no month is both a run member and a gap; runs and gaps partition root..LAST
    runmonths=Set(m for (a,b) in runs for m in a:Month(1):b)
    @assert isempty(intersect(runmonths,Set(gaps))) && union(runmonths,Set(gaps))==Set(ROOT:Month(1):LAST) "partition of the range"
    # evidence of every gap
    for r in gaprows
        @assert r[5] in ("unavailable_unsat","unknown") "gap status"
        if r[5]=="unavailable_unsat"
            ev=split(r[6],';');@assert length(ev)==2 "UNSAT needs a Julia and a Flix receipt"
            a,b=joinpath(evdir,ev[1]),joinpath(evdir,ev[2]);@assert isfile(a) && isfile(b) "receipts exist"
            @assert read(a)==read(b) "Julia and Flix receipts byte-identical"
            rl=readlines(a);@assert "verdict\tUNSAT\tfixed-print-corner-body-matching\tunique-always-visible-face" in rl "receipt says UNSAT"
            tg=[split(l,'\t') for l in rl if startswith(l,"target\t")]
            tm=[string(t[3],'-',lpad(t[4],2,'0')) for t in tg]
            @assert r[2] in tm "receipt contains the gap month"
            @assert all(t->t==r[2] || d(t) in inS,tm) "receipt targets are members of the list"
        else
            @assert r[6]=="not tested" || !occursin("UNSAT",r[6]) "unknown gap must not claim UNSAT"
        end
    end
    # json agrees with the tsv
    J=read(jsonpath,String)
    @assert occursin("\"headline\": {\"kind\": \"chain-gapless\", \"from\": \"$(txt(ROOT))\", \"to\": \"$(txt(last_run))\", \"months\": $n}",J) "json headline mismatch"
    @assert occursin("\"counts\": {\"chain_members\": $(length(members)), \"runs\": $(length(runs)), \"gaps\": $(length(gaps)), \"bridges\": $(length(runs)-1), \"before_root\": $(length(before))}",J) "json counts mismatch"
    @assert [m.captures[1] for m in eachmatch(r"\{\"month\": \"(\d{4}-\d{2})\", \"status\"",J)]==txt.(gaps) "json gaps mismatch"
    @assert [(m.captures[1],m.captures[2]) for m in eachmatch(r"\{\"from\": \"(\d{4}-\d{2})\", \"to\": \"(\d{4}-\d{2})\", \"count\"",J)]==[(txt(a),txt(b)) for (a,b) in runs] "json runs mismatch"
    @assert [(m.captures[1],m.captures[2]) for m in eachmatch(r"\{\"month\": \"(\d{4}-\d{2})\", \"print_member\": (true|false)\}",J)]==[(txt(m),string(inp)) for (m,inp) in before] "json before_root mismatch"
    println("coverage verified\t",txt(ROOT)," .. ",txt(last_run)," (",n," months)\truns ",length(runs),"\tgaps ",length(gaps),"\tunsat gaps ",count(r->r[5]=="unavailable_unsat",gaprows),"\tbefore_root ",length(before))
end
try main() catch e;println(stderr,"INVALID\t",sprint(showerror,e));exit(1) end
