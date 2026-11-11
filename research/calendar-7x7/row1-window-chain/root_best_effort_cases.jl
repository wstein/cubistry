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
open(joinpath(out,"cases.tsv"),"w") do io;for c in cases;println(io,c);end;end
println("cases\t",length(cases))
