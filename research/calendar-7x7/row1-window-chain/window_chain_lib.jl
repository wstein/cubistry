# SPDX-License-Identifier: AGPL-3.0-or-later
# Pure logic of window_chain.jl (no solver, no print): month plan, month status records, resume
# bookkeeping and the deadline rule. UNTRUSTED tooling; check.jl, the Flix checker and
# verify_chain.jl decide whether a chain is valid. Tested by test_window_chain.jl.
module WindowChainLib
export parse_ym, ym_str, ym_index, month_range, chain_months, month_records, write_months,
    read_claims, chain_progress, may_start_edge, unsafe_stop, STATUSES, ROOT

const ROOT=(2026,5)   # the chain root of every window print is May 2026 (identity pose)
# Month status vocabulary. A month is `valid` only when the chain has an edge into it (or it is the root).
# `unavailable_*` claims a certificate and needs confirmed=both (Julia and Flix); everything else is `unknown`.
const STATUSES=("valid","unavailable_nomatch","unavailable_unsat","unknown")

function parse_ym(s)
    m=match(r"^(\d{4})-(0[1-9]|1[0-2])\z",s);m===nothing && error("month must be YYYY-MM: $s")
    (parse(Int,m.captures[1]),parse(Int,m.captures[2]))
end
ym_str(ym)=string(lpad(ym[1],4,'0'),"-",lpad(ym[2],2,'0'))
ym_index(ym)=ym[1]*12+ym[2]-1
index_ym(i)=(div(i,12),mod(i,12)+1)
month_range(a,b)=[index_ym(i) for i in ym_index(a):ym_index(b)]

"Months the chain can contain: from ROOT to min(range end, print window end). Empty when the range ends before ROOT."
function chain_months(start,fin,window_end)
    ym_index(start)<=ym_index(ROOT) || error("chain root is $(ym_str(ROOT)); start $(ym_str(start)) lies after it")
    last=ym_index(fin)<ym_index(window_end) ? fin : window_end
    ym_index(last)<ym_index(ROOT) ? typeof(ROOT)[] : month_range(ROOT,last)
end

"Claims: month => (status,reason,evidence,confirmed). Rows: month, status, reason, evidence, confirmed (both|julia_only|none)."
function read_claims(path)
    d=Dict{Tuple{Int,Int},NTuple{4,String}}()
    for (n,l) in enumerate(split(chomp(read(path,String)),'\n'))
        n==1 && (l=="month\tstatus\treason\tevidence\tconfirmed" || error("claims header"));n==1 && continue
        f=String.(split(l,'\t'));length(f)==5 || error("claims row $n has $(length(f)) fields")
        f[2] in STATUSES || error("claims row $n: status $(f[2])");f[2]=="valid" && error("claims row $n: valid is never a claim")
        f[5] in ("both","julia_only","none") || error("claims row $n: confirmed $(f[5])")
        d[parse_ym(f[1])]=(f[2],f[3],f[4],f[5])
    end
    d
end

"""
Status record of every month of start..fin. `produced` months (in chain order from ROOT) are valid; the first
`stop_reason` (nothing when the chain is complete) names why the rest of the chain months have no edge. A month
outside the chain is `unknown` unless a claim says more; an `unavailable_*` claim without confirmed=both is
downgraded to `unknown` (AGENTS.md: UNSAT needs both checkers).
"""
function month_records(start,fin,window_end,produced,stop_reason;claims=Dict{Tuple{Int,Int},NTuple{4,String}}())
    chain=chain_months(start,fin,window_end);np=length(produced)
    np<=length(chain) && all(produced[i]==chain[i] for i in 1:np) || error("produced months are not the chain prefix")
    np<length(chain) && stop_reason===nothing && error("an incomplete chain needs a stop reason")
    rows=NTuple{5,String}[]
    for ym in month_range(start,fin)
        i=findfirst(==(ym),chain)
        if i!==nothing && i<=np
            push!(rows,(ym_str(ym),"valid",i==1 ? "root" : "chain_edge",i==1 ? "0" : string(i-1),"-"))
        elseif i!==nothing
            push!(rows,(ym_str(ym),"unknown",stop_reason,"-","-"))
        else
            default=ym_index(ym)<ym_index(ROOT) ? "before_chain_root" : "after_print_window"
            c=get(claims,ym,nothing)
            if c===nothing
                push!(rows,(ym_str(ym),"unknown",default,"-","-"))
            elseif startswith(c[1],"unavailable") && c[4]!="both"
                push!(rows,(ym_str(ym),"unknown","claimed_"*c[1]*"_"*c[4],"-",c[3]))
            else
                push!(rows,(ym_str(ym),c[1],c[2],"-",c[3]))
            end
        end
    end
    rows
end
function write_months(path,rows)
    tmp=path*".tmp"
    write(tmp,join(vcat(["month\tstatus\treason\tedge\tevidence"],[join(r,'\t') for r in rows]),'\n')*"\n");mv(tmp,path;force=true)
end

"Edge months of a chain file (lines), checked to be consecutive from the month after ROOT: (months, count)."
function chain_progress(ls)
    ls[1]=="cubistry.calendar7.chain.v1" && ls[end]=="finish" || error("chain header or finish row")
    src=split(ls[2],'\t');(src[1]=="source" && (parse(Int,src[3]),parse(Int,src[4]))==ROOT) || error("chain source is not $(ym_str(ROOT))")
    months=[(parse(Int,f[2]),parse(Int,f[3])) for f in (split(l,'\t') for l in ls if startswith(l,"edge\t"))]
    prev=ROOT
    for ym in months;ym_index(ym)==ym_index(prev)+1 || error("edge $(ym_str(ym)) does not follow $(ym_str(prev)): a gap inside the chain is not allowed");prev=ym;end
    ([ROOT;months],length(months))
end

"Start another edge only when the slowest edge so far still fits before the deadline (seconds)."
may_start_edge(elapsed,slowest,deadline)=elapsed+1.25*slowest<=deadline
"""
A chain that ends exactly at 2028-01 is checked by run_checks.sh without the print digest, so the Flix checker would
read the stored print; a stop there is never clean. The producer takes one more edge instead (when the plan has one).
"""
unsafe_stop(last_ym)=last_ym==(2028,1)
end
