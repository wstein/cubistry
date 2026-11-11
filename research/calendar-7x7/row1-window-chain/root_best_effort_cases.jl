#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Raw witnesses for the chain root month (root != first member of S) and for best-effort months (wrong cells with Hall witnesses).
# No proof decision is made here; all three checkers verify the fixtures.
#   root_best_effort_cases.jl OUT        (reads the stored 21-month chain, print and states)
# Every fixture directory has months.tsv, months.sha256, print.tsv, print.sha256, moves.tsv, states/ and optionally root.txt.
# OUT/cases.tsv: name, accept|reject, Julia reason, Flix reason, independent reason (reasons empty for accept).
include(joinpath(@__DIR__,"check.jl"))
using SHA
out=only(ARGS);mkpath(out)
printp=joinpath(@__DIR__,"..","row1-window-print","evidence","printing.tsv")
chainp=joinpath(@__DIR__,"evidence","moves.tsv");statesd=joinpath(@__DIR__,"evidence","states")
rows=readlines(chainp);rh=split(rows[2],'\t');hash0=String(rh[5])
sha(s)=bytes2hex(sha256(codeunits(s)))
mtext((y,m))=string(y,'-',lpad(m,2,'0'))
listtext(ms)=join(mtext.(ms),"\n")*"\n"
printtext=read(printp,String)
function edit_print(edits)            # edits: id => (text,ink) replaces the artwork of that sticker
    ls=readlines(printp)
    for (id,(t,ink)) in edits
        f=split(ls[id+1],'\t');f[6]=t;f[7]=ink;ls[id+1]=join(f,'\t')
    end
    join(ls,"\n")*"\n"
end
function stored_edges()
    es=[];i=3
    while rows[i]!="finish"
        f=split(rows[i],'\t');j=i+1;mv=String[]
        while rows[j]!="end";push!(mv,rows[j]);j+=1;end
        push!(es,(ym=(parse(Int,f[2]),parse(Int,f[3])),metrics=join(f[4:7],'\t'),src=String(f[8]),fin=String(f[9]),moves=mv));i=j+1
    end
    es
end
edges=stored_edges();months=[(2026,5);[e.ym for e in edges]]
statetext(i)=read(joinpath(statesd,"state-"*lpad(i,2,'0')*".tsv"),String)
chain_text(header,recordline,es)=join(vcat([header,recordline],reduce(vcat,[vcat(["edge\t$(e.ym[1])\t$(e.ym[2])\t$(e.metrics)\t$(e.src)\t$(e.fin)"],get(e,:extra,String[]),e.moves,["end"]) for e in es]),["finish"]),"\n")*"\n"
function fixture(name,list,ptext,ctext,states;root=nothing)
    d=joinpath(out,name);mkpath(joinpath(d,"states"))
    lt=listtext(list);write(joinpath(d,"months.tsv"),lt);write(joinpath(d,"months.sha256"),sha(lt))
    write(joinpath(d,"print.tsv"),ptext);write(joinpath(d,"print.sha256"),sha(ptext))
    write(joinpath(d,"moves.tsv"),ctext)
    isnothing(root) || write(joinpath(d,"root.txt"),root*"\n")
    for (i,t) in enumerate(states);write(joinpath(d,"states","state-"*lpad(i,2,'0')*".tsv"),t);end
end
cases=String[];add(name,kind,j="",f="",i="")=push!(cases,join((name,kind,j,f,i),'\t'))
v1="cubistry.calendar7.chain.v1";v2="cubistry.calendar7.chain.v2"
rec(r,y,m)="source\t$m\t$y\t$m\t$hash0"
stored_states=[statetext(i) for i in 1:length(months)]
# ---- root month that is not the first member of S -------------------------------------------------------------
# 2037-05 shows the same board as 2026-05 (same calendar), so the identity pose of the stored print is a valid root for it.
fixture("root-edge-2037-05",months[2:end],printtext,chain_text(v1,rec(5,2037,5),edges),stored_states;root="2037-05");add("root-edge-2037-05","accept")
fixture("root-month-1980-01",months[2:end],printtext,chain_text(v1,rec(1,1980,1),edges),stored_states;root="1980-01")
add("root-month-1980-01","reject","identity root front","identity root front","identity root front")
fixture("root-record-mismatch",months[2:end],printtext,join(rows,"\n")*"\n",stored_states;root="2037-05")
add("root-record-mismatch","reject","identity root record is the root month","identity root record is the root month","root record")
fixture("root-equals-first-member",months,printtext,join(rows,"\n")*"\n",stored_states;root="2026-05");add("root-equals-first-member","accept")
# root edge with zero moves: root 2037-05, S starts at 2026-05 (same board): the root edge needs no move
zero=(ym=(2026,5),metrics="0\t0\t0\t0",src=hash0,fin=hash0,moves=String[])
fixture("root-edge-zero-moves",months,printtext,chain_text(v1,rec(5,2037,5),vcat([zero],edges)),vcat([stored_states[1]],stored_states);root="2037-05");add("root-edge-zero-moves","accept")
# ---- best-effort months ------------------------------------------------------------------------------------------
# Body 39 (home -3,0,0) is the only center showing 10 on the stored print; with its sticker changed to 9 no center body can show the 10
# of June 2026 at the center cell (4,4), so the front of state 2 has at least one wrong cell, and exactly one: (4,4).
function two_state(ptext,header,extra)
    f=tempname();write(f,ptext);src=window_read_print(f);st0=[(id=s.id,piece=s.piece,pos=s.home,normal=s.normal,up=s.up,text=s.text,ink=s.ink) for s in src]
    mv=[(parse(Int,split(l,'\t')[2]),parse(Int,split(l,'\t')[3])) for l in edges[1].moves];st1=st0
    for (g,e) in mv;st1=chain_move(st1,g,e);end
    h0=chain_digest(st0);h1=chain_digest(st1)
    e=(ym=(2026,6),metrics=edges[1].metrics,src=h0,fin=h1,moves=edges[1].moves,extra=extra)
    chain_text(header,"source\t5\t2026\t5\t$h0",[e]),[chain_state_text(st0;header=true),chain_state_text(st1;header=true)]
