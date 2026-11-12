#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fixtures of the root-2019 checks: small chains from the solved cube of print C (identity pose = January 2019) and negative controls.
#   root2019_cases.jl OUT
# Stored positives (evidence/root-2019): exact-2019-03 (list 2019-01 .. 2019-03, root = first member, 2 exact edges) and
# best-effort-2026-02 (list 2026-02, 2026-03, root 2019-01: a root edge into the best-effort month 2026-02, then an exact edge), both produced by
# window_chain.jl on print C (library=L1 width=20). Also read: evidence/best-effort-corner (print B, February 2026 with (7,1) and (7,7)).
# OUT/cases/NAME: months.tsv, months.sha256, print.tsv, print.sha256, moves.tsv, states/ and optionally root.txt and rule29.txt (the 29 rule is on).
# OUT/cases.tsv: name, accept|reject, Julia reason, Flix reason, independent reason (reasons empty for accept), expected receipt dir (or -).
using SHA
out=only(ARGS);mkpath(joinpath(out,"cases"))
const HERE=@__DIR__
const EV=joinpath(HERE,"evidence")
const PC=joinpath(EV,"print-c");const PB=joinpath(EV,"print-b");const R19=joinpath(EV,"root-2019");const COR=joinpath(EV,"best-effort-corner")
sha(s)=bytes2hex(sha256(codeunits(s)))
function fixture(name;list,ptext,chain,statesdir,root=nothing,rule29=false)
    d=joinpath(out,"cases",name);rm(d;recursive=true,force=true);mkpath(d)
    write(joinpath(d,"months.tsv"),list);write(joinpath(d,"months.sha256"),sha(list)*"\n")
    write(joinpath(d,"print.tsv"),ptext);write(joinpath(d,"print.sha256"),sha(ptext)*"\n")
    write(joinpath(d,"moves.tsv"),chain);cp(statesdir,joinpath(d,"states"))
    isnothing(root) || write(joinpath(d,"root.txt"),root*"\n")
    rule29 && write(joinpath(d,"rule29.txt"),"1\n")
