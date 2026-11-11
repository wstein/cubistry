#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Month-configuration table (Julia only, not Flix-confirmed, so every statement is UNKNOWN as evidence).
# A month board depends only on (month, weekday of the 1st, month length): 91 configurations. This file derives them
# from the repository code (stacked_board with PURE_VARIANT plus the month-name band row of the layout), decides
# fixed-print rigid front matching per configuration for two prints, and writes the committed tables.
# Usage (run from research/calendar-7x7):
#   julia --startup-file=no row1-window-chain/evidence/config-coverage/config_table.jl write OUTDIR
include(joinpath(@__DIR__,"..","window-skip","months.jl"))
using Dates
const CAL=normpath(joinpath(@__DIR__,"..","..",".."))
const LAYOUT=joinpath(CAL,"row1-revision","layout.tsv")
const PRINT_B=joinpath(CAL,"row1-window-chain","evidence","window-skip","printing-S2.tsv")
const PRINT_C=joinpath(@__DIR__,"printing-C.tsv")
const PRINT_OLD=joinpath(CAL,"row1-window-chain","evidence","window-2037-01","printing.tsv")
module ConfigTable
using Dates,SHA
import ..coupled_labels,..stacked_board,..PURE_VARIANT,..window_read_print,..window_piece_options,..all_homes,..bodykey,..rotate,..ROTATIONS
import ..corner_demand
const WD=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"]
ckey(y,m)=(m,Dates.dayofweek(Date(y,m,1)),Dates.daysinmonth(Date(y,m,1)))
ymstr(y,m)=string(y,'-',lpad(m,2,'0'))
function board_of(labels,y,m)
    b=stacked_board(y,m,PURE_VARIANT)
    for c in 1:7;t=labels[m][c];b[1,c]=(t,isempty(t) ? "band" : "month");end
    b
end
bsig(b)=join(string.(b),"|")
byid(cs,m,wd,n)=only(c for c in cs if (c.month,c.weekday,c.length)==(m,wd,n))
config_of(cs,y,m)=only(c for c in cs if (c.month,c.weekday,c.length)==ckey(y,m))
years(c,y1,y2)=[y for y in y1:y2 if ckey(y,c.month)==(c.month,c.weekday,c.length)]
# Gregorian cycle: 400 consecutive years 2026..2425; every board equals the board of its configuration
function cycle_facts(labels,cs)
    reps=Dict((c.month,c.weekday,c.length)=>bsig(c.board) for c in cs)
    seen=Set{Tuple{Int,Int,Int}}();board_mismatch=0;months=0
    for y in 2026:2425,m in 1:12
        k=ckey(y,m);months+=1;push!(seen,k)
        bsig(board_of(labels,y,m))==get(reps,k,"") || (board_mismatch+=1)
    end
    shift=0
    for y in 1900:2200,m in 1:12;ckey(y,m)==ckey(y+400,m) || (shift+=1);end
    miss=length(setdiff(Set((c.month,c.weekday,c.length) for c in cs),Set(ckey(y,m) for y in 2026:2099 for m in 1:12)))
    (;months,configs=length(seen),board_mismatch,shift_mismatch=shift,first_missing_2026_2099=miss)
end
function match_config(source,board)
    homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
    answer=Dict{Tuple{Int,Int},Tuple{Int,Any}}();unmatched=Any[];hall=(0,0);zero=Any[]
    for key in sort!(unique(bodykey(h) for h in homes))
        hs=[h for h in homes if bodykey(h)==key]
        cells=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==key]
        options=[[window_piece_options(byhome[h],h,(c-4,4-r,3),board[r,c]) for h in hs] for (r,c) in cells]
        owner=zeros(Int,length(hs))
        function augment(slot,seen)
            for j in eachindex(hs)
                (seen[j] || isempty(options[slot][j])) && continue
                seen[j]=true
                if owner[j]==0 || augment(owner[j],seen);owner[j]=slot;return true;end
            end
            false
        end
        for i in eachindex(cells)
            all(isempty,options[i]) && push!(zero,cells[i])
            seen=falses(length(hs))
            if !augment(i,seen)
                push!(unmatched,(cells[i],key))
                # Hall violator: the failed cell and the owners of every body reached; their bodies are the neighbors
                xs=sort!(unique(vcat([i],[owner[j] for j in eachindex(hs) if seen[j] && owner[j]!=0])))
                hall==(0,0) && (hall=(length(xs),count(seen)))
            end
        end
        for j in eachindex(hs)
            owner[j]==0 && continue
            i=owner[j];answer[cells[i]]=(findfirst(==(hs[j]),homes),first(options[i][j]))
        end
    end
    (;answer,unmatched,zero,hall)
