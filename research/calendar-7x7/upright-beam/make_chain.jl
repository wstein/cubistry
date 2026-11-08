#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED chain writer (candidate only; pure_chain.jl and the Flix chain verifier decide).
# Turns the edge words of an edge TSV (edge_batch.jl "smoke" format, one retained state)
# into a cubistry.calendar7.chain.v1 file for the strict upright print: the source state is
# the solved print turned by the root word of the source display (moves-strict.tsv), every
# edge word is applied to the retained state, and the full-state SHA-256 of the state before
# and after every edge is recorded (state_digest, the digest the chain verifiers recompute).
#   make_chain.jl DAG PRINT ROOT_MOVES ROOT_ID EDGES_TSV OUT_MOVES_TSV
# EDGES_TSV rows: from  to  from_id  to_id  method  htm  seconds  word   (to = "YYYY-M")
# DAG is used only for the 21 generator permutations (pose action), not for any root state.
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)
function main(dag,print_path,moves_path,root_id,edges_path,out)
    proof=G.P.replay_dag(dag);action=proof.action
    gens=[UInt16.(g) for g in action.generators]
    source=G.P.read_physical(print_path)
    digest(st)=G.P.state_digest(G.P.decode_physical(source,st,action))
    row=only([split(l,'\t') for l in readlines(moves_path)[2:end] if !isempty(l) && parse(Int,split(l,'\t')[1])==root_id])
    ry,rm=parse(Int,row[2]),parse(Int,row[3])
    state=G.P.macro_word_perm(parse.(Int,split(row[6],',')),gens)
    hash0=digest(state)
    words=Vector{Int}[];hashes=Tuple{String,String}[];edges=Any[]
    for l in readlines(edges_path)[2:end]
        isempty(l) && continue
        f=split(l,'\t');f[5]=="UNKNOWN" && error("edge $(f[1])->$(f[2]) is UNKNOWN")
        y,m=parse.(Int,split(f[2],'-'));w=parse.(Int,split(f[8],','))
        before=digest(state);state=G.P.compose(state,G.P.macro_word_perm(w,gens))
        push!(words,w);push!(hashes,(before,digest(state)));push!(edges,(;year=y,month=m))
    end
    G.M.export_chain(out,(;root=root_id,year=ry,month=rm,hash=hash0,edges),words,action;hashes)
    println("chain-written\t",out,"\tedges\t",length(edges),"\tsource-sha256\t",hash0)
end
if abspath(PROGRAM_FILE)==@__FILE__; main(ARGS[1],ARGS[2],ARGS[3],parse(Int,ARGS[4]),ARGS[5],ARGS[6]); end
