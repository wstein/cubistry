# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED diagnosis (evidence for README "Root cause"): why does the global beam stall
# on the first chain edge 2028-01 -> 2028-02 (display 25 -> 26) under the strict rule?
# Runs the beam (indexed, same search as global-search/search.jl, see README) in three
# settings and, for the stalled best nodes, prints for every wrong front cell: its allowed
# poses, where each allowed pose sits now (hidden / front cell that needs it / same cubie
# slot = right cubie, wrong twist), and what the planner's core prefix would do to the
# snapshot (the old hybrid finish).
#   diagnose_stall.jl
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
params0,spec,_=G.parse_options(String[])
lib=G.build_library(action,a,spec);index=build_index(lib)
start=G.P.macro_word_perm(rootword[25],gens)
target=(year=goals[26].year,month=goals[26].month,board=goals[26].board)
body(i)=action.points[i][1]
function describe(pr,occ,x)
    al=[o for o in 1:264 if pr.allowed[o,x]]
    parts=String[]
    for o in al
        loc=findfirst(==(UInt16(o)),occ)
        kind=loc in pr.constrained ? (G.satisfied(pr,occ,loc) ? "sits in front cell $(loc) that is satisfied (flexible cell holds a scarce piece)" : "sits in wrong front cell $(loc)") : "hidden at position $(loc)"
        body(o)==body(Int(occ[x])) && (kind*=" [same cubie as the occupant of the cell: right cubie, wrong twist]")
        push!(parts,"pose $o $kind")
    end
    "cell $x (orbit $(div(x-1,24)+1)) holds pose $(occ[x]); allowed: "*join(parts," | ")
end
for (name,tight,corew) in (("A original problem, core weight 1 (what synth_strict.jl ran)",false,1.0),
                           ("B tightened allowed sets, core weight 1",true,1.0),
                           ("C tightened, core weight 100 (core protected), no catalog macros",true,100.0))
    w=copy(params0.orbit_weights);w[11]=corew
    params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=params0.strict,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
    pr,dropped=strict_problem(source,target,action,w;tight)
    pre=G.P.chain_core_prefix(source,start,target,action)
    res=beam_fast(pre.state,pre.word,pr,lib,index,a,params)
    println("== ",name,": dropped pairs=",dropped,", status=",res.status,", stall=",res.stall)
    isnothing(res.best) || (println("   solved by the beam, htm=",res.best.cost);continue)
    for u in first(sort!(collect(keys(res.snapshots))),2)
        n=res.snapshots[u];occ=n.occ
        println("   snapshot with ",u," wrong cells, word htm=",n.cost)
        for x in pr.constrained
            G.satisfied(pr,occ,x) || println("     ",describe(pr,occ,x))
        end
        st=G.P.compose(start,G.P.macro_word_perm(n.word,gens))
        pre2=G.P.chain_core_prefix(source,st,target,action)
        println("     old hybrid finish: core right=",G.satisfied(pr,occ,253),", planner core prefix on this snapshot=",pre2.word,", wrong cells before ",G.unsat(pr,occ)," after prefix ",G.unsat(pr,G.occupants(pre2.state)))
    end
end
