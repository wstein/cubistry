# Exact per-print max-3 statement (search side, Julia): two-lap propagation over ALL legal
# full states showing value 0 with words <= 3 HTM. A lap-1 death means no route with every
# edge <= 3 exists at all; a lap-2 death means no CLOSED (repeatable) cycle exists.
# Usage: julia exact_report.jl LABELS
include(joinpath(@__DIR__, "c99_reach.jl"))
W = buildwords(3)
lab = parse.(Int, split(ARGS[1], ","))
for m in (:lz, :nz)
    r = floor(Int, reach(W, lab, m, 3))
    println("exact_k3\t", m, "\tstart_states\t", length(allstates(lab, 0, m)), "\tsurvives_layers\t", r - 1,
            "\t", r <= 100 ? "NO_ROUTE_ALL_EDGES_LE_3" : r <= 200 ? "NO_CLOSED_CYCLE_ALL_EDGES_LE_3" : "TWO_LAPS_SURVIVE")
end
