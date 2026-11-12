#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# State report of a window chain (chain.v1/v2/v3 file, optionally with its states directory): how many identical full start and end states and
# repeated (start,end) pairs the edges contain, and how often a configuration transition repeats. Reads digests only; the checkers decide whether
# the chain is legal (check.jl, verify_chain.jl, Flix), this report does not replace them. No full state is stored per configuration: the report
# only counts what the chain already has.
#   state_report.jl CHAIN [STATES_DIRECTORY]      (bash wrapper: state_report.sh)
# Meant to run after stage 1 of the first chain (41 edges) and on the full chain (204 edges); the 91 configurations are 7 weekdays x 13 month kinds
# (12 months, February with 28 or 29 days).
# Definitions. Start (end) state of edge i: the full-state digest in the edge line (sha256 of the 294 sticker rows, see check.jl chain_digest).
# Configuration of a month: (month, weekday of the 1st, days of the month), printed Jan/Tue/31. Edge i goes from the month before it in the chain
# (the root month of the source line for edge 1) to its own month; its transition is (config of that month, config of its month).
# STATES_DIRECTORY: state-NN.tsv (NN = 01 .. edges+1) must hash, without its header line, to the digest of state NN (a differing file is an error).
# Output: tab-separated lines `key value...`; lists of repeated digests, pairs and transitions follow the counts.
using SHA, Dates
const MONTH_NAMES=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAY_NAMES=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
config(y,m)=(m,dayofweek(Date(y,m,1)),daysinmonth(Date(y,m,1)))
config_text(c)=string(MONTH_NAMES[c[1]],'/',DAY_NAMES[c[2]],'/',c[3])
"Parses a chain text; returns (root=(year,month),edges=[(year,month,src,fin)])."
function parse_chain(raw::String)
    ls=split(chomp(raw),'\n');@assert length(ls)>=4 && startswith(ls[1],"cubistry.calendar7.chain.v") && ls[end]=="finish" "chain header and trailer"
    f=split(ls[2],'\t');@assert length(f)==5 && f[1]=="source" "source line"
    root=(parse(Int,f[3]),parse(Int,f[4]));edges=NamedTuple{(:year,:month,:src,:fin),Tuple{Int,Int,String,String}}[]
    for l in ls[3:end-1]
        startswith(l,"edge\t") || continue
        g=split(l,'\t');@assert length(g)==9 "edge line"
        push!(edges,(year=parse(Int,g[2]),month=parse(Int,g[3]),src=String(g[8]),fin=String(g[9])))
    end
    @assert !isempty(edges) "no edge"
    (root=root,edges=edges)
end
"Counts: groups the edge indices by key and returns the groups with more than one edge, ordered by first edge."
repeated(keys)=begin
    d=Dict{eltype(keys),Vector{Int}}();for (i,k) in enumerate(keys);push!(get!(d,k,Int[]),i);end
    sort([(k,v) for (k,v) in d if length(v)>1];by=x->x[2][1])
end
"Digest of a state file without its header line."
state_file_digest(path)=bytes2hex(sha256(codeunits(join(readlines(path)[2:end].*"\n"))))
function report(raw::String;statesdir=nothing,io=stdout)
    c=parse_chain(raw);E=c.edges;n=length(E)
    for i in 2:n;@assert E[i].src==E[i-1].fin "edge $i starts where edge $(i-1) ends";end
    digests=vcat([E[1].src],[e.fin for e in E])
    if !isnothing(statesdir)
        for (i,d) in enumerate(digests)
            p=joinpath(statesdir,"state-"*lpad(i,2,'0')*".tsv");@assert isfile(p) "missing state file $p"
            @assert state_file_digest(p)==d "state file $i differs from its chain digest"
        end
    end
    starts=[e.src for e in E];ends=[e.fin for e in E];pairs=[(e.src,e.fin) for e in E]
    cfgs=[config(c.root...)];for e in E;push!(cfgs,config(e.year,e.month));end
    trans=[(cfgs[i],cfgs[i+1]) for i in 1:n]
    println(io,"edges\t",n)
    println(io,"months\t",n+1,"\troot\t",c.root[1],'-',lpad(c.root[2],2,'0'),"\tlast\t",E[end].year,'-',lpad(E[end].month,2,'0'))
    println(io,"states_distinct\t",length(unique(digests)),"\tof\t",length(digests),"\tstates_revisited\t",length(digests)-length(unique(digests)))
    println(io,"null_edges\t",count(e->e.src==e.fin,E),"\t(start equals end)")
    rs=repeated(starts);re=repeated(ends);rp=repeated(pairs)
    println(io,"start_states_distinct\t",length(unique(starts)),"\tshared_by_several_edges\t",length(rs),"\tedges_involved\t",sum(length(v) for (_,v) in rs;init=0))
    println(io,"end_states_distinct\t",length(unique(ends)),"\tshared_by_several_edges\t",length(re),"\tedges_involved\t",sum(length(v) for (_,v) in re;init=0))
    println(io,"pairs_distinct\t",length(unique(pairs)),"\trepeated_pairs\t",length(rp),"\tedges_involved\t",sum(length(v) for (_,v) in rp;init=0))
    for (k,v) in rs;println(io,"start_state_shared\t",k,'\t',length(v),"\tedges\t",join(v,','));end
    for (k,v) in re;println(io,"end_state_shared\t",k,'\t',length(v),"\tedges\t",join(v,','));end
    for (k,v) in rp;println(io,"pair_repeated\t",k[1],'\t',k[2],'\t',length(v),"\tedges\t",join(v,','));end
    rt=repeated(trans);hist=Dict{Int,Int}();for (_,v) in rt;hist[length(v)]=get(hist,length(v),0)+1;end
    println(io,"configs_occurring\t",length(unique(cfgs)),"\tof\t91")
    println(io,"transitions_distinct\t",length(unique(trans)),"\trepeated_transitions\t",length(rt),"\tedges_involved\t",sum(length(v) for (_,v) in rt;init=0))
    println(io,"transition_repeat_counts\t",join(["$k edges: $(hist[k]) transitions" for k in sort(collect(keys(hist)))],"; "))
    for (k,v) in sort(rt;by=x->(-length(x[2]),x[2][1]))
        println(io,"transition_repeated\t",config_text(k[1]),'\t',config_text(k[2]),'\t',length(v),"\tedges\t",join(v,','))
    end
    (edges=n,starts=length(unique(starts)),ends=length(unique(ends)),pairs=length(unique(pairs)),repeated_pairs=length(rp),transitions=length(unique(trans)),repeated_transitions=length(rt))
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS) in (1,2) "state_report.jl CHAIN [STATES_DIRECTORY]"
        report(read(ARGS[1],String);statesdir=length(ARGS)==2 ? ARGS[2] : nothing)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
