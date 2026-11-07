#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Independent replay: do the DAG states show the pure-split displays under the strict
# upright rule (only 0 and 6<->9 read the same turned; stacked labels upright)?
#   check_strict_states.jl PRINT DAG IDS   IDS = comma list or all
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
empty!(HALF);merge!(HALF,Dict('0'=>'0','6'=>'9','9'=>'6'))
function main(print_path,dag_path,ids_arg)
    source=read_physical(print_path);goals=stacked_goals(PURE_VARIANT);proof=replay_dag(dag_path)
    ids=ids_arg=="all" ? collect(1:91) : [parse(Int,x) for x in split(ids_arg,',')]
    pass=0
    for id in ids
        state=decode_physical(source,signed_perm(proof.registers,proof.targets[id]),proof.action)
        cell=front_failure(state,goals[id].board,"strict");ok=cell=="-\t-\t-\t-"
        # independent turned-sticker count on the front
        turned=0
        for r in 1:7,c in 1:7
            s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
            isempty(s.text) && continue
            findfirst(==(s.up),IMAGE_UPS)!=1 && !(replace(s.text,'O'=>'0') in ("0","6","9")) && (turned+=1)
        end
        ok && (pass+=1)
        println("strict-state\t",id,'\t',goals[id].year,'\t',goals[id].month,'\t',ok ? "PASS" : "FAIL",'\t',cell,"\tviolating_turned=",turned)
    end
    println("strict-states-summary\t",pass,'/',length(ids))
end
main(ARGS...)