end
function result_of(source,board)
    r=match_config(source,board)
    isempty(r.unmatched) && return (;status="SAT",unmatched="",answer=r.answer,hall_cells=0,hall_bodies=0)
    (rc,key)=r.unmatched[1];art=board[rc...]
    desc=string("cell(",rc[1],',',rc[2],") art=",art[1],':',art[2]," body-class=(",join(key,','),")",
        r.unmatched[1][1] in r.zero ? " zero-options" : "",
        " hall-violator=",r.hall[1]," cells for ",r.hall[2]," bodies",length(r.unmatched)>1 ? string(" +",length(r.unmatched)-1," more unmatched") : "")
    (;status="NOMATCH",unmatched=desc,answer=r.answer,hall_cells=r.hall[1],hall_bodies=r.hall[2])
end
function matches_tsv(cs,res)
    io=IOBuffer();println(io,"target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image")
    homes=all_homes();id=0
    for c in cs
        r=res[(c.month,c.weekday,c.length)];r.status=="SAT" || continue
        id+=1
        for rr in 1:7,cc in 1:7
            pid,rot=r.answer[(rr,cc)]
            println(io,join((id,c.rep[1],c.rep[2],rr,cc,pid,join(rotate((1,0,0),rot),','),join(rotate((0,1,0),rot),','),join(rotate((0,0,1),rot),',')),'\t'))
        end
    end
    String(take!(io))
end
function build(layout,printB,printOld,printC)
    labels=coupled_labels(read(layout,String));srcB=window_read_print(printB);srcOld=window_read_print(printOld);srcC=window_read_print(printC)
    seen=Dict{Tuple{Int,Int,Int},Any}()
    for y in 2026:2099,m in 1:12;k=ckey(y,m);haskey(seen,k) || (seen[k]=(y,m));end
    cs=[(;month=k[1],weekday=k[2],length=k[3],rep=seen[k],board=board_of(labels,seen[k]...)) for k in sort!(collect(keys(seen)))]
    cs=[merge(c,(;id=i)) for (i,c) in enumerate(cs)]
    resB=Dict((c.month,c.weekday,c.length)=>result_of(srcB,c.board) for c in cs)
    resO=Dict((c.month,c.weekday,c.length)=>result_of(srcOld,c.board) for c in cs)
    resC=Dict((c.month,c.weekday,c.length)=>result_of(srcC,c.board) for c in cs)
    result(nm,c)=(nm=="B" ? resB : nm=="C" ? resC : resO)[(c.month,c.weekday,c.length)]
    cyc=cycle_facts(labels,cs)
    io=IOBuffer()
    println(io,"config\tmonth\tmonth_name\tweekday_of_1st\tlength\tfirst_rep_month\tboard_sha256\tyears_2026_2100\tyears_1900_2200\tB_status\tB_unmatched\told_status\told_unmatched\tC_status\tC_unmatched")
    for c in cs
        b,o,cc=result("B",c),result("old",c),result("C",c)
        y1=years(c,2026,2100);c.month==1 || (y1=[y for y in y1 if y<=2099]) # 2100-01 is the last month of the range; later months of 2100 are out
        println(io,join((c.id,c.month,MN[c.month],WD[c.weekday],c.length,ymstr(c.rep...),bytes2hex(sha256(bsig(c.board))),
            join(y1,','),join(years(c,1900,2200),','),b.status,b.unmatched,o.status,o.unmatched,cc.status,cc.unmatched),'\t'))
    end
    table=String(take!(io))
    println(io,"print\tconfig\tmonth_name\tweekday_of_1st\tlength\tdates_2026-01_to_2100-01\tcount\tunmatched")
    for (nm,lab) in (("B","B"),("old","old"),("C","C")),c in cs
        r=result(nm,c);r.status=="SAT" && continue
        ds=[ymstr(y,c.month) for y in years(c,2026,2100) if (y,c.month)<=(2100,1)]
        println(io,join((lab,c.id,MN[c.month],WD[c.weekday],c.length,join(ds,','),length(ds),r.unmatched),'\t'))
    end
    failing=String(take!(io))
    # corner lemma over configuration sets (months.jl corner_demand on one representative month per configuration)
    repsof(f)=[c.rep for c in cs if f(c)]
    setB=repsof(c->result("B",c).status=="SAT");setO=repsof(c->result("old",c).status=="SAT")
    dsum(ms)=(d=corner_demand(labels,ms);(;n=length(ms),demand=d.required,blank=d.blank,lemma=d.lemma))
    all91=dsum([c.rep for c in cs]);BS=dsum(setB);OS=dsum(setO)
    rows=[]
    for c in cs
        db=dsum(vcat(setB,c.rep in setB ? [] : [c.rep]));do_=dsum(vcat(setO,c.rep in setO ? [] : [c.rep]))
        push!(rows,(;id=c.id,month=c.month,weekday=c.weekday,length=c.length,B_status=result("B",c).status,B_demand=db.demand,B_blank=db.blank,B_lemma=db.lemma,
            old_status=result("old",c).status,old_demand=do_.demand,old_blank=do_.blank,old_lemma=do_.lemma))
    end
    io=IOBuffer()
    println(io,"# corner demand (months.jl corner_demand) of a set of configurations, one representative month each; lemma = UNSAT as coded, else UNKNOWN. Julia only.")
    println(io,"set\tconfigs\tdemand\tblank_peak\tlemma")
    for (nm,s) in (("all-91",all91),("B-matchable",BS),("old-matchable",OS))
        println(io,join((nm,s.n,s.demand,s.blank,s.lemma ? "UNSAT" : "UNKNOWN"),'\t'))
    end
    println(io,"config\tmonth_name\tweekday_of_1st\tlength\tB_status\tB_set_plus_config_demand\tB_blank_peak\tB_lemma\told_status\told_set_plus_config_demand\told_blank_peak\told_lemma")
    for r in rows
        println(io,join((r.id,MN[r.month],WD[r.weekday],r.length,r.B_status,r.B_demand,r.B_blank,r.B_lemma ? "UNSAT" : "UNKNOWN",r.old_status,r.old_demand,r.old_blank,r.old_lemma ? "UNSAT" : "UNKNOWN"),'\t'))
    end
    # single-drop test: remove one matchable configuration from the set, add every non-matchable one; necessary condition only
    println(io,"# single drops: for a non-matchable configuration f whose addition raises the demand of the matchable set above 23, remove one matchable configuration x and add f; necessary condition only")
    println(io,"drop_print\tnon_matchable_config\tdemand_set_plus_config\tdrops_with_demand_le_23\tconfigs")
    for (nm,set) in (("B",setB),("old",setO)),f in cs
        result(nm,f).status=="SAT" && continue
        d0=dsum(vcat(set,[f.rep]))
        if d0.demand<=23 && !d0.lemma
            println(io,join((nm,f.id,d0.demand,"not applicable (config does not raise the demand)",""),"\t"));continue
        end
        ok=[x for x in cs if x.rep in set && (d=dsum(vcat([r for r in set if r!=x.rep],[f.rep]));d.demand<=23 && !d.lemma)]
        println(io,join((nm,f.id,d0.demand,length(ok),join([x.id for x in ok],",")),"\t"))
    end
    lemma_tsv=String(take!(io))
    cyc_txt=string("Gregorian 400-year check (Julia only)\n",
        "months 2026-01..2425-12\t",cyc.months,"\n","distinct configurations in the cycle\t",cyc.configs,"\n",
        "months whose board differs from the board of their configuration\t",cyc.board_mismatch,"\n",
        "years 1900..2200 with config(y,m) != config(y+400,m)\t",cyc.shift_mismatch,"\n",
        "configurations missing in 2026..2099\t",cyc.first_missing_2026_2099,"\n")
    # chain size for print B: members are all months of the range except the months of non-matchable configurations
