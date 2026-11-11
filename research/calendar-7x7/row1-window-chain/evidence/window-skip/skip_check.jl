#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# skip_check.jl lemma LAYOUT_TSV            (reads WINDOW_MONTHS)
# skip_check.jl print LAYOUT_TSV PRINT_TSV FRONT_MATCHES_TSV  (reads WINDOW_MONTHS)
include(joinpath(@__DIR__,"months.jl"))
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert !isempty(get(ENV,"WINDOW_MONTHS","")) "WINDOW_MONTHS is required"
        if ARGS[1]=="lemma" && length(ARGS)==2
            coupled_check(ARGS[2],"names-band","window")
        elseif ARGS[1]=="print" && length(ARGS)==4
            window_match_check(ARGS[2:4]...)
        else
            error("usage: skip_check.jl lemma LAYOUT | print LAYOUT PRINT MATCHES")
        end
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
