#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Orbit inventory of the pure split A under two front rules, and the supply of the
# current print against each. Necessary conditions only (no cubie matching, no search).
#   upright_inventory.jl PRINT RULE      RULE = relaxed (today) | strict (owner)
# strict: only 0 (any turn) and the single digits 6<->9 read the same after a half
# turn; 1, 2, 5, 8, H, N, S, X, Z and every multi-character label must be upright.
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
function set_rule(rule)
    empty!(HALF)
    if rule=="strict"
        merge!(HALF,Dict('0'=>'0','6'=>'9','9'=>'6'))
    else
        merge!(HALF,Dict('0'=>'0','1'=>'1','2'=>'2','5'=>'5','6'=>'9','9'=>'6','8'=>'8',
            'H'=>'H','N'=>'N','S'=>'S','X'=>'X','Z'=>'Z'))
    end
end
function main(print_path,rule)
    set_rule(rule)
    source=read_physical(print_path);goals=stacked_goals(PURE_VARIANT)
    req=pure_requirement(goals);have=Dict{Tuple{Int,Int},Dict{NTuple{3,String},Int}}()
    for s in source
        k,a=surface_class(s);d=get!(have,k,Dict{NTuple{3,String},Int}());d[a]=get(d,a,0)+1
    end
    println("rule\t",rule)
    tot_need=0;tot_short=0;tot_slack_neg=0
    println("orbit-header\tx\ty\tcapacity\trequired_printed\tblank_peak\tslack\tprint_missing\tmissing_classes")
    for k in sort!(collect(keys(req)))
        h=get(have,k,Dict{NTuple{3,String},Int}())
        need=sum(v for (a,v) in req[k] if a[3]!="blank";init=0)
        blank=get(req[k],("","0","blank"),0);cap=capacity(k)
        miss=[(a,v-get(h,a,0)) for (a,v) in req[k] if v>get(h,a,0)]
        sort!(miss;by=x->x[1])
        slack=cap-need-blank
        tot_need+=need;tot_short+=sum(m[2] for m in miss;init=0);slack<0 && (tot_slack_neg+=1)
        println("orbit\t",k[1],'\t',k[2],'\t',cap,'\t',need,'\t',blank,'\t',slack,'\t',sum(m[2] for m in miss;init=0),'\t',
            join(["$(m[1][1])/a$(m[1][2])/$(m[1][3])x$(m[2])" for m in miss],' '))
    end
    println("inventory-summary\t",rule,"\trequired_total=",tot_need,"\tprint_missing_total=",tot_short,"\torbits_over_capacity=",tot_slack_neg)
    # spare printable positions: capacity - required - blank peak, summed over orbits
end
main(ARGS...)