badk=Set((c.month,c.weekday,c.length) for c in cs if result("B",c).status!="SAT")
io=IOBuffer();println(io,"range\tcalendar_months\tchain_members\tedges\tdistinct_consecutive_config_pairs")
for (a,b) in (((2026,1),(2050,1)),((2026,5),(2050,1)),((2026,1),(2100,1)))
    seq=Tuple{Int,Int}[];y,m=a
    while (y,m)<=b;ckey(y,m) in badk || push!(seq,(y,m));m+=1;m==13 && (y+=1;m=1);end
    n=length(a[1]*12+a[2]:b[1]*12+b[2])
    pairs=Set((ckey(seq[i]...),ckey(seq[i+1]...)) for i in 1:length(seq)-1)
    println(io,join((string(ymstr(a...),"..",ymstr(b...)),n,length(seq),length(seq)-1,length(pairs)),'\t'))
end
chain_tsv=String(take!(io))
(;configs=cs,chain_tsv,labels,srcB,srcOld,srcC,result,table_tsv=table,failing_tsv=failing,matches_B=matches_tsv(cs,Dict(k=>v for (k,v) in resB)),
      matches_old=matches_tsv(cs,Dict(k=>v for (k,v) in resO)),matches_C=matches_tsv(cs,Dict(k=>v for (k,v) in resC)),lemma_tsv,lemma=(;B_set=BS,old_set=OS,all91,rows),cycle=cyc,cycle_txt=cyc_txt,
      years,byid,config_of)
end
end # module
using .ConfigTable
if abspath(PROGRAM_FILE)==(@__FILE__) && length(ARGS)==2 && ARGS[1]=="write"
    T=ConfigTable.build(LAYOUT,PRINT_B,PRINT_OLD,PRINT_C);out=ARGS[2];mkpath(out)
    for (n,s) in (("config-table.tsv",T.table_tsv),("failing-dates.tsv",T.failing_tsv),("front-matches-config-B.tsv",T.matches_B),
                  ("front-matches-config-old.tsv",T.matches_old),("front-matches-config-C.tsv",T.matches_C),("lemma-config.tsv",T.lemma_tsv),("gregorian-400.txt",T.cycle_txt),("chain-size.tsv",T.chain_tsv))
        write(joinpath(out,n),s)
    end
end
