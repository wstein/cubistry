# Exhaustive enumeration over the two stickers that R1's minutes period never
# shows (tokens 20 and 21 = H/S/M ids 19 and 20): each becomes H or M at the
# upper-right, a tens digit at lower-left or a units digit at lower-right.
# For every print with at least one H, the exact max-3 fixpoint decision for
# H 00..23 and H 00..11 (generator-side) is reported with its penalty.
include(joinpath(@__DIR__, "..", "fixpoint.jl"))
checktwist()
base = split(strip(read(ARGS[1], String)))
opts = vcat(["H2", "M2"], ["$(d)3" for d in 0:5], ["$(d)4" for d in 0:9])
for a in opts, b in opts
    (a == "H2" || b == "H2") || continue
    t = copy(base); t[20] = a; t[21] = b
    pr = Print([x[1] == '_' ? ' ' : x[1] for x in t], [parse(Int, x[2:end]) for x in t])
    sc, info = objH3(pr)
    println("$a\t$b\t$sc\t$info"); flush(stdout)
end
