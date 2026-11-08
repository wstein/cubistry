#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Cross-check (not a proof): the independent replay of verify_moves.jl and the research
# library (decode_physical of the composed generator permutations) reach the same
# 294-sticker state for every word. Compares state digests.
#   crosscheck_library.jl DAG PRINT MOVES_TSV VERIFY_OUTPUT
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
include(joinpath(@__DIR__,"..","global-search","search.jl"))
const G=GlobalSearch
proof=G.P.replay_dag(ARGS[1]);action=proof.action;gens=[UInt16.(g) for g in action.generators]
source=G.P.read_physical(ARGS[2])
mine=Dict{Int,String}()
for l in readlines(ARGS[4]); f=split(l,'\t'); f[1]=="move-check" && (mine[parse(Int,f[2])]=f[end]); end
function crosscheck()
same=0;diff=0
for l in readlines(ARGS[3])[2:end]
    f=split(l,'\t');id=parse(Int,f[1]);word=parse.(Int,split(f[6],','))
    st=G.P.macro_word_perm(word,gens)
    d=G.P.state_digest(G.P.decode_physical(source,st,action))
    d==get(mine,id,"") ? (same+=1) : (diff+=1;println("crosscheck-DIFF\t",id))
end
println("crosscheck\tsame=",same,"\tdifferent=",diff)
diff
end
exit(crosscheck()==0 ? 0 : 1)
