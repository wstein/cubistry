# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED statistics: per surface orbit, printed (non-blank) stickers vs the peak demand
# of the 91 displays under the strict rule (slack = printed - demand), and blanks.
#   supply_slack.jl PRINT
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
apply_strict_rule!(Main)
goals=stacked_goals(PURE_VARIANT)
source=read_physical(ARGS[1])
req=pure_requirement(goals)
have=Dict{Tuple{Int,Int},Dict{NTuple{3,String},Int}}()
for s in source
    k,c=surface_class(s);d=get!(have,k,Dict{NTuple{3,String},Int}());d[c]=get(d,c,0)+1
end
for k in sort!(collect(keys(req)))
    h=get(have,k,Dict{NTuple{3,String},Int}())
    need=sum(v for (c,v) in req[k] if c[3]!="blank";init=0);printed=sum(v for (c,v) in h if c[3]!="blank";init=0)
    println("supply\torbit\t",k,"\tdemand_nonblank\t",need,"\tprinted\t",printed,"\tslack\t",printed-need,"\tblank_demand\t",get(req[k],("","0","blank"),0),"\tblank_supply\t",get(h,("","0","blank"),0))
end
