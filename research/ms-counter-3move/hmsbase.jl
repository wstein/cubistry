# Converts the H/S/M seconds-first print (origin/main
# data/hsm/seconds-first/modes/witness.json, field "printing", extracted to a
# whitespace table "id p n up slot image", image "_" = blank) into a 24-label M/S print and
# scores it with the same layered-graph value iteration (generator side only).
# H stickers become 'X' (printed, never matches a display) unless a
# replacement label is given.
include("fullvi.jl")
function hmslabels(path; hrepl = 'X')
    lab = fill('?', 24)
    for ln in eachline(path)
        f = split(ln, ' ')
        id = parse(Int, f[1]); p = parse.(Int, split(f[2], ',')); n = parse.(Int, split(f[3], ','))
        u = parse.(Int, split(f[4], ',')); slot = parse(Int, f[5]); img = length(f) >= 6 && f[6] != "_" ? f[6] : ""   # "_" = blank
        c = id ÷ 3; a = id % 3 + 1
        @assert POS[c+1] == Tuple(p) "cubie order differs"
        @assert n[a] != 0 "axis order differs"
        # rotation mapping n -> z and u -> y
        rr = findfirst(r -> ROT[r] * n == [0, 0, 1] && ROT[r] * u == [0, 1, 0], 1:NR)
        cell = findfirst(==(Tuple(ROT[rr] * p)), CELLPOS)
        img == "" || @assert cell == slot + 1 "slot/up mismatch for sticker $id"
        lab[id+1] = img == "" ? ' ' : img == "H" ? hrepl : img in ("M", "S") ? img[1] :
                    slot == 2 ? Char('a' + parse(Int, img)) : img[1]
    end
    lab
end
cross(a, b) = [a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1]]
if abspath(PROGRAM_FILE) == @__FILE__
    lab = hmslabels(ARGS[1])
    println("labels \"", String(lab), "\"")
    sh = showtable(mkprint(lab))
    for L in "MS"
        G = buildfull(sh, L)
        f, mins, _ = valueiter(G, 12)
        println("$L per-cycle weight (1000 x #4-or-more... ) ", (mins[12] - mins[8]) ÷ 4, " raw ", mins[end] >= INF ? "INF" : "")
    end
end