end
cases=String[];add(name,kind,j="-",f="-",i="-";rec="-")=push!(cases,join((name,kind,j,f,i,rec),'\t'))
ptextC=read(joinpath(PC,"printing.tsv"),String);ptextB=read(joinpath(PB,"printing.tsv"),String)
A=joinpath(R19,"exact-2019-03");B=joinpath(R19,"best-effort-2026-02")
chA=read(joinpath(A,"moves.tsv"),String);chB=read(joinpath(B,"moves.tsv"),String);lA=read(joinpath(A,"months.tsv"),String);lB=read(joinpath(B,"months.tsv"),String)
# ---- positives ------------------------------------------------------------------------------------------------
fixture("exact-2019-03";list=lA,ptext=ptextC,chain=chA,statesdir=joinpath(A,"states"));add("exact-2019-03","accept";rec="exact-2019-03")
fixture("best-effort-2026-02";list=lB,ptext=ptextC,chain=chB,statesdir=joinpath(B,"states"),root="2019-01");add("best-effort-2026-02","accept";rec="best-effort-2026-02")
fixture("best-effort-2026-02-rule29";list=lB,ptext=ptextC,chain=chB,statesdir=joinpath(B,"states"),root="2019-01",rule29=true);add("best-effort-2026-02-rule29","accept")
# print B, February 2026, root 2026-05: the stored corner chains; (7,7) carries the 29, (7,1) the artwork 24 (rule off: accepted as before)
d71=joinpath(COR,"2026-02-71")
fixture("corner-2026-02-71";list=read(joinpath(d71,"months.tsv"),String),ptext=ptextB,chain=read(joinpath(d71,"moves.tsv"),String),statesdir=joinpath(d71,"states"),root="2026-05")
add("corner-2026-02-71","accept")
fixture("corner-2026-02-77-rule29";list=read(joinpath(COR,"2026-02-77","months.tsv"),String),ptext=ptextB,chain=read(joinpath(COR,"2026-02-77","moves.tsv"),String),statesdir=joinpath(COR,"2026-02-77","states"),root="2026-05",rule29=true)
add("corner-2026-02-77-rule29","accept")
# ---- negative controls ---------------------------------------------------------------------------------------
# the 29 rule: the same stored chain whose (7,1) shows the artwork 24 is refused once the rule is on
fixture("corner-2026-02-71-rule29";list=read(joinpath(COR,"2026-02-71","months.tsv"),String),ptext=ptextB,chain=read(joinpath(COR,"2026-02-71","moves.tsv"),String),statesdir=joinpath(COR,"2026-02-71","states"),root="2026-05",rule29=true)
add("corner-2026-02-71-rule29","reject","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29")
# wrong root: the record and the list say 2019-02 (S[1]) but the identity pose of print C shows January 2019
lines=split(chop(chA),'\n');e2=findfirst(l->startswith(l,"edge\t2019\t3\t"),lines);fin=findfirst(==("finish"),lines)
wr=join(vcat([lines[1],"source\t2\t2019\t2\t"*split(lines[2],'\t')[5]],lines[e2:fin]),"\n")*"\n"
st=mktempdir();cp(joinpath(A,"states","state-01.tsv"),joinpath(st,"state-01.tsv"));cp(joinpath(A,"states","state-03.tsv"),joinpath(st,"state-02.tsv"));cp(joinpath(A,"states","state-03.tsv"),joinpath(st,"state-03.tsv"))
fixture("wrong-root-2019-02";list="2019-02\n2019-03\n",ptext=ptextC,chain=wr,statesdir=st)
add("wrong-root-2019-02","reject","identity root front","identity root front","identity root front")
# wrong root record: the chain says 2019-02 but the environment root is the first member 2019-01
bad=replace(chA,"source\t1\t2019\t1\t"=>"source\t2\t2019\t2\t")
fixture("wrong-root-record";list=lA,ptext=ptextC,chain=bad,statesdir=joinpath(A,"states"))
add("wrong-root-record","reject","identity root record is the root month","identity root record is the root month","root record")
# wrong cell: an exact edge that declares a wrong cell (v2 header), and the best-effort edge whose declared cell (7,1) is changed to (7,7)
v2a=replace(replace(chA,"cubistry.calendar7.chain.v1"=>"cubistry.calendar7.chain.v2";count=1),"\nmove\t"=>"\nwrong\t7\t1\nmove\t";count=1)
fixture("wrong-cell-exact-edge";list=lA,ptext=ptextC,chain=v2a,statesdir=joinpath(A,"states"))
add("wrong-cell-exact-edge","reject","strict month front including band line","strict month front including band line","strict row-one-name front")
fixture("wrong-cell-best-effort";list=lB,ptext=ptextC,chain=replace(chB,"wrong\t7\t1"=>"wrong\t7\t7"),statesdir=joinpath(B,"states"),root="2019-01")
add("wrong-cell-best-effort","reject","strict month front including band line","strict month front including band line","strict row-one-name front")
# wrong print: print B under the pin of print C; and print C with the artwork of the front sticker of cell (1,1) changed, pinned by its own hash
fixture("wrong-print-b";list=lA,ptext=ptextB,chain=chA,statesdir=joinpath(A,"states"))
open(joinpath(out,"cases","wrong-print-b","print.sha256"),"w") do io;println(io,sha(ptextC));end
add("wrong-print-b","reject","new immutable print pin","new immutable print pin","new print pin")
s1=[split(l,'\t') for l in readlines(joinpath(A,"states","state-01.tsv"))[2:end]]
id=parse(Int,only(r for r in s1 if r[3]=="-3,3,3" && r[4]=="0,0,1")[1])
pl=readlines(joinpath(PC,"printing.tsv"));f=split(pl[id+1],'\t');f[6]=f[6]=="X" ? "Y" : "X";pl[id+1]=join(f,'\t')
fixture("wrong-print-edited";list=lA,ptext=join(pl,"\n")*"\n",chain=chA,statesdir=joinpath(A,"states"))
add("wrong-print-edited","reject","identity root front","identity root front","identity root front")
# the 29 rule on a state that is legal for a changed print: sticker 2 (the red 29 of the corner piece shown in (7,1) after the best-effort edge) gets another
# text or ink; the chain digests and state files are recomputed for that print, so only the rule can refuse the chain.
include(joinpath(HERE,"check.jl"))
function rebuild(ptext,chain)      # only the first edge (the best-effort edge into 2026-02) is kept
    chain=join(vcat(split(chop(chain),'\n')[1:findfirst(==("end"),split(chop(chain),'\n'))],["finish"]),"\n")*"\n"
    f=tempname();write(f,ptext);src=window_read_print(f);st=[(id=s.id,piece=s.piece,pos=s.home,normal=s.normal,up=s.up,text=s.text,ink=s.ink) for s in src]
    ls=split(chop(chain),'\n');states=[chain_state_text(st;header=true)];out=String[];i=1
    while i<=length(ls)
        l=ls[i];g=split(l,'\t')
        if g[1]=="source"
            g[5]=chain_digest(st);push!(out,join(g,'\t'))
        elseif g[1]=="edge"
            g[8]=chain_digest(st);j=i+1;while ls[j]!="end";g2=split(ls[j],'\t');g2[1]=="move" && (st=chain_move(st,parse(Int,g2[2]),parse(Int,g2[3])));j+=1;end
            g[9]=chain_digest(st);push!(out,join(g,'\t'));append!(out,ls[i+1:j]);push!(states,chain_state_text(st;header=true));i=j
        else
            push!(out,l)
        end
        i+=1
    end
    join(out,"\n")*"\n",states
end
function fixture_states(name,ptext,list,root,chain,states)
    sd=mktempdir();for (k,t) in enumerate(states);write(joinpath(sd,"state-"*lpad(k,2,'0')*".tsv"),t);end
    fixture(name;list=list,ptext=ptext,chain=chain,statesdir=sd,root=root,rule29=true)
end
function edit_sticker(id,field,value)
    pl=readlines(joinpath(PC,"printing.tsv"));f=split(pl[id+1],'\t');f[field]=value;pl[id+1]=join(f,'\t');join(pl,"\n")*"\n"
end
pt28=edit_sticker(2,6,"28");c,s=rebuild(pt28,chB);fixture_states("rule29-text-28",pt28,"2026-02\n","2019-01",c,s)
add("rule29-text-28","reject","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29")
pdk=edit_sticker(2,7,"dark");c,s=rebuild(pdk,chB);fixture_states("rule29-ink-dark",pdk,"2026-02\n","2019-01",c,s)
add("rule29-ink-dark","reject","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29","best-effort wrong cell shows the digit 29")
open(joinpath(out,"cases.tsv"),"w") do io;for c in cases;println(io,c);end;end
println("cases\t",length(cases))
