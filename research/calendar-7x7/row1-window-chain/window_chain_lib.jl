# SPDX-License-Identifier: AGPL-3.0-or-later
# Pure logic of window_chain.jl (no solver, no print): month list, root month, chain plan, month status records, resume
# bookkeeping and the deadline rule. UNTRUSTED tooling; check.jl, the Flix chain checker and verify_chain.jl decide whether
# a chain is valid. The run contract (month list S, root month, bridge edges) is the one of those checkers
# (CAL7_WINDOW_MONTHS, CAL7_ROOT_MONTH). Tested by test_window_chain.jl.
module WindowChainLib
using SHA
export parse_ym, ym_str, ym_index, month_range, read_month_list, root_month, chain_plan, chain_flags, month_records, write_months,
    read_claims, read_best_effort, next_best_effort, chain_progress, may_start_edge, stop_reason, read_edges, greedy_count, segment_row, read_segments, layout_input, check_segments_layout,
    STATUSES, EDGES_HEADER, MONTHS_HEADER, SEGMENTS_HEADER, DEFAULT_DEADLINE_S, YM_MIN, YM_MAX

const YM_MIN=(1900,1)
const YM_MAX=(2100,1)
# Month status vocabulary. A month is `valid` only when the chain has an edge into it (or it is the root).
# `unavailable_*` and `best_effort` claim a certificate and need confirmed=both (Julia and Flix); everything else is `unknown`.
# `best_effort` is a chain member whose edge has wrong cells with Hall witnesses (chain.v2); this producer writes chain.v1 only
# and never produces one, so it appears only through a claims file.
const STATUSES=("valid","best_effort","unavailable_nomatch","unavailable_unsat","unknown")
const EDGES_HEADER="id\tyear\tmonth\tmethod\thtm\tqtm\tseconds\tsource_sha256\tend_sha256"
const MONTHS_HEADER="month\tstatus\treason\tedge\tmethod\tevidence"
const SEGMENTS_HEADER="run_id\tresearch_ref\tlibrary\twidth\tlambda\tprint_sha256\tmonths_sha256\troot_month\tedges_from\tedges_to\tlayout_sha256"
# A segment is about one hour: no new edge after 3000 s of the edge loop; the workflow job limit (about 70 min) covers setup and slack.
const DEFAULT_DEADLINE_S=3000.0

function parse_ym(s)
    m=match(r"^(\d{4})-(0[1-9]|1[0-2])\z",s);m===nothing && error("month must be YYYY-MM: $s")
    ym=(parse(Int,m.captures[1]),parse(Int,m.captures[2]))
    YM_MIN<=ym<=YM_MAX || error("month $s is outside 1900-01 .. 2100-01")
    ym
end
ym_str(ym)=string(lpad(ym[1],4,'0'),"-",lpad(ym[2],2,'0'))
ym_index(ym)=ym[1]*12+ym[2]-1
index_ym(i)=(div(i,12),mod(i,12)+1)
month_range(a,b)=[index_ym(i) for i in ym_index(a):ym_index(b)]

"Month list S as the checkers read it: SHA-256 pin, UTF-8, LF, one YYYY-MM per row, 1900-01 .. 2100-01, strictly increasing."
function read_month_list(path,pin)
    occursin(r"^[0-9a-f]{64}\z",pin) || error("month list pin must be 64 lowercase hex digits")
    bytes=read(path);bytes2hex(sha256(bytes))==pin || error("month list pin does not match $path")
    raw=String(copy(bytes));isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw) && sizeof(raw)<=100000 || error("month list must be canonical UTF-8 with LF line ends and a final LF")
    isempty(chomp(raw)) && error("month list is empty")
    ms=Tuple{Int,Int}[]
    for t in split(chop(raw),'\n')
        ym=parse_ym(String(t));isempty(ms) || ms[end]<ym || error("month list must be strictly increasing at $t");push!(ms,ym)
    end
    ms
end

"Root month (CAL7_ROOT_MONTH): the month whose board the identity pose of the print shows; default the first member of S."
root_month(text,members)=isempty(text) ? members[1] : parse_ym(text)

"Chain months: the root month first; when it is not the first member of S an extra root edge leads from the identity pose to S[1]."
chain_plan(members,root)=root==members[1] ? collect(members) : vcat([root],members)

"Edge flags as the checkers print them: ROOTEDGE (first edge of a rooted chain), BRIDGE (edge across skipped calendar months)."
function chain_flags(members,root)
    plan=chain_plan(members,root);rooted=root!=members[1]
    [(i==1 && rooted) ? "ROOTEDGE" : (ym_index(b)-ym_index(a)>1 ? "BRIDGE" : "") for (i,(a,b)) in enumerate(zip(plan[1:end-1],plan[2:end]))]
end

