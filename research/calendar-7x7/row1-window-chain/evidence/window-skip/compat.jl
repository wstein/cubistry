#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# compat.jl LAYOUT OLD_PRINT OLD_MATCHES NEW_PRINT  (WINDOW_MONTHS = the months of OLD_MATCHES)
# Prints: changed surfaces (class differs), how many of them are fronts in OLD_MATCHES, and the months
# whose OLD_MATCHES rows no longer show the required front artwork on NEW_PRINT. Julia only.
include(joinpath(@__DIR__,"months.jl"))
function compat(layout,oldp,oldm,newp)
    labels=coupled_labels(read(layout,String));goals=coupled_goals(labels,"names-band","window")
    old=window_read_print(oldp);new=window_read_print(newp)
    cl(s)=window_surface_class(s)[2]
    changed=[(o.home,o.normal) for (o,n) in zip(old,new) if cl(o)!=cl(n)]
    # exact sticker (text,ink,up) differences
    rawdiff=count(((o,n),)->(o.text,o.ink,o.up)!=(n.text,n.ink,n.up),zip(old,new))
    rows=readlines(oldm)[2:end];homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,new) for h in homes)
    pv(s)=tuple((parse(Int,v) for v in split(s,','))...)
    visch=Set{Tuple}();bad=Dict{Tuple{Int,Int},Int}()
    for (i,g) in enumerate(goals),r in 1:7,c in 1:7
        f=split(rows[(i-1)*49+(r-1)*7+c],'\t');b=tuple((pv(s) for s in f[7:9])...)
        rot=only(filter(q->(rotate((1,0,0),q),rotate((0,1,0),q),rotate((0,0,1),q))==b,ROTATIONS))
        fr=only(filter(s->rotate(s.normal,rot)==FRONT_NORMAL,byhome[homes[parse(Int,f[6])]]))
        (fr.home,fr.normal) in changed && push!(visch,(fr.home,fr.normal))
        a=only(findall(==(rotate(fr.up,rot)),IMAGE_UPS))-1
        coupled_optic(fr.text,a,fr.ink)==coupled_optic(g.board[r,c][1],0,g.board[r,c][2]) || (bad[(g.year,g.month)]=get(bad,(g.year,g.month),0)+1)
    end
    println("changed_surface_classes\t",length(changed),"\tsticker_rows_changed\t",rawdiff,"\tchanged_surfaces_visible_in_old_matches\t",length(visch))
    println("months_with_old_match_broken\t",length(bad),"\tof\t",length(goals))
    for k in sort!(collect(keys(bad)));println("broken\t",k[1],'-',lpad(k[2],2,'0'),'\t',bad[k]);end
end
compat(ARGS...)
