#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Writes evidence/reroot-measure/edges-selected.tsv: the ten edges of the re-root measurement (rule: reroot_measure_lib.jl, select_edges).
#   julia --startup-file=no select_edges.jl            (prints the table; with WRITE=1 it writes the file)
include(joinpath(@__DIR__,"reroot_measure_lib.jl"));using .RerootMeasure
const EV=joinpath(@__DIR__,"evidence","reroot-measure")
const MEASURED=[3,4,27,28,46,52,71,150,158]   # the nine edges of the first measurement (2019-03 2019-04 2021-03 2021-04 2022-10 2023-04 2024-11 2031-06 2032-02)
E=RerootMeasure.read_chain_edges(read(joinpath(EV,"chain-2019-01-2036-01.moves.tsv"),String))
sel=RerootMeasure.select_edges(RerootMeasure.read_stage_table(joinpath(EV,"edges-stage5.tsv")),E,MEASURED;n=10)
out="id\tmonth\thtm\tmethod\trotations\n"*join((join((s.id,s.month,s.htm,s.method,s.rotations),'\t') for s in sel),'\n')*"\n"
print(out)
get(ENV,"WRITE","")=="1" && write(joinpath(EV,"edges-selected.tsv"),out)
