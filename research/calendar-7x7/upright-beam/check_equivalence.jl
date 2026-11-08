# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED self-check: the indexed beam (beam_fast) returns exactly the nodes of the
# unchanged global-search beam (G.beam_search): same best word, same snapshots, same
# stall, on the given edges (same library, same tightened problem, same parameters).
#   check_equivalence.jl FROM:TO [FROM:TO ...]
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)
include(joinpath(HERE,"beam2.jl"))
DAG=get(ENV,"DAG","/tmp/dag-all.tsv")
PRINT=joinpath(CAL,"upright-feasibility","evidence","print-strict-upright.tsv")
MOVES=joinpath(CAL,"upright-moves","evidence","moves-strict.tsv")
goals=stacked_goals(PURE_VARIANT)
proof=G.P.replay_dag(DAG);action=proof.action;a=G.M.Algebra(action)
gens=[UInt16.(g) for g in action.generators]
source=G.P.read_physical(PRINT)
rootword=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(MOVES)[2:end])
params0,spec,_=G.parse_options(["lambda=3"])
w=copy(params0.orbit_weights);w[11]=100.0
params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=params0.strict,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
catalogs=G.P.chain_catalogues(action)
lib=merge_macros(G.build_library(action,a,spec),catalog_macros(catalogs,action,gens));index=build_index(lib)
ok=true
for arg in ARGS
    from,to=parse.(Int,split(arg,':'))
    start=G.P.macro_word_perm(rootword[from],gens)
    target=(year=goals[to].year,month=goals[to].month,board=goals[to].board)
    pr,_=strict_problem(source,target,action,w)
    pre=G.P.chain_core_prefix(source,start,target,action)
    r1=G.beam_search(pre.state,pre.word,pr,lib,a,params)
    r2=beam_fast(pre.state,pre.word,pr,lib,index,a,params)
    same_best=(isnothing(r1.best) && isnothing(r2.best)) || (!isnothing(r1.best) && !isnothing(r2.best) && r1.best.word==r2.best.word)
    same_snap=keys(r1.snapshots)==keys(r2.snapshots) && all(r1.snapshots[k].word==r2.snapshots[k].word for k in keys(r1.snapshots))
    same_trace=r1.trace==r2.trace && r1.stall==r2.stall && r1.status==r2.status
    println("equivalence\t",from,"->",to,"\tbest=",same_best,"\tsnapshots=",same_snap,"\ttrace_status_stall=",same_trace,"\thtm=",isnothing(r1.best) ? -1 : r1.best.cost)
    global ok&=same_best&&same_snap&&same_trace
end
println("equivalence-verdict\t",ok ? "IDENTICAL" : "DIFFERENT")
