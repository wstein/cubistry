# Search-side per-print max-3 computation (Julia): two-lap propagation over ALL legal full
# states showing value 0 with words <= 3 HTM. A lap-1 death means the computation finds no
# route with every edge <= 3; a lap-2 death means it finds no CLOSED (repeatable) cycle.
# No native checker confirms this; max 3 stays UNKNOWN.
# Usage: julia exact_report.jl LABELS
include(joinpath(@__DIR__, "c99_reach.jl"))
W = buildwords(3)
lab = parse.(Int, split(ARGS[1], ","))
for m in (:lz, :nz)
    r = floor(Int, reach(W, lab, m, 3))
    println("exact_k3\t", m, "\tstart_states\t", length(allstates(lab, 0, m)), "\tsurvives_layers\t", r - 1,
            "\t", r <= 100 ? "SEARCH_FOUND_NO_ROUTE_ALL_EDGES_LE_3_UNCHECKED" : r <= 200 ? "SEARCH_FOUND_NO_CLOSED_CYCLE_ALL_EDGES_LE_3_UNCHECKED" : "SEARCH_TWO_LAPS_SURVIVE_UNCHECKED")
end
