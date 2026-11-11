#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Coverage of a month list S for a chain with a root month and a start month: generator (tsv or json).
#   month_coverage.jl tsv|json LIST LIST_SHA256 STATUS_TSV LAST_MONTH START_MONTH ROOT_MONTH BEST_EFFORT_TSV|-
# ROOT_MONTH is the identity pose (its board is shown by the solved print); START_MONTH is the first chain member (S[1] unless a
# later member is chosen); months of the list before START are before_start. Chain members from START to LAST_MONTH are exact
# unless listed in BEST_EFFORT_TSV (month<TAB>status<TAB>wrong cells r,c;r,c<TAB>evidence, status best_effort | best_effort_unverified).
# Exact runs are maximal calendar-consecutive exact members; best-effort months are reported separately and are chain members, not gaps.
# Gaps are calendar months between START and LAST_MONTH that are not in S (bridged by one edge); STATUS_TSV: month<TAB>status<TAB>evidence
# (unavailable_unsat | unknown) for them, a gap without a row is unknown.
using SHA
const FIRST=(2026,1)
idx((y,m))=y*12+m;fromidx(i)=(div(i-1,12),mod(i-1,12)+1)
mt((y,m))=string(y,'-',lpad(m,2,'0'))
function pm(t)
    m=match(r"^(\d{4})-(\d{2})$",t);@assert !isnothing(m) "month is YYYY-MM";x=Tuple(parse.(Int,m.captures));@assert 1<=x[2]<=12 "month";x
end
function read_list(path,pin)
    bytes=read(path);@assert bytes2hex(sha256(bytes))==pin "month list pin"
    t=String(bytes);@assert endswith(t,"\n") && !occursin('\r',t)
    ms=Tuple{Int,Int}[]
    for r in split(chop(t),'\n');x=pm(String(r));@assert isempty(ms)||x>ms[end] "increasing";push!(ms,x);end
    ms
end
function read_status(path)
    d=Dict{String,Tuple{String,String}}()
    for l in readlines(path)[2:end]
        f=split(l,'\t');@assert length(f)==3 && f[2] in ("unavailable_unsat","unknown");d[f[1]]=(f[2],f[3])
    end
    d
end
function read_best(path)
    d=Dict{String,Tuple{String,String,String}}()
    path=="-" && return d
    for l in readlines(path)[2:end]
        f=split(l,'\t');@assert length(f)==4 && f[2] in ("best_effort","best_effort_unverified") "best-effort row";d[f[1]]=(f[2],f[3],f[4])
    end
    d
end
function coverage(ms,status,last,START,ROOT,best)
    @assert START in ms "start month is a member";@assert last in ms && last>=START
    inlist=Set(idx.(ms));members=[m for m in ms if m>=START && m<=last]
    for k in keys(best);@assert any(m->mt(m)==k,members) "best-effort month is a chain member: $k";end
    exact=[m for m in members if !haskey(best,mt(m))]
    runs=Tuple{Tuple{Int,Int},Tuple{Int,Int}}[]
    if !isempty(exact)
        s=exact[1];p=s
        for m in exact[2:end];idx(m)==idx(p)+1 || (push!(runs,(s,p));s=m);p=m;end
        push!(runs,(s,p))
    end
    gaps=[fromidx(i) for i in idx(START):idx(last) if !(i in inlist)]
    for k in keys(status);@assert any(g->mt(g)==k,gaps) "status row for a month that is not a gap: $k";end
    bridges=[(a,b) for (a,b) in zip(members[1:end-1],members[2:end]) if idx(b)-idx(a)>1]
    before=[(fromidx(i),i in inlist) for i in idx(FIRST):idx(START)-1]
    head=!isempty(runs) && runs[1][1]==START ? runs[1] : nothing
    (members=members,runs=runs,gaps=gaps,bridges=bridges,before=before,status=status,best=best,head=head)
