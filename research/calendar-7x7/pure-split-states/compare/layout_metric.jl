#!/usr/bin/env julia
# Descriptive listing, not a proof and not a cost (Julia only): for every month
# transition from 2027-01 to 2099-12, the number of front cells (rows 1-7) whose label
# or ink differs between consecutive displays, for the PR #99 layout and for the pure
# split with month-letter scheme A. Also the number of labels that appear on both
# displays but at different cells ("moved labels").
include(joinpath(@__DIR__,"..","pure_common.jl"))
const PR99="F31=keep,S30=keep,S31=keep"     # equals the PR #99 boards (wrap marks, PR #99 letters)
mtype(y,m)=(off=offset(y,m,"EN");n=daysinmonth(Date(y,m,1));w=div(off+n-1,7)+1;
    w<6 ? "plain" : off==5 ? "F31" : n==30 ? "S30" : "S31")
function counts(a,b)
    diff=count(a[r,c]!=b[r,c] for r in 1:7,c in 1:7)
    pos(x)=Dict(x[r,c]=>(r,c) for r in 1:7,c in 1:7 if !isempty(x[r,c][1]))
    pa,pb=pos(a),pos(b)
    moved=count(k->haskey(pb,k) && pb[k]!=pa[k],keys(pa))
    (diff,moved)
end
months=[(y,m) for y in 2027:2099 for m in 1:12]
println("# descriptive listing, not a proof and not a cost; layout_pr99 = ",PR99,", layout_pure = ",PURE_VARIANT)
println("from\tto\tfrom_type\tto_type\tpr99_diff\tpr99_moved\tpure_diff\tpure_moved")
for i in 1:length(months)-1
    (y1,m1),(y2,m2)=months[i],months[i+1]
    a99,b99=stacked_board(y1,m1,PR99),stacked_board(y2,m2,PR99)
    ap,bp=stacked_board(y1,m1,PURE_VARIANT),stacked_board(y2,m2,PURE_VARIANT)
    d99,mv99=counts(a99,b99);dp,mvp=counts(ap,bp)
    println("$y1-$(lpad(m1,2,'0'))\t$y2-$(lpad(m2,2,'0'))\t",mtype(y1,m1),'\t',mtype(y2,m2),'\t',d99,'\t',mv99,'\t',dp,'\t',mvp)
end