end
two=[(2026,5),(2026,6)]
p9=edit_print(Dict(39=>("9","dark")))
c,s=two_state(p9,v2,["wrong\t4\t4","hall\t4,4"]);fixture("best-effort-center",two,p9,c,s);add("best-effort-center","accept")
c,s=two_state(p9,v2,["hall\t4,4","wrong\t4\t4"]);fixture("best-effort-wrong-after-hall",two,p9,c,s)
add("best-effort-wrong-after-hall","reject","move record","wrong record after hall record","move line")
c,s=two_state(p9,v2,["wrong\t4\t4","hall\t4,4","hall\t4,4"]);fixture("best-effort-hall-duplicate",two,p9,c,s)
add("best-effort-hall-duplicate","reject","disjoint nonempty Hall sets","disjoint nonempty Hall sets","disjoint nonempty Hall sets")
# Hall set X = {(5,7),(7,3)} of one body class with deficiency 1 but two wrong cells: the count must equal the deficiency
pcnt=edit_print(Dict(44=>("7","dark"),181=>("7","red"),262=>("7","red")))
c,s=two_state(pcnt,v2,["wrong\t5\t7","wrong\t7\t3","hall\t5,7;7,3"]);fixture("best-effort-count-gt-deficiency",two,pcnt,c,s)
add("best-effort-count-gt-deficiency","reject","wrong cells in a Hall set equal its deficiency","wrong cells in a Hall set equal its deficiency","wrong cells in a Hall set equal its deficiency")
c,s=two_state(p9,v2,["wrong\t4\t4"]);fixture("best-effort-no-hall",two,p9,c,s)
add("best-effort-no-hall","reject","best-effort month needs Hall witnesses","best-effort month needs Hall witnesses","best-effort month needs Hall witnesses")
c,s=two_state(p9,v2,String[]);fixture("best-effort-unlisted-wrong",two,p9,c,s)
add("best-effort-unlisted-wrong","reject","strict month front including band line","strict month front including band line","strict row-one-name front")
p10=edit_print(Dict(39=>("9","dark"),157=>("10","dark")))     # another center can now show the 10: no deficiency
c,s=two_state(p10,v2,["wrong\t4\t4","hall\t4,4"]);fixture("best-effort-not-minimal",two,p10,c,s)
add("best-effort-not-minimal","reject","Hall set has a deficiency","Hall set has a deficiency","Hall set has a deficiency")
c,s=two_state(p9,v2,["wrong\t4\t4","hall\t4,3;4,4"]);fixture("best-effort-hall-two-classes",two,p9,c,s)
add("best-effort-hall-two-classes","reject","Hall set inside one body class","Hall set inside one body class","Hall set inside one body class")
c,s=two_state(p9,v1,["wrong\t4\t4","hall\t4,4"]);fixture("best-effort-v1-header",two,p9,c,s)
add("best-effort-v1-header","reject","move record","edge record","move line")
c,s=two_state(p9,v2,["wrong\t4\t4","wrong\t1\t1","hall\t4,4"]);fixture("best-effort-wrong-unsorted",two,p9,c,s)
add("best-effort-wrong-unsorted","reject","wrong cells strictly increasing","wrong cells strictly increasing","wrong cells strictly increasing")
c,s=two_state(printtext,v2,["hall\t4,4"]);fixture("exact-month-with-hall",two,printtext,c,s)
add("exact-month-with-hall","reject","Hall witnesses without wrong cells","Hall witnesses without wrong cells","Hall witnesses without wrong cells")
c,s=two_state(printtext,v2,String[]);fixture("exact-v2",two,printtext,c,s);add("exact-v2","accept")
# ---- stages: free start state (chain.v3 start block) and junction digests --------------------------------------------
# A stage whose first member is not the root starts at any legal state that shows the first member. Here the stored chain is cut after
# its first edge: the stage 2026-06 .. 2028-01 starts at the state after edge 1, reached from the identity pose by edge 1's moves.
v3="cubistry.calendar7.chain.v3"
function fixture_join(name;start="",stop="")           # junction digests are read by the runner (join.txt)
    d=joinpath(out,name);open(joinpath(d,"join.txt"),"w") do io;println(io,"start=",start);println(io,"end=",stop);end
