# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED statistics: for each display transition, how many front cells are wrong at the
# start (after the core frame prefix) and how many cells differ between the two boards.
#   wrong_counts.jl PAIRS_FILE OUT_TSV     (PAIRS_FILE: lines "from:to")
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
proof=G.P.replay_dag(DAG);action=proof.action
gens=[UInt16.(g) for g in action.generators]
source=G.P.read_physical(PRINT)
rootword=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(MOVES)[2:end])
open(ARGS[2],"w") do log
    println(log,"from_id\tto_id\tcells_differing\twrong_at_start_raw\twrong_at_start_after_prefix\tpairs_dropped_by_tightening")
    for l in readlines(ARGS[1])
        isempty(l) && continue
        from,to=parse.(Int,split(l,':'))
        start=G.P.macro_word_perm(rootword[from],gens)
        target=(year=goals[to].year,month=goals[to].month,board=goals[to].board)
        pr,dropped=strict_problem(source,target,action,G.ORBIT_WEIGHTS_W1)
        raw=G.unsat(pr,G.occupants(start))
        pre=G.P.chain_core_prefix(source,start,target,action)
        diff=count(r->goals[from].board[r]!=goals[to].board[r],CartesianIndices(goals[to].board))
        println(log,join([from,to,diff,raw,G.unsat(pr,G.occupants(pre.state)),dropped],'\t'))
    end
end
