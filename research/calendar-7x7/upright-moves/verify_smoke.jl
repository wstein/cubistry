#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Independent replay of the smoke chain (root word of 2028-01, then the edges of
# chain_smoke.jl on one retained state): after the root and after every edge the front
# must show that month under the strict rule (uses verify_moves.jl only).
#   verify_smoke.jl PRINT MOVES_TSV SMOKE_TSV
include(joinpath(@__DIR__,"verify_moves.jl"))
function smoke(print_path,moves_path,smoke_path)
    st=read_print(print_path)
    roots=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(moves_path)[2:end])
    rows=[split(l,'\t') for l in readlines(smoke_path)[2:end] if !isempty(l)]
    state=apply_word(st,roots[25]); ok=true; total=0
    r=check_front(state,board(2028,1)); println("smoke-root\t2028-1\t",r.bad==0 ? "ACCEPT" : "REJECT"); ok&=r.bad==0
    for f in rows
        f[5]=="UNKNOWN" && (println("smoke-edge\t",f[1],"->",f[2],"\tUNKNOWN");ok=false;continue)
        y,m=parse.(Int,split(f[2],'-')); w=parse.(Int,split(f[8],','))
        state=apply_word(state,w); r=check_front(state,board(y,m)); h=htm(w); total+=h
        println("smoke-edge\t",f[1],"->",f[2],'\t',r.bad==0 && h==parse(Int,f[6]) ? "ACCEPT" : "REJECT",'\t',h,'\t',f[5])
        ok&=(r.bad==0 && h==parse(Int,f[6]))
    end
    println("smoke-total-edge-htm\t",total,"\tedges\t",length(rows))
    println("smoke-verdict\t",ok ? "ACCEPT" : "REJECT"); exit(ok ? 0 : 1)
end
if abspath(PROGRAM_FILE)==(@__FILE__); smoke(ARGS[1],ARGS[2],ARGS[3]); end
