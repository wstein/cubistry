# Convert the H/S/M seconds-first print (origin/main
# data/hsm/seconds-first/modes/witness.json, flattened with
#   jq -r '.printing[] | [.id,.cubie,(.p|join(",")),(.n|join(",")),(.up|join(",")),
#          (if .image=="" or .image==" " or .image==null then "_" else .image end),.slot] | @tsv'
# ) into this folder's print format: 24 tokens <glyph><cell>, token i is the
# sticker of corner posindex(p) with home-normal axis a. The cell is derived
# from the printed up vector (not from the slot field, which is only
# cross-checked). The five letter stickers (ids 10, 14, 18, 19, 20 = S, S, S,
# H, M) are relabeled by a 5-character string in id order; SSSHM keeps them.
# usage: julia hmsconvert.jl FLAT.tsv LETTERS(e.g. SSSHM or MMMHH) > print.txt
include(joinpath(@__DIR__, "..", "engine.jl"))

function convert(path, srep)
    toks = fill("", 24); k = 0
    for line in eachline(path)
        f = split(line, '\t')
        p = Tuple(parse.(Int, split(f[3], ','))); n = parse.(Int, split(f[4], ','))
        up = parse.(Int, split(f[5], ',')); g = f[6]; slot = parse(Int, f[7])
        c = posindex(p); a = findfirst(!=(0), n)
        sid = 3 * (c - 1) + a
        if g == "_"
            slot == 0 || error("blank slot")
            toks[sid] = "_0"; continue
        end
        r = findfirst(m -> m * n == [0, 0, 1] && m * up == [0, 1, 0], ROT)
        cell = findfirst(==(mulv(ROT[r], p)), CELLPOS)
        cell == (slot == 1 ? 2 : slot == 2 ? 3 : 4) || error("slot/up mismatch at sticker $(f[1])")
        if g in ("S", "H", "M")
            k += 1; g = string(srep[k])   # letter stickers in id order
        end
        toks[sid] = g * string(cell)
    end
    all(!isempty, toks) || error("incomplete")
    join(toks, " ")
end
println(convert(ARGS[1], ARGS[2]))
