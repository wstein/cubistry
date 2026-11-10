#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Raw negative witnesses; this program makes no proof decision.
@assert length(ARGS)==3 "negative_cases.jl CHAIN STATES_DIRECTORY OUT"
chain,states,out=ARGS;mkpath(out)
raw=read(chain,String);rows=readlines(chain)
field(s,n,v)=begin f=String.(split(s,'\t'));f[n]=v;join(f,'\t') end
const REASONS=Dict(
    "wrong-adjacent-month"=>("chronological month adjacency","chronological month adjacency"),
    "wrong-htm"=>("exact HTM QTM and rotation metrics","exact HTM QTM and rotation metrics"),
    "wrong-qtm"=>("exact HTM QTM and rotation metrics","exact HTM QTM and rotation metrics"),
    "wrong-rotation-count"=>("exact HTM QTM and rotation metrics","exact HTM QTM and rotation metrics"),
    "wrong-rotation-qtm"=>("exact HTM QTM and rotation metrics","exact HTM QTM and rotation metrics"),
    "wrong-source-hash"=>("edge source continuity","edge source continuity"),
    "wrong-end-hash"=>("edge end digest","edge end digest"),
    "middle-slice-generator"=>("legal generator and exponent; no middle slice","legal generator and exponent; no middle slice"),
    "zero-exponent"=>("legal generator and exponent; no middle slice","legal generator and exponent; no middle slice"),
    "noncanonical-lf"=>("canonical chain UTF-8/LF","CR forbidden in canonical TSV"),
    "missing-finish"=>("chain header and trailer","missing chain finish"),
    "changed-hidden-root-surface"=>("root full-state snapshot","root full-state snapshot"),
    "changed-retained-surface"=>("complete immutable-art state snapshot","complete immutable-art state snapshot"))
function fixture(name,change;statechange=nothing)
    path=joinpath(out,name);mkpath(path)
    cp(states,joinpath(path,"states");force=true)
    write(joinpath(path,"moves.tsv"),change(copy(rows)))
    isnothing(statechange) || statechange(joinpath(path,"states"))
    println(name,'\t',join(REASONS[name],'\t'))
end
serialize(r)=join(r,'\n')*"\n"
fixture("wrong-adjacent-month",r->(r[3]=field(r[3],3,"7");serialize(r)))
fixture("wrong-htm",r->(r[3]=field(r[3],4,"451");serialize(r)))
fixture("wrong-qtm",r->(r[3]=field(r[3],5,"461");serialize(r)))
fixture("wrong-rotation-count",r->(r[3]=field(r[3],6,"23");serialize(r)))
fixture("wrong-rotation-qtm",r->(r[3]=field(r[3],7,"23");serialize(r)))
fixture("wrong-source-hash",r->(r[3]=field(r[3],8,repeat("0",64));serialize(r)))
fixture("wrong-end-hash",r->(r[3]=field(r[3],9,repeat("0",64));serialize(r)))
fixture("middle-slice-generator",r->(r[4]="move\t0\t1";serialize(r)))
fixture("zero-exponent",r->(r[4]="move\t14\t0";serialize(r)))
fixture("noncanonical-lf",r->replace(serialize(r),"\n"=>"\r\n"))
fixture("missing-finish",r->serialize(r[1:end-1]))
fixture("changed-hidden-root-surface",serialize;statechange=dir->begin
    p=joinpath(dir,"state-01.tsv");s=readlines(p)
    s[2]=field(s[2],6,"28");write(p,serialize(s))
end)
fixture("changed-retained-surface",serialize;statechange=dir->begin
    p=joinpath(dir,"state-02.tsv");s=readlines(p)
    s[2]=field(s[2],5,"0,0,1");write(p,serialize(s))
end)
