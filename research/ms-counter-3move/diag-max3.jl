# Generator-side diagnostic (not a proof): for one fixed print, the greatest
# fixed point of the 60-edge Post operator with the UNRESTRICTED radius-3 ball
# (all 3,136 group elements within 3 HTM), started from ALL full states that
# show L00. An empty fixed point means: on this print no run-in + period walk
# with every edge <= 3 HTM exists for letter L (any setup, any closure period).
# usage: julia diag-max3.jl PRINT (18 pool labels or 24 sticker labels)
include("pool.jl")
lab = length(ARGS[1]) == 18 ? poollab(collect(ARGS[1])) : collect(ARGS[1])
sh = showtable(mkprint(lab))
for L in "MS"
    Xs, depth, it, n0 = fixpoint(sh, L; maxit = 5000)
    println("$L start-states $n0 fixed-point-size $(length(Xs)) longest-prefix-edges $depth iterations $it")
end
