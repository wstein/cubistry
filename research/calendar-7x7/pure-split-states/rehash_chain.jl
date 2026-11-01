#!/usr/bin/env julia
# Control generator only (not a checker): rewrites the state digests of a chain file as
# if the chain were replayed under another print, so that a verifier's digest checks pass
# and only its front rule can reject the chain. Usage: rehash_chain.jl PRINT DAG CHAIN OUT
include(joinpath(@__DIR__,"pure_chain.jl"))
function rehash(print_path,dag_path,chain_path,out)
    printing=read_physical(print_path);input=read_chain(chain_path)
    proof=replay_dag(dag_path;require_full=false)
    state=decode_physical(printing,signed_perm(proof.registers,proof.targets[input.root]),proof.action)
    hashes=[state_digest(state)]
    for e in input.edges
        for (g,q) in e.moves;state=direct_move(state,g,q);end
        push!(hashes,state_digest(state))
    end
    lines=strict_lines(chain_path);k=0
    open(out,"w") do io
        for l in lines
            f=split(l,'\t')
            if f[1]=="source";f[5]=hashes[1]
            elseif f[1]=="edge";k+=1;f[8]=hashes[k];f[9]=hashes[k+1];end
            println(io,join(f,'\t'))
        end
    end
end
rehash(ARGS...)