end
function tsv(io,c,pin,last,nlist,START,ROOT)
    h=c.head
    println(io,"headline\tplanned-exact-gapless\t",isnothing(h) ? "-\t-\t0" : string(mt(h[1]),'\t',mt(h[2]),'\t',idx(h[2])-idx(h[1])+1))
    println(io,"list\t",pin,'\t',nlist,"\troot\t",mt(ROOT),"\tstart\t",mt(START),"\trange\t",mt(FIRST),'\t',mt(last))
    println(io,"counts\tchain_members\t",length(c.members),"\texact_runs\t",length(c.runs),"\tbest_effort\t",length(c.best),"\tgaps\t",length(c.gaps),"\tbridges\t",length(c.bridges),"\tbefore_start\t",length(c.before))
    println(io,"kind\tfrom\tto\tcount\tstatus\tevidence")
    for (a,b) in c.runs;println(io,"run\t",mt(a),'\t',mt(b),'\t',idx(b)-idx(a)+1,"\tplanned_exact\t");end
    for k in sort(collect(keys(c.best)))
        st,cells,ev=c.best[k];println(io,"best_effort\t",k,'\t',k,"\t1\t",st,"\twrong=",cells," evidence=",ev)
    end
    for g in c.gaps
        st,ev=get(c.status,mt(g),("unknown","not tested"));println(io,"gap\t",mt(g),'\t',mt(g),"\t1\t",st,'\t',ev)
    end
    for (a,b) in c.bridges;println(io,"bridge\t",mt(a),'\t',mt(b),'\t',idx(b)-idx(a)-1,"\tstate-edge\tskips ",idx(b)-idx(a)-1," calendar month(s)");end
    for (m,inp) in c.before;println(io,"before_start\t",mt(m),'\t',mt(m),"\t1\tbefore_start\tprint_member=",inp ? "yes" : "no");end
end
function json(io,c,pin,last,nlist,START,ROOT)
    h=c.head;q(s)="\""*s*"\""
    println(io,"{")
    println(io,"  \"headline\": {\"kind\": \"planned-exact-gapless\", \"from\": ",isnothing(h) ? "null" : q(mt(h[1])),", \"to\": ",isnothing(h) ? "null" : q(mt(h[2])),", \"months\": ",isnothing(h) ? 0 : idx(h[2])-idx(h[1])+1,"},")
    println(io,"  \"list\": {\"sha256\": ",q(pin),", \"members\": ",nlist,", \"root\": ",q(mt(ROOT)),", \"start\": ",q(mt(START)),", \"range\": [",q(mt(FIRST)),", ",q(mt(last)),"]},")
    println(io,"  \"counts\": {\"chain_members\": ",length(c.members),", \"exact_runs\": ",length(c.runs),", \"best_effort\": ",length(c.best),", \"gaps\": ",length(c.gaps),", \"bridges\": ",length(c.bridges),", \"before_start\": ",length(c.before),"},")
    println(io,"  \"exact_runs\": [",join(["{\"from\": $(q(mt(a))), \"to\": $(q(mt(b))), \"count\": $(idx(b)-idx(a)+1)}" for (a,b) in c.runs],", "),"],")
    println(io,"  \"best_effort\": [",join(["{\"month\": $(q(k)), \"status\": $(q(c.best[k][1])), \"wrong_cells\": $(q(c.best[k][2])), \"evidence\": $(q(c.best[k][3]))}" for k in sort(collect(keys(c.best)))],", "),"],")
    gs=String[]
    for g in c.gaps;st,ev=get(c.status,mt(g),("unknown","not tested"));push!(gs,"{\"gap\": $(q(mt(g))), \"status\": $(q(st)), \"evidence\": $(q(ev))}");end
    println(io,"  \"gaps\": [",join(gs,", "),"],")
    println(io,"  \"bridges\": [",join(["{\"from\": $(q(mt(a))), \"to\": $(q(mt(b)))}" for (a,b) in c.bridges],", "),"],")
    println(io,"  \"before_start\": [",join(["{\"month\": $(q(mt(m))), \"print_member\": $(inp)}" for (m,inp) in c.before],", "),"]")
    println(io,"}")
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS)==8 "month_coverage.jl tsv|json LIST LIST_SHA256 STATUS_TSV LAST_MONTH START_MONTH ROOT_MONTH BEST_EFFORT_TSV|-"
        kind,list,pin,statusfile,lastt,startt,roott,bestf=ARGS
        last,start,root=pm(lastt),pm(startt),pm(roott);@assert (1900,1)<=root<=(2100,1) "root month in range"
        ms=read_list(list,pin);c=coverage(ms,read_status(statusfile),last,start,root,read_best(bestf))
        (kind=="tsv" ? tsv : kind=="json" ? json : error("tsv or json"))(stdout,c,pin,last,length(ms),start,root)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
