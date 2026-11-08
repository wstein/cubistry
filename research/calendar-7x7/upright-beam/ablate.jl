# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED experiment: which of the fixes is needed? One edge FROM:TO, all on/off
# combinations of tightening (T), core protection (C), catalog macros in the beam (K)
# and the exact last mile (F). Output: one line per combination.
#   ablate.jl OUT_TSV FROM TO [key=value ...]
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
out=ARGS[1];from=parse(Int,ARGS[2]);to=parse(Int,ARGS[3])
params0,spec,_=G.parse_options(ARGS[4:end])
goals=stacked_goals(PURE_VARIANT)
proof=G.P.replay_dag(DAG);action=proof.action;a=G.M.Algebra(action)
gens=[UInt16.(g) for g in action.generators]
source=G.P.read_physical(PRINT)
rootword=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(MOVES)[2:end])
base=G.build_library(action,a,spec)
catalogs=G.P.chain_catalogues(action)
libK=merge_macros(base,catalog_macros(catalogs,action,gens))
idx0=build_index(base);idxK=build_index(libK);cats=orbit_cats(catalogs,gens)
start=G.P.macro_word_perm(rootword[from],gens)
target=(year=goals[to].year,month=goals[to].month,board=goals[to].board)
open(out,"w") do log
    println(log,"tight\tcore_weight\tcatalog_in_beam\tlast_mile\tresult\thtm\tseconds\tstall_or_method")
    for (T,C,K,F) in [(0,1,0,0),(1,1,0,0),(0,100,0,0),(1,100,0,0),(0,1,1,0),(0,100,1,0),(1,1,1,0),(1,100,1,0),(1,100,0,1),(0,100,0,1),(1,100,1,1),(0,1,0,1),(0,1,1,1)]
        w=copy(params0.orbit_weights);w[11]=Float64(C)
        params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=params0.strict,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
        t=time()
        r=solve_edge(source,start,target,action,a,gens,K==1 ? libK : base,K==1 ? idxK : idx0,cats,params;tight=T==1,finish=F==1)
        dt=round(time()-t;digits=1)
        println(log,join([T,C,K,F,isnothing(r.word) ? "STALLED" : "SOLVED",r.htm,dt,isnothing(r.word) ? string(r.stall) : r.method],'\t'));flush(log)
    end
end
