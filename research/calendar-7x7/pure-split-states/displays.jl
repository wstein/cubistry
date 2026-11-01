#!/usr/bin/env julia
# Descriptive listing, not a proof: the front displays of one year for the pure split
# with month-letter scheme A, for drawing month sheets. Cells: text and ink, '.' blank.
include(joinpath(@__DIR__,"pure_common.jl"))
year=parse(Int,ARGS[1])
println("# descriptive listing, not a proof; layout ",PURE_VARIANT,"; cell = text ink, '.' = blank")
println("year\tmonth\trow\tc1\tc2\tc3\tc4\tc5\tc6\tc7")
for m in 1:12
    b=stacked_board(year,m,PURE_VARIANT)
    for r in 1:7
        println(year,'\t',m,'\t',r,'\t',join([isempty(b[r,c][1]) ? "." : b[r,c][1]*" "*b[r,c][2] for c in 1:7],'\t'))
    end
end
