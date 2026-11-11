#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# make_matches.jl LAYOUT PRINT MATCHES_OUT   (reads CAL7_WINDOW_MONTHS and CAL7_WINDOW_MONTHS_SHA256)
# UNTRUSTED witness generator: one whole-body front matching per month of the list. Both checkers verify the output.
include(joinpath(@__DIR__,"..","..","..","row1-window-print","common.jl"))
layout,print_path,out=ARGS
goals=coupled_goals(coupled_labels(read(layout,String)),"names-band","window")
source=window_read_print(print_path);homes=all_homes()
open(out,"w") do io
    println(io,"target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image")
    for (id,g) in enumerate(goals)
        matches=window_match(source,g.board)
        for r in 1:7,c in 1:7
            pid,rot=matches[(r,c)]
            println(io,join((id,g.year,g.month,r,c,pid,join(rotate((1,0,0),rot),','),join(rotate((0,1,0),rot),','),join(rotate((0,0,1),rot),',')),'\t'))
        end
    end
end
