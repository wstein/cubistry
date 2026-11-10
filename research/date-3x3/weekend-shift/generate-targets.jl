# SPDX-License-Identifier: AGPL-3.0-or-later
# Data construction only; native checkers independently reconstruct every row.
using Dates
root=ARGS[1];path=joinpath(root,"targets.tsv");ispath(path) && error("refusing to overwrite targets")
wd=split.(readlines(joinpath(root,"weekdays.tsv")),'\t';keepempty=true)[2:end]
mo=split.(readlines(joinpath(root,"months.tsv")),'\t';keepempty=true)[2:end]
open(path,"w") do out
 println(out,join(vcat(["weekday","month","day"],["cell$i" for i in 0:8]),'\t'))
 for w in 0:6,m in 1:12,d in 1:daysinmonth(Date(2000,m,1))
  text=vcat(wd[w+1][3:5],["",string(d÷10),string(d%10)],mo[m][2:4]);roles=vcat(fill(wd[w+1][6],3),fill("day",3),fill("month",3))
  cells=[text[i]*":"*(text[i]=="" ? "blank" : roles[i]) for i in 1:9]
  println(out,join(vcat(string.([w,m,d]),cells),'\t'))
 end
end
