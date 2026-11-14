# SPDX-License-Identifier: AGPL-3.0-or-later
# Pure functions of the re-root measurement (measure_edges.jl): prefix arithmetic, the chain reader, commit points, the cost of a
# re-rooted route, the edge selection and the frozen-input check. No solver and no library build: test_reroot_measure.jl runs in seconds.
#
# Definitions (README, section "Re-root measurement"):
#  - A_d = longest common prefix of the words of all beam nodes after beam iteration d (lcp over the move tokens of n.word).
#  - A commit event is an iteration whose A_d extends the committed prefix C and is longer in HTM; then C := A_d. An A_d that does not
#    extend C (a seam rewrite by simplify) is no commit (it is counted).
#  - A commit point is a commit event chosen by a threshold (the first event with HTM >= threshold) plus the last event.
#  - Re-root at P: the edge is solved again from the state after P with the production solver (solve_edge); the route is P followed by
#    the word of that solve. All its candidates (beam nodes, incumbent, snapshots, finish candidates) extend P by construction, so a
#    streamed P is never taken back. The streamed route is P ++ rest without cancellation across the seam (the player has played P).
module RerootMeasure
using SHA

lcp(x,y)=(n=0;for (p,q) in zip(x,y);p==q || break;n+=1;end;n)
function lcp_all(ws)
    ref=first(ws);n=length(ref)
    for x in ws[2:end];n=min(n,lcp(ref,x));n==0 && break;end
    n
end

# --- chain reader -----------------------------------------------------------------------------------------------------------
# Records of cubistry.calendar7.chain.v1/v2: source, edge ... end (move g q | wrong a b | hall a,b;a,b), finish. A best-effort
# edge carries `wrong` and `hall` records between its edge line and its first move; they are cells, not moves.
struct ChainEdge
    id::Int;year::Int;month::Int
    fields::Vector{String}                 # the nine fields of the edge record
    moves::Vector{Tuple{Int,Int}}
    wrong::Vector{Tuple{Int,Int}}
    hall::Vector{Vector{Tuple{Int,Int}}}
end
function read_chain_edges(text::AbstractString)
    ls=String.(split(chomp(text),'\n'))
    length(ls)>=3 && ls[1] in ("cubistry.calendar7.chain.v1","cubistry.calendar7.chain.v2") || error("chain header")
    ls[end]=="finish" || error("chain: no finish record")
    startswith(ls[2],"source\t") || error("chain: no source record")
    out=ChainEdge[];i=3;id=1
    cell(s)=(p=split(s,',');length(p)==2 || error("chain: cell $s");(parse(Int,p[1]),parse(Int,p[2])))
    while i<length(ls)
        f=String.(split(ls[i],'\t'));f[1]=="edge" && length(f)==9 || error("chain: edge record expected at line $i")
        id+=1;i+=1
        mv=Tuple{Int,Int}[];wr=Tuple{Int,Int}[];hl=Vector{Tuple{Int,Int}}[]
        while true
            i<=length(ls) || error("chain: edge $id has no end record")
            l=ls[i];i+=1
            l=="end" && break
            p=String.(split(l,'\t'))
            if p[1]=="move";length(p)==3 || error("chain: move record $l");push!(mv,(parse(Int,p[2]),parse(Int,p[3])))
            elseif p[1]=="wrong";length(p)==3 || error("chain: wrong record $l");push!(wr,(parse(Int,p[2]),parse(Int,p[3])))
            elseif p[1]=="hall";length(p)==2 || error("chain: hall record $l");push!(hl,[cell(c) for c in split(p[2],';')])
            else error("chain: unknown record $(p[1])");end
        end
        push!(out,ChainEdge(id,parse(Int,f[2]),parse(Int,f[3]),f,mv,wr,hl))
    end
    i==length(ls) || error("chain: text after the last edge")
    out
end

# --- commit events and points -----------------------------------------------------------------------------------------------
function commit_events(As,htm;count_skipped=false)
    C=Int[];ev=NamedTuple{(:iter,:prefix,:htm),Tuple{Int,Vector{Int},Int}}[];skipped=0
    for (k,A) in enumerate(As)
        lcp(A,C)==length(C) || (skipped+=1;continue)
        h=htm(A)
        h>htm(C) || continue
        C=copy(A);push!(ev,(iter=k,prefix=C,htm=h))
    end
    count_skipped ? (ev,skipped) : ev
end
function commit_points(ev,thresholds)
    all(t->t>=1,thresholds) || error("thresholds must be >= 1")
    isempty(ev) && return similar(ev,0)
    chosen=Int[]
    for t in sort(unique(thresholds))
        k=findfirst(e->e.htm>=t,ev);isnothing(k) || push!(chosen,k)
    end
    push!(chosen,length(ev))
    ev[sort(unique(chosen))]
end
function parse_thresholds(s)
    isempty(strip(s)) && error("no thresholds")
    t=try [parse(Int,strip(x)) for x in split(s,',')] catch;error("thresholds: integers separated by commas") end
    all(>=(1),t) || error("thresholds must be >= 1");t
end