end
startblock(mv)=join(vcat(["start\t$(length(mv))"],mv),"\n")
rec3(y,m,h,mv)="source\t$m\t$y\t$m\t$h\n"*startblock(mv)
stage_edges=edges[2:end];stage_months=months[2:end];stage_states=stored_states[2:end]
free_c=chain_text(v3,rec3(2026,6,edges[1].fin,edges[1].moves),stage_edges)
fixture("stage-free-start",stage_months,printtext,free_c,stage_states);fixture_join("stage-free-start");add("stage-free-start","accept")
fixture("stage-join-both",stage_months,printtext,free_c,stage_states);fixture_join("stage-join-both";start=edges[1].fin,stop=edges[end].fin);add("stage-join-both","accept")
fixture("stage-join-identity-start",months,printtext,join(rows,"\n")*"\n",stored_states);fixture_join("stage-join-identity-start";start="identity");add("stage-join-identity-start","accept")
# a stage that ends at the identity pose: 2026-06 (free start) back to the identity pose, which shows the 2037-05 board
inv=[let f=split(l,'\t');"move\t$(f[2])\t$(f[3]=="2" ? 2 : -parse(Int,f[3]))" end for l in reverse(edges[1].moves)]
back=(ym=(2037,5),metrics=edges[1].metrics,src=edges[1].fin,fin=hash0,moves=inv)
fixture("stage-end-identity",[(2026,6),(2037,5)],printtext,chain_text(v3,rec3(2026,6,edges[1].fin,edges[1].moves),[back]),[stored_states[2],stored_states[1]]);fixture_join("stage-end-identity";stop="identity");add("stage-end-identity","accept")
# first stage of a two-stage pair: identity root 2026-05 -> 2026-06, whose end digest is the start digest of stage-free-start
c,s=two_state(printtext,v3,String[]);fixture("stage-pair-first",two,printtext,c,s);fixture_join("stage-pair-first";stop=edges[1].fin);add("stage-pair-first","accept")
exp3=copy(edges[1].moves);exp3[1]=join(vcat(split(exp3[1],'\t')[1:2],["3"]),'\t')
fixture("stage-start-exponent-3",stage_months,printtext,chain_text(v3,rec3(2026,6,edges[1].fin,exp3),stage_edges),stage_states)
add("stage-start-exponent-3","reject","legal start move","legal start move","start move")
fixture("stage-wrong-start-digest",stage_months,printtext,free_c,stage_states);fixture_join("stage-wrong-start-digest";start=edges[2].fin)
add("stage-wrong-start-digest","reject","start junction digest","start junction digest","start junction digest")
fixture("stage-wrong-end-digest",stage_months,printtext,free_c,stage_states);fixture_join("stage-wrong-end-digest";stop=edges[end-1].fin)
add("stage-wrong-end-digest","reject","end junction digest","end junction digest","end junction digest")
fixture("stage-end-not-identity",stage_months,printtext,free_c,stage_states);fixture_join("stage-end-not-identity";stop="identity")
add("stage-end-not-identity","reject","end junction digest","end junction digest","end junction digest")
fixture("stage-start-not-identity",stage_months,printtext,free_c,stage_states);fixture_join("stage-start-not-identity";start="identity")
add("stage-start-not-identity","reject","start junction digest","start junction digest","start junction digest")
fixture("stage-front-not-first-member",stage_months,printtext,chain_text(v3,rec3(2026,6,hash0,String[]),stage_edges),stage_states)
add("stage-front-not-first-member","reject","free start front is the first member","free start front is the first member","free start front is the first member")
fixture("stage-start-digest-mismatch",stage_months,printtext,chain_text(v3,rec3(2026,6,edges[2].fin,edges[1].moves),stage_edges),stage_states)
add("stage-start-digest-mismatch","reject","root digest","root digest","root digest")
fixture("stage-start-in-v2",stage_months,printtext,chain_text(v2,rec3(2026,6,edges[1].fin,edges[1].moves),stage_edges),stage_states)
add("stage-start-in-v2","reject","free start block needs chain.v3","free start block needs chain.v3","free start block needs chain.v3")
zero2=(ym=(2026,6),metrics="0\t0\t0\t0",src=edges[1].fin,fin=edges[1].fin,moves=String[])
fixture("stage-free-and-root-edge",stage_months,printtext,chain_text(v3,rec3(2037,5,edges[1].fin,edges[1].moves),vcat([zero2],stage_edges)),vcat([stored_states[2]],stage_states);root="2037-05")
add("stage-free-and-root-edge","reject","a free start has no root edge","a free start has no root edge","a free start has no root edge")
open(joinpath(out,"cases.tsv"),"w") do io;for c in cases;println(io,c);end;end
println("cases\t",length(cases))
