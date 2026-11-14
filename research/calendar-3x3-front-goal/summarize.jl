# usage: julia summarize.jl <resultsDir>   (reads front-<print>-<app|own>.tsv) and prints Markdown tables
q(a, p) = (s = sort(a); s[min(length(s), floor(Int, p * (length(s) - 1) + 0.5) + 1)])
st(a) = "$(minimum(a)) / $(q(a, 0.5)) / $(q(a, 0.95)) / $(maximum(a))"
function load(f)
    rows = [split(l, '\t') for l in eachline(f) if !startswith(l, "print\t") && !isempty(l)]
    return rows
end
dir = ARGS[1]
prints = ("de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded")
println("| print | app HTM min/med/p95/max | front goal, app pose | front goal, own pose | steps saved >= 3 (app pose) | saved min/med/max (app pose) | rotations in front route (max) | unsolved <= 12 |")
println("|---|---|---|---|---|---|---|---|")
for id in prints
    a = load(joinpath(dir, "front-$id-app.tsv")); o = load(joinpath(dir, "front-$id-own.tsv"))
    ok = filter(r -> r[7] == "solved", a)
    app = [parse(Int, r[5]) for r in a]
    fr = [parse(Int, r[8]) for r in ok]
    saved = [parse(Int, r[5]) - parse(Int, r[8]) for r in ok]
    ow = [parse(Int, r[8]) for r in o if r[7] == "solved"]
    rots = [parse(Int, r[9]) for r in ok]
    println("| $id | $(st(app)) | $(st(fr)) | $(st(ow)) | $(count(>=(3), saved)) of $(length(a)) | $(minimum(saved)) / $(q(saved, 0.5)) / $(maximum(saved)) | $(maximum(rots)) | $(length(a) - length(ok)) app, $(length(o) - length(ow)) own |")
end
println()
println("| print | variant | nodes median / p95 / max | solve ms median / p95 / max | root heuristic median (route median) | table build ms median |")
println("|---|---|---|---|---|---|")
for id in prints, v in ("app", "own")
    r = load(joinpath(dir, "front-$id-$v.tsv")); ok = filter(x -> x[7] == "solved", r)
    nodes = [parse(Int, x[10]) for x in ok]; ms = [parse(Float64, x[11]) for x in ok]
    h0 = [parse(Int, x[13]) for x in ok]; pdb = [parse(Float64, x[12]) for x in ok if parse(Float64, x[12]) > 0]
    println("| $id | $v | $(q(nodes, 0.5)) / $(q(nodes, 0.95)) / $(maximum(nodes)) | $(round(q(ms, 0.5); digits=1)) / $(round(q(ms, 0.95); digits=1)) / $(round(maximum(ms); digits=1)) | $(q(h0, 0.5)) ($(q([parse(Int, x[8]) for x in ok], 0.5))) | $(isempty(pdb) ? "n/a" : round(q(pdb, 0.5); digits=1)) |")
end
println()
println("| print | app HTM + rotation tokens | front goal HTM + rotation tokens (app pose) | front goal HTM + rotation tokens (own pose) | steps with a rotation: app / front (app pose) / front (own pose) |")
println("|---|---|---|---|---|")
for id in prints
    a = load(joinpath(dir, "front-$id-app.tsv")); o = load(joinpath(dir, "front-$id-own.tsv"))
    ta = [parse(Int, r[5]) + parse(Int, r[6]) for r in a]
    fa = [parse(Int, r[8]) + parse(Int, r[9]) for r in a if r[7] == "solved"]
    fown = [parse(Int, r[8]) + parse(Int, r[9]) for r in o if r[7] == "solved"]
    println("| $id | $(st(ta)) | $(st(fa)) | $(st(fown)) | $(count(r -> parse(Int, r[6]) > 0, a)) / $(count(r -> parse(Int, r[9]) > 0, a)) / $(count(r -> parse(Int, r[9]) > 0, o)) |")
end