# --- cost of a re-rooted route ----------------------------------------------------------------------------------------------
seam_cancel(P,rest,norm)=length(P)+length(rest)-length(norm(vcat(P,rest)))
function reroot_cost(P,rest,free_htm,htm;norm=identity)
    ph=htm(P);rh=htm(rest);s=ph+rh
    (p_htm=ph,rest_htm=rh,streamed=s,cost=s-free_htm,share=s==0 ? NaN : ph/s,seam=seam_cancel(P,rest,norm))
end

# Reference lengths of an edge (stored = the stored chain edge, root = re-root from the root, i.e. a fresh beam run with the same
# configuration; wide = a beam run with a larger width). best_ref = the smallest of them; a missing value (nothing: skipped or failed) is ignored.
best_ref(stored,root,wide)=minimum(x for x in (stored,root,wide) if x!==nothing)
cost_vs_best(streamed,best)=streamed-best
const SUMMARY_REF_COLUMNS=["ref_root_htm","ref_wide_htm","best_ref_htm","ref_wide_width"]
cellv(x)=x===nothing ? "-" : string(x)
ref_cells(root,wide,best)=[cellv(root),cellv(wide),cellv(best)]
function parse_ref_width(s,width)
    s=strip(s)
    isempty(s) && (2*width<=400 || error("twice the width exceeds 400");return 2*width)
    occursin(r"^[0-9]+$",s) || error("ref_width: a positive integer")
    w=parse(Int,s);1<=w<=400 || error("ref_width must be 1-400");w
end

const REROOT_COLUMNS=["id","month","commit","iter","t_s","p_htm","free_htm","rest_htm","streamed_htm","cost_htm","share","merged_htm","seam_cancel","method","resolve_s","status",
    "ref_root_htm","ref_wide_htm","best_ref_htm","cost_vs_best_htm"]
fmt(x::Real)=x isa Integer ? string(x) : string(round(x;digits=3))
function reroot_row(;id,month,k,iter,t_s,p_htm,free_htm,rest_htm,streamed,merged,seam,method,resolve_s,status,ref_root=nothing,ref_wide=nothing,best_ref=free_htm)
    ok=status=="ok"
    join((id,month,k,iter,fmt(t_s),p_htm,free_htm,ok ? rest_htm : "-",ok ? streamed : "-",ok ? streamed-free_htm : "-",ok ? fmt(p_htm/streamed) : "-",ok ? merged : "-",ok ? seam : "-",method,fmt(resolve_s),status,
        cellv(ref_root),cellv(ref_wide),cellv(best_ref),ok && best_ref!==nothing ? cost_vs_best(streamed,best_ref) : "-"),'\t')
end

# --- frozen inputs ----------------------------------------------------------------------------------------------------------
sha256_file(p)=bytes2hex(open(sha256,p))
function check_sums(file;root=dirname(file),expect=nothing)
    seen=Dict{String,String}()
    for l in split(chomp(read(file,String)),'\n')
        m=match(r"^([0-9a-f]{64})  (\S+)$",l);m===nothing && error("SHA256SUMS line: $l")
        p=joinpath(root,m[2]);isfile(p) || error("missing file $(m[2])")
        sha256_file(p)==m[1] || error("sha256 mismatch for $(m[2])")
        seen[m[2]]=m[1]
    end
    if expect!==nothing
        for (k,v) in expect;get(seen,k,nothing)==v || error("$k is not pinned to $v")end
    end
    nothing
end

# --- edge selection ---------------------------------------------------------------------------------------------------------
read_stage_table(path)=[(r=split(l,'\t');(id=parse(Int,r[1]),month=string(r[2],"-",lpad(r[3],2,'0')),method=String(r[4]),htm=parse(Int,r[5]),qtm=parse(Int,r[6])))
                        for l in split(chomp(read(path,String)),'\n')[2:end]]
"""
Deterministic selection: candidates are the chain edges that were not measured and carry no best-effort record (solve_edge does not
produce those); sorted by (htm, id); n evenly spaced ranks from the shortest to the longest. Returns id, month, htm, method, rotations
(the rotation count of the stored edge record).
"""
function select_edges(table,edges,measured;n=10)
    rot=Dict(e.id=>parse(Int,e.fields[6]) for e in edges)
    be=Set(e.id for e in edges if !isempty(e.wrong))
    cand=sort([t for t in table if t.id∉measured && t.id∉be];by=t->(t.htm,t.id))
    m=length(cand);m>=n || error("fewer candidates than n")
    idx=unique([1+round(Int,(k-1)*(m-1)/(n-1)) for k in 1:n]);length(idx)==n || error("ranks collide")
    [(id=c.id,month=c.month,htm=c.htm,method=c.method,rotations=rot[c.id]) for c in cand[idx]]
end
read_selection(path)=[(r=split(l,'\t');(id=parse(Int,r[1]),month=String(r[2]),htm=parse(Int,r[3]),method=String(r[4]),rotations=parse(Int,r[5])))
                      for l in split(chomp(read(path,String)),'\n')[2:end]]
function parse_ids(s)
    ids=try [parse(Int,x) for x in split(s,',')] catch;error("ids: integers separated by commas") end
    allunique(ids) || error("ids: duplicates")
    ids
end
pairs_of(ids,k)=[join(ids[i:min(i+k-1,end)],',') for i in 1:k:length(ids)]
end
