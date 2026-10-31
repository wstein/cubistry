# Convert an M/S witness (cubistry.ms-counter.v1) into (a) this folder's print
# tokens with a letter map and (b) a routes file of its up runs.
# usage: julia msconvert.jl WITNESS MAP(e.g. "M=M,S=H") PRINT_OUT ROUTES_OUT
include(joinpath(@__DIR__, "..", "engine.jl"))
function main(path, mapstr, pout, rout)
    lmap = Dict(Char(p[1]) => Char(p[3]) for p in split(mapstr, ','))
    toks = fill("", 24)
    runs = Tuple{Char,String,Int,Vector{String}}[]
    for line in eachline(path)
        f = split(line, '\t')
        if f[1] == "sticker"
            p = Tuple(parse.(Int, split(f[4], ','))); n = parse.(Int, split(f[5], ','))
            up = parse.(Int, split(f[6], ',')); g = f[7][1]
            sid = 3 * (posindex(p) - 1) + findfirst(!=(0), n)
            if g == '_'
                toks[sid] = "_0"; continue
            end
            r = findfirst(m -> m * n == [0, 0, 1] && m * up == [0, 1, 0], ROT)
            cell = findfirst(==(mulv(ROT[r], p)), CELLPOS)
            g in "MS" && (cell == 2 || error("letter not at upper-right"))
            g = get(lmap, g, g)
            toks[sid] = string(g, cell)
        elseif f[1] == "run"
            push!(runs, (lmap[f[2][1]], f[4], parse(Int, f[6]), String[]))
        elseif f[1] == "edge"
            push!(runs[end][4], f[6])
        end
    end
    all(!isempty, toks) || error("incomplete print")
    write(pout, join(toks, " ") * "\n")
    open(rout, "w") do io
        for (L, setup, k, words) in runs
            println(io, "mode\t$L\t59\t$setup\t0\t$(length(words))\t$(length(words))")
            for (j, w) in enumerate(words)
                println(io, "step\t$((j - 1) % 60)\t$(j % 60)\t$w")
            end
        end
    end
end
main(ARGS...)
