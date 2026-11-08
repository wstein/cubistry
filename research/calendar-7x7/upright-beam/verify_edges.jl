#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# INDEPENDENT replay of edge words (uses only upright-moves/verify_moves.jl: own parser,
# own geometry, own boards, own strict front rule; no solver code).
#   verify_edges.jl PRINT MOVES_TSV EDGES_TSV
# MOVES_TSV: the 91 root words (id year month status htm word seconds).
# EDGES_TSV: header + rows  from_id to_id from_year from_month to_year to_month htm seconds method word
# Mode A (rows with from_id != "-"): start = root word of from_id, apply the edge word,
#   the front must show the month of to_id (boards recomputed from the calendar).
# For a retained-state chain (rows share one state) use verify_chain.jl.
include(joinpath(@__DIR__,"..","upright-moves","verify_moves.jl"))
function edges(print_path,moves_path,edges_path)
    st0=read_print(print_path)
    roots=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(moves_path)[2:end])
    rows=[split(l,'\t') for l in readlines(edges_path)[2:end] if !isempty(l)]
    ok=true;hs=Int[];n=0
    for f in rows
        from=parse(Int,f[1]);to=parse(Int,f[2]);ty=parse(Int,f[5]);tm=parse(Int,f[6]);claimed=parse(Int,f[7])
        f[9]=="UNKNOWN" && (println("edge-check\t",from,"->",to,"\tUNKNOWN");ok=false;continue)
        w=parse.(Int,split(f[10],','))
        state=apply_word(apply_word(st0,roots[from]),w)
        r=check_front(state,board(ty,tm));h=htm(w)
        v=(r.bad==0 && h==claimed && r.turned==0) ? "ACCEPT" : (r.bad==0 && h==claimed ? "ACCEPT_TURNED" : "REJECT")
        println("edge-check\t",from,"->",to,'\t',v,'\t',h,"\tbad=",r.bad,"\tturned=",r.turned)
        v=="REJECT" && (ok=false);push!(hs,h);n+=1
    end
    if !isempty(hs)
        s=sort(hs);m=length(s);med=isodd(m) ? s[(m+1)÷2] : (s[m÷2]+s[m÷2+1])/2
        println("edge-stats\tn=",n,"\tmedian=",med,"\tmean=",round(sum(s)/m;digits=1),"\tmin=",s[1],"\tmax=",s[end])
    end
    println("edge-verdict\t",ok ? "ACCEPT_ALL" : "REJECT");exit(ok ? 0 : 1)
end
if abspath(PROGRAM_FILE)==(@__FILE__); edges(ARGS[1],ARGS[2],ARGS[3]); end
