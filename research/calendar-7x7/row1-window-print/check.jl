#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
include(joinpath(@__DIR__,"common.jl"))
try
    @assert length(ARGS)==3 "check.jl LAYOUT_TSV PRINT_TSV FRONT_MATCHES_TSV"
    window_match_check(ARGS...)
catch e
    println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
end
