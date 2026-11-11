#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# identity_front.jl LAYOUT PRINT : which months 2026-01 .. 2050-01 does the identity (solved) front of a print display?
# The chain root is the identity pose, so a chain can only start at a month listed here.
include(joinpath(@__DIR__,"..","..","..","row1-window-print","common.jl"))
labels=coupled_labels(read(ARGS[1],String));source=window_read_print(ARGS[2])
state=[(pos=s.home,normal=s.normal,up=s.up,text=s.text,ink=s.ink) for s in source]
function front_ok(board)
    for r in 1:7,c in 1:7
        ss=filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state);length(ss)==1 || return false
        s=only(ss);a=findfirst(==(s.up),IMAGE_UPS);isnothing(a) && return false
        coupled_optic(s.text,a-1,s.ink)==coupled_optic(board[r,c][1],0,board[r,c][2]) || return false
    end
    true
end
hits=String[]
for y in 2026:2050,m in 1:12
    (y,m)>(2050,1) && break
    b=stacked_board(y,m,PURE_VARIANT)
    for c in 1:7;t=labels[m][c];b[1,c]=(t,isempty(t) ? "band" : "month");end
    front_ok(b) && push!(hits,string(y,'-',lpad(m,2,'0')))
end
println(basename(dirname(abspath(ARGS[2]))),'/',basename(ARGS[2]),"\tidentity front shows\t",join(hits,","))
