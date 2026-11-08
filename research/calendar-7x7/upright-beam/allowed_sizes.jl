# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED statistics: size of the allowed pose set of the 49 front cells, over the 91
# displays, for a print under the strict rule or under the old (relaxed) rule.
#   allowed_sizes.jl PRINT strict|old
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
ARGS[2]=="strict" && apply_strict_rule!(Main,G.M.P,G.M.V)
include(joinpath(HERE,"beam2.jl"))
goals=stacked_goals(PURE_VARIANT)
proof=G.P.replay_dag(get(ENV,"DAG","/tmp/dag-all.tsv"));action=proof.action
source=G.P.read_physical(ARGS[1])
function stats()
hist=Dict{Int,Int}();cells=0;tot=0;dropped=0;core=Dict{Int,Int}()
for g in goals
    target=(year=g.year,month=g.month,board=g.board)
    pr=G.Problem(source,target,action,G.ORBIT_WEIGHTS_W1)
    pr2,_,d=tighten(pr);dropped+=d
    for x in pr.constrained
        s=count(o->pr.allowed[o,x],1:264);hist[s]=get(hist,s,0)+1;cells+=1;tot+=s;x>240 && (core[s]=get(core,s,0)+1)
    end
end
println("allowed-sizes\t",ARGS[2],"\tcells\t",cells,"\tmean_size\t",round(tot/cells;digits=2),"\tsize1_share\t",round(get(hist,1,0)/cells;digits=3),"\tpairs_dropped_by_tightening_total\t",dropped)
println("allowed-hist\t",ARGS[2],"\t",join(["$k:$(hist[k])" for k in sort(collect(keys(hist)))],' '))
println("allowed-core-hist\t",ARGS[2],"\t",join(["$k:$(core[k])" for k in sort(collect(keys(core)))],' '))
end
stats()
