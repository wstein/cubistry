#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Baseline: in the 91 pure-split-A goal states, count front stickers that are turned.
# Owner rule: only the digit 0 (any turn) and the single digits 6/9 may read turned;
# letters O and I are not 0 and 1 (no aliasing). Also lists the "alias uses": front cells
# whose sticker text differs from the cell text (FR1 for FRI, M0N for MON, 0 for O).
#   baseline_turned.jl PRINT DAG
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
function main(print_path,dag_path)
    source=read_physical(print_path);goals=stacked_goals(PURE_VARIANT)
    proof=replay_dag(dag_path)
    rows=Any[]
    println("turned-header\tid\tyear\tmonth\ttype\tturned_all\tturned_violating\tglyphs_violating\tfront_ok_old_rule\talias_uses_count\talias_uses")
    for id in 1:91
        state=decode_physical(source,signed_perm(proof.registers,proof.targets[id]),proof.action)
        ok_old=front_failure(state,goals[id].board,"strict")=="-\t-\t-\t-"
        all_t=0;viol=String[];alias=String[]
        for r in 1:7,c in 1:7
            s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
            isempty(s.text) && continue
            angle=findfirst(==(s.up),IMAGE_UPS)-1
            want=goals[id].board[r,c][1]
            shown=(angle==0 || s.text=="0" || !all(ch->haskey(HALF,ch),s.text)) ? s.text : join(HALF[ch] for ch in reverse(collect(s.text)))
            shown!=want && push!(alias,"$(s.text)->$(want)@$(r),$(c)")
            angle==0 && continue
            all_t+=1
            (s.text=="0" || s.text in ("6","9")) && continue
            push!(viol,"$(s.text)@$(r),$(c)a$(angle)")
        end
        g=goals[id];mo=g.month
        leap=mo==2 && count(x->x[1]=="29",[g.board[r,c] for r in 3:7,c in 1:7])>0
        type=mo==2 && leap ? "02L" : lpad(mo,2,'0')
        push!(rows,(type,all_t,length(viol),viol,alias))
        println("turned\t",id,'\t',g.year,'\t',mo,'\t',type,'\t',all_t,'\t',length(viol),'\t',join(viol,' '),'\t',ok_old,'\t',length(alias),'\t',join(alias," "))
    end
    println("type-header\ttype\tdisplays\tturned_all_total\tviolating_total\tviolating_min\tviolating_max\tdisplays_fully_upright")
    for t in sort!(unique(r[1] for r in rows))
        rs=filter(r->r[1]==t,rows);v=[r[3] for r in rs]
        println("type\t",t,'\t',length(rs),'\t',sum(r[2] for r in rs),'\t',sum(v),'\t',minimum(v),'\t',maximum(v),'\t',count(==(0),v))
    end
    glyph=Dict{String,Int}()
    for r in rows,w in r[4];g=first(split(w,'@'));glyph[g]=get(glyph,g,0)+1;end
    for g in sort!(collect(keys(glyph)));println("glyph\t",g,'\t',glyph[g]);end
    am=Dict{String,Int}()
    for r in rows,w in r[5];k=first(split(w,'@'));am[k]=get(am,k,0)+1;end
    for k in sort!(collect(keys(am)));println("alias-use\t",k,'\t',am[k]);end
    println("alias-summary\t",count(r->!isempty(r[5]),rows),'\t',sum(length(r[5]) for r in rows))
    println("baseline-summary\t91\t",sum(r[3] for r in rows),'\t',count(r->r[3]==0,rows))
end
main(ARGS...)
