#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Opt-in raw witness mutations. No verifier or proof decision is implemented here.
@assert length(ARGS)==4 && ARGS[1]=="--mutations" "negative_cases.jl --mutations PRINT MATCHES OUT"
print_path,matches_path,out=ARGS[2:4];mkpath(out)
original_print=readlines(print_path);original_matches=readlines(matches_path)
fs(s)=String.(split(s,'\t';keepempty=true))
write_lines(path,rows)=write(path,join(rows,'\n')*"\n")
function fixture(name,mutate_print,mutate_matches,jreason,freason)
    p=copy(original_print);m=copy(original_matches)
    mutate_print(p);mutate_matches(m)
    write_lines(joinpath(out,name*".print.tsv"),p)
    write_lines(joinpath(out,name*".matches.tsv"),m)
    println(name,'\t',jreason,'\t',freason)
end
noop(_)=nothing
band_index=only(findall(s->begin f=fs(s);length(f)==7 && f[3]=="3,3,3" && f[4]=="0,0,1" end,original_print))
@assert fs(original_print[band_index])[6:7]==["","band"]
vec(s)=parse.(Int,split(s,','))
used=Set{Int}()
for line in original_matches[2:end]
    f=fs(line);pid=parse(Int,f[6]);images=vec.(f[7:9])
    for row in original_print[2:end]
        p=fs(row);p[2]==string(pid) || continue
        n=vec(p[4]);rotated=n[1].*images[1]+n[2].*images[2]+n[3].*images[3]
        rotated==[0,0,1] && push!(used,parse(Int,p[1]))
    end
end
unused=first(i for i in 1:294 if !(i in used))
function field!(rows,i,field,value)
    f=fs(rows[i]);f[field]=value;rows[i]=join(f,'\t')
end
open(joinpath(out,"cases.tsv"),"w") do io
    redirect_stdout(io) do
        println("case\tjulia-reason\tflix-reason")
        fixture("band-quarter-turn",p->field!(p,band_index,5,"-1,0,0"),noop,"exact upright front artwork","exact upright front artwork")
        fixture("band-as-blank",p->field!(p,band_index,7,"blank"),noop,"exact upright front artwork","exact upright front artwork")
        fixture("nonaxis-up",p->field!(p,band_index,5,"65536,1,0"),noop,"axis-aligned tangent print up","axis-aligned tangent print up")
        fixture("unknown-empty-ink",p->field!(p,band_index,7,"month"),noop,"print text/ink profile","print text/ink profile")
        fixture("surface-piece-reassigned",p->field!(p,2,2,"2"),noop,"fixed physical surface geometry and identity","fixed physical surface geometry and identity")
        fixture("missing-back-surface",p->deleteat!(p,2),noop,"294-surface print header","294 fixed print surfaces")
        fixture("missing-match",noop,m->pop!(m),"21 complete front matches","21 complete front matches")
        fixture("reflected-body",noop,m->field!(m,2,7,"-1,0,0"),"one proper rigid body rotation","one proper rigid body rotation")
        fixture("wrong-target-date",noop,m->field!(m,2,2,"2027"),"match ordering and target date","match ordering and target date")
        fixture("letter-zero-alias",p->begin
            hits=0
            for i in 2:length(p)
                f=fs(p[i]);if f[6]=="OC" && f[7]=="month";f[6]="0C";p[i]=join(f,'\t');hits+=1;end
            end
            @assert hits>0
        end,noop,"exact upright front artwork","exact upright front artwork")
        fixture("weekday-digit-alias",p->begin
            hits=0
            for i in 2:length(p)
                f=fs(p[i]);if f[6]=="FRI" && f[7]=="weekday";f[6]="FR1";p[i]=join(f,'\t');hits+=1;end
            end
            @assert hits>0
        end,noop,"exact upright front artwork","exact upright front artwork")
        fixture("duplicate-body",p->begin
            i=only(findall(s->begin f=fs(s);length(f)==7 && f[3]=="-3,3,3" && f[4]=="0,1,0" end,p))
            f=fs(p[i]);f[5]="0,0,1";f[6]="";f[7]="band";p[i]=join(f,'\t')
        end,m->begin
            root_ma=fs(m[2])[6]
            f=fs(m[8]);f[6]=root_ma;f[7]="-1,0,0";f[8]="0,0,1";f[9]="0,1,0";m[8]=join(f,'\t')
        end,"one distinct physical body per front cell","one distinct physical body per front cell")
        fixture("print-crlf",noop,noop,"canonical print TSV","CR forbidden")
        fixture("matches-crlf",noop,noop,"canonical match TSV","CR forbidden")
        fixture("unused-invalid-utf8",p->begin
            f=fs(p[unused+1]);f[6]=String(UInt8[0xff]);f[7]="month";p[unused+1]=join(f,'\t')
        end,noop,"canonical print TSV","Input length")
    end
end
for (name,kind) in [("print-crlf","print"),("matches-crlf","matches")]
    path=joinpath(out,name*"."*kind*".tsv");write(path,replace(read(path,String),"\n"=>"\r\n"))
end
# Positive physical twin control: a 9 turned by half a turn still shows the same 6.
p=copy(original_print)
i=only(findall(s->begin f=fs(s);length(f)==7 && f[3]=="0,0,3" && f[4]=="0,0,1" end,p))
f=fs(p[i]);@assert f[6]=="6";f[5]="0,-1,0";f[6]="9";p[i]=join(f,'\t')
write_lines(joinpath(out,"six-nine-twin.print.tsv"),p)
write_lines(joinpath(out,"six-nine-twin.matches.tsv"),original_matches)
println("raw negative cases: 15; positive six-nine twin: 1")
