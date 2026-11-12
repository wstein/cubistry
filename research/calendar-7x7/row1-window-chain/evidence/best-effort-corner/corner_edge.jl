#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate producer (check.jl, the Flix checker and verify_chain.jl decide).
# One-edge best-effort chain for February/Sunday/28 on a print: root 2026-05 (identity pose), month list [YYYY-MM], one edge into
# YYYY-MM whose front shows the month board with exactly one wrong cell (r,c) of the corner pair (7,1),(7,7).
#   julia --threads=4 corner_edge.jl OUT LAYOUT PRINT YYYY-MM R C [cand=K]
# The target is the month board with cell (R,C) replaced by the artwork of a corner sticker (candidate K of those that make the
# modified board matchable); the greedy orbit solver (as beam_edge.jl mode=greedy) finds a legal word from the identity pose.
# OUT gets months.tsv, months.sha256, print.tsv, print.sha256, moves.tsv, states/, root.txt and RESULT.txt (candidate, HTM, QTM).
@assert length(ARGS)>=5 "usage: corner_edge.jl OUT LAYOUT PRINT YYYY-MM R C [cand=K]"
using SHA
const CAL=normpath(joinpath(@__DIR__,"..","..",".."))
ENV["WINDOW_END"]=get(ENV,"WINDOW_END","2029-12")
include(joinpath(CAL,"row1-window-chain","window_chain_lib.jl"));using .WindowChainLib
include(joinpath(CAL,"row1-window-print","common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
include(joinpath(CAL,"pure-split-states","orbit_solve.jl"))
const G=GlobalSearch
apply_strict_rule!(G.P,G.M.V)
Core.eval(G.P,:(image_normal(g,q,ink)=Main.coupled_optic(g,q,ink)))
const P=G.P
out,layoutp,printp,ym,rs,cs=ARGS[1:6];ty,tm=parse.(Int,split(ym,'-'));wr,wc=parse(Int,rs),parse(Int,cs)
opts=Dict(String.(split(x,'='))[1]=>String.(split(x,'='))[2] for x in ARGS[7:end])
@assert !ispath(out) "Use a new scratch output directory"
labels=coupled_labels(read(layoutp,String));source=window_read_print(printp)
action=P.pose_action();gens=[UInt16.(g) for g in action.generators]
digest(st)=P.state_digest(P.decode_physical(source,st,action))
true_goal=coupled_month_goal(labels,ty,tm);gb=true_goal.board
homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
ckey=bodykey((wc-4,4-wr,3));chs=[h for h in homes if bodykey(h)==ckey]
ccells=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==ckey]
# matchability of the corner class with the cell (wr,wc) replaced by art
function matchable(board)
    opt=[[!isempty(window_piece_options(byhome[h],h,(c-4,4-r,3),board[r,c])) for h in chs] for (r,c) in ccells]
    function go(i,used)
        i>length(ccells) && return true
        for j in eachindex(chs);(used[j]||!opt[i][j]) && continue;used[j]=true;go(i+1,used) && return true;used[j]=false;end
        false
    end
    go(1,falses(length(chs)))
end
arts=sort(unique((s.text,s.ink) for h in chs for s in byhome[h]))
cands=Tuple{String,String}[]
for a in arts
    b=copy(gb);b[wr,wc]=a
    Main.coupled_optic(a[1],0,a[2])==Main.coupled_optic(gb[wr,wc][1],0,gb[wr,wc][2]) && continue   # still shows the true sticker: not wrong
    matchable(b) && push!(cands,a)
end
println("candidates for ($wr,$wc): ",length(cands));for (i,a) in enumerate(cands);println("  $i  ",a);end
k=parse(Int,get(opts,"cand","1"));art=cands[k]
tboard=copy(gb);tboard[wr,wc]=art
target=(year=ty,month=tm,board=tboard)
catalogs=P.chain_catalogues(action)
state0=P.identity_perm()
t0=time();r=orbit_solve(P,source,state0,target,action,catalogs);@assert !isnothing(r) "greedy orbit solver stalled"
word=P.macro_normalize(r.word);state1=P.compose(state0,P.macro_word_perm(word,gens))
act0=P.decode_physical(source,state0,action);act1=P.decode_physical(source,state1,action)
m=P.chain_metrics(word,action);h0,h1=digest(state0),digest(state1)
mkpath(joinpath(out,"states"))
function statefile(n,act)
    open(joinpath(out,"states","state-"*lpad(string(n),2,'0')*".tsv"),"w") do io
        println(io,"sticker\tpiece\tposition\tnormal\tup\ttext\tink")
        for s in act;println(io,join((s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    end
end
statefile(1,act0);statefile(2,act1)
partner=ckey;other=(wr,wc)==(7,1) ? (7,7) : (7,1)
hall=join(["7,1","7,7"],';')
rows=["cubistry.calendar7.chain.v2","source\t5\t2026\t5\t$h0","edge\t$ty\t$tm\t$(m.htm)\t$(m.qtm)\t$(m.rotations)\t$(m.rotation_qtm)\t$h0\t$h1","wrong\t$wr\t$wc","hall\t$hall"]
append!(rows,["move\t$g\t$q" for (g,q) in P.macro_moves(word)]);push!(rows,"end","finish")
write(joinpath(out,"moves.tsv"),join(rows,'\n')*"\n")
sha(s)=bytes2hex(sha256(codeunits(s)))
lt=ym*"\n";write(joinpath(out,"months.tsv"),lt);write(joinpath(out,"months.sha256"),sha(lt))
pt=read(printp,String);write(joinpath(out,"print.tsv"),pt);write(joinpath(out,"print.sha256"),sha(pt))
write(joinpath(out,"root.txt"),"2026-05\n")
res="RESULT month=$ym wrong=$wr,$wc replacement=$(art[1])|$(art[2]) cand=$k of $(length(cands)) HTM=$(m.htm) QTM=$(m.qtm) rot=$(m.rotations) seconds=$(round(time()-t0;digits=1))"
write(joinpath(out,"RESULT.txt"),res*"\n");println(res)