"Claims: month => (status,reason,evidence,confirmed). Rows: month, status, reason, evidence, confirmed (both|julia_only|none)."
function read_claims(path)
    d=Dict{Tuple{Int,Int},NTuple{4,String}}()
    for (n,l) in enumerate(split(chomp(read(path,String)),'\n'))
        n==1 && (l=="month\tstatus\treason\tevidence\tconfirmed" || error("claims header"));n==1 && continue
        f=String.(split(l,'\t'));length(f)==5 || error("claims row $n has $(length(f)) fields")
        f[2] in STATUSES || error("claims row $n: status $(f[2])");f[2]=="valid" && error("claims row $n: valid is never a claim")
        f[5] in ("both","julia_only","none") || error("claims row $n: confirmed $(f[5])")
        ym=parse_ym(f[1]);haskey(d,ym) && error("claims row $n: duplicate month $(f[1])")
        d[ym]=(f[2],f[3],f[4],f[5])
    end
    d
end

"Declared best-effort months (file of the coverage tools): month => (status,wrong cells,evidence)."
function read_best_effort(path)
    d=Dict{Tuple{Int,Int},NTuple{3,String}}()
    for (n,l) in enumerate(split(chomp(read(path,String)),'\n'))
        n==1 && (l=="month\tstatus\twrong_cells\tevidence" || error("best-effort header"));n==1 && continue
        f=String.(split(l,'\t'));length(f)==4 || error("best-effort row $n has $(length(f)) fields")
        f[2] in ("best_effort","best_effort_unverified") || error("best-effort status $(f[2]) in row $n")
        ym=parse_ym(f[1]);haskey(d,ym) && error("best-effort row $n: duplicate month $(f[1])")
        d[ym]=(f[2],f[3],f[4])
    end
    d
end
"The next chain month to produce (plan[produced+1]) when it is a declared best-effort month, else nothing."
function next_best_effort(plan,produced,best)
    produced<length(plan) && haskey(best,plan[produced+1]) ? plan[produced+1] : nothing
end

"""
Status record of every month of start..fin. `produced` months (in chain order) are valid; the first `stop` (nothing when the
chain is complete) names why the rest of the chain months have no edge. A month outside the chain is `unknown` unless a claim
says more (before_chain_root, skipped_gap between chain months, after_month_list); an `unavailable_*` or `best_effort` claim
without confirmed=both is downgraded to `unknown` (AGENTS.md: UNSAT needs both checkers). A claim on a chain month is an error. `rooted` says that the first edge is the root edge.
Declared best-effort months that were not produced say `best_effort_month` with their evidence.
"""
function month_records(start,fin,plan,produced,stop;methods,rooted=false,claims=Dict{Tuple{Int,Int},NTuple{4,String}}(),best=Dict{Tuple{Int,Int},NTuple{3,String}}())
    np=length(produced)
    np<=length(plan) && all(produced[i]==plan[i] for i in 1:np) || error("produced months are not the chain prefix")
    length(methods)==max(np-1,0) || error("one solver method per edge is required")
    np<length(plan) && stop===nothing && error("an incomplete chain needs a stop reason")
    for k in keys(best);k in plan || error("best-effort month $(ym_str(k)) is not a chain month");end
    for k in keys(claims);k in plan && error("claim for chain month $(ym_str(k)): the chain decides it");end
    rows=NTuple{6,String}[]
    for ym in month_range(start,fin)
        i=findfirst(==(ym),plan)
        if i!==nothing && i<=np
            reason=i==1 ? "root" : (i==2 && rooted ? "root_edge" : (ym_index(ym)-ym_index(plan[i-1])>1 ? "bridge_edge" : "chain_edge"))
            push!(rows,(ym_str(ym),"valid",reason,i==1 ? "0" : string(i-1),i==1 ? "-" : methods[i-1],"-"))
        elseif i!==nothing
            haskey(best,ym) ? push!(rows,(ym_str(ym),"unknown","best_effort_month","-","-",best[ym][3])) : push!(rows,(ym_str(ym),"unknown",stop,"-","-","-"))
        else
            default=ym_index(ym)<ym_index(plan[1]) ? "before_chain_root" : ym_index(ym)>ym_index(plan[end]) ? "after_month_list" : "skipped_gap"
            c=get(claims,ym,nothing)
            if c===nothing
                push!(rows,(ym_str(ym),"unknown",default,"-","-","-"))
            elseif (startswith(c[1],"unavailable") || c[1]=="best_effort") && c[4]!="both"
                push!(rows,(ym_str(ym),"unknown","claimed_"*c[1]*"_"*c[4],"-","-",c[3]))
            else
                push!(rows,(ym_str(ym),c[1],c[2],"-","-",c[3]))
            end
        end
    end
    rows
end
function write_months(path,rows)
    tmp=path*".tmp"
    write(tmp,join(vcat([MONTHS_HEADER],[join(r,'\t') for r in rows]),'\n')*"\n");mv(tmp,path;force=true)
