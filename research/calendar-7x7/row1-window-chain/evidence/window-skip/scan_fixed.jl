#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# scan_fixed.jl LAYOUT PRINT FIRST LAST: for each month in [FIRST,LAST] (YYYY-MM), alone:
# month  corner_demand_of_base+month  lemma(base+month)  fixed_print_front_match(month)
# BASE_MONTHS env = comma list (the base target set). Julia only.
include(joinpath(@__DIR__,"months.jl"))
layout,printp,first_,last_=ARGS
labels=coupled_labels(read(layout,String));source=window_read_print(printp)
base=parse_months(ENV["BASE_MONTHS"])
function scan(y,m,ly,lm)
println("month\tbase_n\tdemand\tblank_peak\tlemma\tfront_match")
while (y,m)<=(ly,lm)
    d=corner_demand(labels,vcat(base,[(y,m)]))
    board=stacked_board(y,m,PURE_VARIANT)
    for c in 1:7;t=labels[m][c];board[1,c]=(t,isempty(t) ? "band" : "month");end
    ok=try;window_match(source,board);true;catch e;e isa AssertionError ? false : rethrow();end
    println(y,'-',lpad(m,2,'0'),'\t',length(base),'\t',d.required,'\t',d.blank,'\t',d.lemma ? "UNSAT" : "UNKNOWN",'\t',ok ? "MATCH" : "NOMATCH");flush(stdout)
    m+=1;m==13 && (y+=1;m=1)
end
end
scan(parse.(Int,split(first_,'-'))...,parse.(Int,split(last_,'-'))...)
