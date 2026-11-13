# Usage: julia summarize_transitions.jl VERIFY_OUTPUT.txt   (output of verify_transitions.jl on the one-year job list)
# Groups the planned transition costs by scheme and by kind of day change. Scheme W adds the word W when the target day is < 10.
function main(path)
    rows = Dict{Tuple{String,String},Vector{Tuple{Int,Int}}}()
    for l in eachline(path)
        m = match(r"^(\d+)->(\d+)\|([PUW])\|\S+ outer=(\d+) rot=(\d+)(?: \+W\(outer=(\d+),rot=(\d+)\))?", l)
        m === nothing && continue
        a, b = parse(Int, m[1]), parse(Int, m[2]); sch = m[3]
        o, r = parse(Int, m[4]), parse(Int, m[5])
        if sch == "W" && b < 10; o += 8; r += 1; end
        kind = b == 1 ? "to day 1 (month change)" : a < 9 ? "2..9 after 1..8" : a == 9 ? "9 -> 10" : "10..31 after 10..30"
        push!(get!(rows, (kind, sch), Tuple{Int,Int}[]), (o, r))
    end
    println("kind | scheme | pairs | mean outer HTM | max outer | mean rotations")
    for k in sort(unique(first.(keys(rows)))), s in ("P", "U", "W")
        v = rows[(k, s)]
        println(k, " | ", s, " | ", length(v), " | ", round(sum(first.(v)) / length(v); digits = 2), " | ", maximum(first.(v)), " | ", round(sum(last.(v)) / length(v); digits = 2))
    end
end
main(ARGS[1])