end

"""
Edge months of a chain file (lines) checked against the plan: header chain.v1, the source record names the root month (the month
field twice and the year), the edges are the plan months after the root, in order. (months, edge count).
"""
function chain_progress(ls,plan)
    ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish" || error("chain header (chain.v1 only) or finish row")
    src=split(ls[2],'\t');root=plan[1]
    (src[1]=="source" && length(src)==5 && (parse(Int,src[2]),parse(Int,src[3]),parse(Int,src[4]))==(root[2],root[1],root[2])) || error("chain source is not the root month $(ym_str(root))")
    months=[(parse(Int,f[2]),parse(Int,f[3])) for f in (split(l,'\t') for l in ls if startswith(l,"edge\t"))]
    length(months)<=length(plan)-1 || error("chain has more edges ($(length(months))) than the plan ($(length(plan)-1))")
    for (i,ym) in enumerate(months);ym==plan[i+1] || error("edge $(ym_str(ym)) does not follow the plan: expected $(ym_str(plan[i+1]))");end
    (plan[1:length(months)+1],length(months))
end

"Start another edge only when the slowest edge so far still fits before the deadline (seconds)."
may_start_edge(elapsed,slowest,deadline)=elapsed+1.25*slowest<=deadline

"Why no new edge starts, or nothing: a declared best-effort month as next target (the producer cannot write its edge), max_edges, the deadline rule."
function stop_reason(done,max_edges,elapsed,slowest,deadline,next;next_best=nothing)
    next_best===nothing || return "best_effort_month"
    done>=max_edges && return "max_edges"
    may_start_edge(elapsed,slowest,deadline) || return "deadline"
    nothing
end

"Solver methods of edges 2..k+1 from a (cumulative) edges.tsv: header and ids are checked."
function read_edges(path,k)
    ls=split(chomp(read(path,String)),'\n')
    ls[1]==EDGES_HEADER || error("edges.tsv header")
    length(ls)==k+1 || error("edges.tsv has $(length(ls)-1) rows for $k edges")
    methods=String[]
    for (i,l) in enumerate(ls[2:end])
        f=split(l,'\t');length(f)==9 || error("edges.tsv row $i has $(length(f)) fields")
        parse(Int,f[1])==i+1 || error("edges.tsv row $i has id $(f[1])")
        push!(methods,String(f[4]))
    end
    methods
end
greedy_count(methods)=count(==("greedy"),methods)

"Rows of a (cumulative) segments.tsv, header and field count checked."
function read_segments(path)
    ls=split(chomp(read(path,String)),'\n')
    ls[1]==SEGMENTS_HEADER || error("segments.tsv header")
    for (i,l) in enumerate(ls[2:end]);length(split(l,'\t'))==11 || error("segments.tsv row $i has $(length(split(l,'\t'))) fields");end
    String.(ls[2:end])
end

"One row of segments.tsv: the inputs of one run, so a continued chain shows which research commit, library and beam parameters made each segment."
function segment_row(;run_id,research_ref,library,width,lambda,print_sha,months_sha,root,edges_from,edges_to,layout_sha)
    f=string.((run_id,research_ref,library,width,lambda,print_sha,months_sha,root,edges_from,edges_to,layout_sha))
    any(x->occursin(r"[\t\n\r]",x),f) && error("segment field contains a tab or line break")
    join(f,'\t')
end

"Layout path and its SHA-256 for a producer. CAL7_WINDOW_LAYOUT (path) replaces the built-in layout and needs CAL7_WINDOW_LAYOUT_SHA256, the same
names as run_checks.sh and the checkers; a mismatch is an error. Without CAL7_WINDOW_LAYOUT the built-in layout is used (a pin is checked if set)."
function layout_input(default,env=ENV)
    path=get(env,"CAL7_WINDOW_LAYOUT","");pin=get(env,"CAL7_WINDOW_LAYOUT_SHA256","")
    if isempty(path)
        path=default
    else
        isempty(pin) && error("CAL7_WINDOW_LAYOUT needs CAL7_WINDOW_LAYOUT_SHA256")
        isfile(path) || error("layout not found: $path")
    end
    isempty(pin) || occursin(r"^[0-9a-f]{64}$",pin) || error("CAL7_WINDOW_LAYOUT_SHA256 must be 64 lowercase hex digits")
    got=bytes2hex(sha256(read(path)))
    isempty(pin) || got==pin || error("layout SHA-256 $got differs from CAL7_WINDOW_LAYOUT_SHA256 $pin")
    (path,got)
end

"A continued chain must use the layout of its earlier segments (last column of segments.tsv)."
function check_segments_layout(rows,layout_sha)
    for (i,r) in enumerate(rows);f=split(r,'\t')[end]
        f==layout_sha || error("layout of prior segment $i ($f) differs from the layout of this run ($layout_sha)")
    end
    nothing
end
end
