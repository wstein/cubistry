#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Coverage of a month list S: generator (tsv or json) for the chain from the start month (the chain root).
#   month_coverage.jl tsv|json LIST LIST_SHA256 STATUS_TSV LAST_MONTH START_MONTH
# LIST is the print month list (strictly increasing, pinned). Months from the root on are chain members; a month before the root
# that fits the print is before_root (not a chain member, not a gap). Gaps lie between the root and LAST_MONTH and are bridged
# by one state edge. STATUS_TSV: month<TAB>status<TAB>evidence for gaps (unavailable_unsat | unknown); a gap without a row is unknown.
using SHA
const FIRST=(2026,1)
idx((y,m))=y*12+m;fromidx(i)=(div(i-1,12),mod(i-1,12)+1)
mt((y,m))=string(y,'-',lpad(m,2,'0'))
function read_list(path,pin)
    bytes=read(path);@assert bytes2hex(sha256(bytes))==pin "month list pin"
    t=String(bytes);@assert endswith(t,"\n") && !occursin('\r',t)
    ms=Tuple{Int,Int}[]
    for r in split(chop(t),'\n')
        m=match(r"^(\d{4})-(\d{2})$",r);@assert !isnothing(m);x=Tuple(parse.(Int,m.captures));@assert 1<=x[2]<=12 && (isempty(ms)||x>ms[end]) "increasing"
        push!(ms,x)
    end
    ms
end
function read_status(path)
    d=Dict{String,Tuple{String,String}}()
    for l in readlines(path)[2:end]
        f=split(l,'\t');@assert length(f)==3 && f[2] in ("unavailable_unsat","unknown");d[f[1]]=(f[2],f[3])
    end
    d
end
function coverage(ms,status,last,ROOT)
    @assert ROOT in ms "root month is a member";@assert last in ms && last>=ROOT
    inlist=Set(idx.(ms))
    members=[m for m in ms if m>=ROOT && m<=last]
    runs=Tuple{Tuple{Int,Int},Tuple{Int,Int}}[];s=members[1];p=s
    for m in members[2:end]
        idx(m)==idx(p)+1 || (push!(runs,(s,p));s=m);p=m
    end
    push!(runs,(s,p))
    gaps=[fromidx(i) for i in idx(ROOT):idx(last) if !(i in inlist)]
    for k in keys(status);@assert any(g->mt(g)==k,gaps) "status row for a month that is not a gap: $k";end
    before=[(fromidx(i),i in inlist) for i in idx(FIRST):idx(ROOT)-1]
    (members=members,runs=runs,gaps=gaps,before=before,status=status)
end
function tsv(io,c,pin,last,nlist,ROOT)
    r=c.runs[1]
    println(io,"headline\tchain-gapless\t",mt(r[1]),'\t',mt(r[2]),'\t',idx(r[2])-idx(r[1])+1)
    println(io,"list\t",pin,'\t',nlist,"\troot\t",mt(ROOT),"\trange\t",mt(FIRST),'\t',mt(last))
    println(io,"counts\tchain_members\t",length(c.members),"\truns\t",length(c.runs),"\tgaps\t",length(c.gaps),"\tbridges\t",length(c.runs)-1,"\tbefore_root\t",length(c.before))
    println(io,"kind\tfrom\tto\tcount\tstatus\tevidence")
    for (a,b) in c.runs;println(io,"run\t",mt(a),'\t',mt(b),'\t',idx(b)-idx(a)+1,"\tchain\t");end
    for g in c.gaps
        st,ev=get(c.status,mt(g),("unknown","not tested"))
        println(io,"gap\t",mt(g),'\t',mt(g),"\t1\t",st,'\t',ev)
    end
    for k in 1:length(c.runs)-1
        a=c.runs[k][2];b=c.runs[k+1][1]
        println(io,"bridge\t",mt(a),'\t',mt(b),'\t',idx(b)-idx(a)-1,"\tstate-edge\tskips ",idx(b)-idx(a)-1," calendar month(s)")
    end
    for (m,inp) in c.before;println(io,"before_root\t",mt(m),'\t',mt(m),"\t1\tbefore_root\tprint_member=",inp ? "yes" : "no");end
end
function json(io,c,pin,last,nlist,ROOT)
    r=c.runs[1];q(s)="\""*s*"\""
    println(io,"{")
    println(io,"  \"headline\": {\"kind\": \"chain-gapless\", \"from\": ",q(mt(r[1])),", \"to\": ",q(mt(r[2])),", \"months\": ",idx(r[2])-idx(r[1])+1,"},")
    println(io,"  \"list\": {\"sha256\": ",q(pin),", \"members\": ",nlist,", \"root\": ",q(mt(ROOT)),", \"range\": [",q(mt(FIRST)),", ",q(mt(last)),"]},")
    println(io,"  \"counts\": {\"chain_members\": ",length(c.members),", \"runs\": ",length(c.runs),", \"gaps\": ",length(c.gaps),", \"bridges\": ",length(c.runs)-1,", \"before_root\": ",length(c.before),"},")
    println(io,"  \"runs\": [",join(["{\"from\": $(q(mt(a))), \"to\": $(q(mt(b))), \"count\": $(idx(b)-idx(a)+1)}" for (a,b) in c.runs],", "),"],")
    gs=String[]
    for g in c.gaps;st,ev=get(c.status,mt(g),("unknown","not tested"));push!(gs,"{\"month\": $(q(mt(g))), \"status\": $(q(st)), \"evidence\": $(q(ev))}");end
    println(io,"  \"gaps\": [",join(gs,", "),"],")
    println(io,"  \"bridges\": [",join(["{\"from\": $(q(mt(c.runs[k][2]))), \"to\": $(q(mt(c.runs[k+1][1])))}" for k in 1:length(c.runs)-1],", "),"],")
    println(io,"  \"before_root\": [",join(["{\"month\": $(q(mt(m))), \"print_member\": $(inp)}" for (m,inp) in c.before],", "),"]")
    println(io,"}")
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS)==6 "month_coverage.jl tsv|json LIST LIST_SHA256 STATUS_TSV LAST_MONTH START_MONTH"
        kind,list,pin,statusfile,lastt,startt=ARGS
        sm=match(r"^(\d{4})-(\d{2})$",startt);@assert !isnothing(sm);start=Tuple(parse.(Int,sm.captures))
        m=match(r"^(\d{4})-(\d{2})$",lastt);@assert !isnothing(m);last=Tuple(parse.(Int,m.captures))
        ms=read_list(list,pin);c=coverage(ms,read_status(statusfile),last,start)
        (kind=="tsv" ? tsv : kind=="json" ? json : error("tsv or json"))(stdout,c,pin,last,length(ms),start)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
