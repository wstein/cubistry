# Generates negative-control inputs from a valid evidence directory (text mutations only).
# Usage: julia controls.jl EVIDENCE_DIR OUT_DIR
include(joinpath(@__DIR__, "model.jl")); using .M
ev, out = ARGS; mkpath(out)
P = readlines(joinpath(ev, "print.tsv"))
R = readlines(joinpath(ev, "routes-lz.tsv"))
fieldsof(l) = split(l, "\t")
setrow(rows, i, f) = (r = copy(rows); r[i] = join(f, "\t"); r)
put(name, rows) = open(io -> foreach(l -> println(io, l), rows), joinpath(out, name), "w")
idof(p, n) = M.fidx(p, n)
# 1 wrong glyph: first units-digit sticker shown at LR in the solved (00) state -> artwork 8
lr = idof((1,-1,1),(0,0,1)); f = fieldsof(P[lr+2]); f[4] = f[4] == "8" ? "7" : "8"; put("print-wrong-glyph.tsv", setrow(P, lr+2, f))
# 2 wrong up: the LL (tens 0) sticker gets its up vector negated
ll = idof((-1,-1,1),(0,0,1)); f = fieldsof(P[ll+2]); f[5] = join(-parse.(Int, split(f[5], ",")), ","); put("print-wrong-up.tsv", setrow(P, ll+2, f))
# 3 top cell non-blank: sticker shown at UL in the solved state becomes digit 5 (up tangent)
ul = idof((-1,1,1),(0,0,1)); f = fieldsof(P[ul+2]); f[4] = "5"; f[5] = "0,1,0"; put("print-top-nonblank.tsv", setrow(P, ul+2, f))
# 4 NZ tens cell non-blank: sticker shown at LL after the NZ setup becomes digit 0
sw = split(fieldsof(readlines(joinpath(ev, "setup-nz.tsv"))[2])[2])
st = foldl((s, mv) -> M.applyperm(s, M.MOVEPERMS[findfirst(==(mv), M.MOVENAMES)]), sw; init = M.IDSTATE)
nzll = M.atfacelet(st)[M.F_LL+1]; f = fieldsof(P[nzll+2]); f[4] = "0"; f[5] = join(M.upfor(nzll, (-1,-1,1)), ","); put("print-nz-tens-nonblank.tsv", setrow(P, nzll+2, f))
# 5 wrong route move: row of step 40, last increment move face replaced (decrement kept inverse)
inv1(m) = length(m) == 1 ? m * "'" : m[2] == '\'' ? m[1:1] : m
f = fieldsof(R[42]); w = split(f[5]); last_ = w[end]; w[end] = (last_[1] == 'B' ? "F" : "B") * last_[2:end]
f[5] = join(w, " "); f[8] = join(reverse(inv1.(w)), " "); put("routes-lz-wrong-move.tsv", setrow(R, 42, f))
# 6 claimed distance too small: step 50 increment shortest minus one
f = fieldsof(R[52]); f[7] = string(parse(Int, f[7]) - 1); put("routes-lz-short-claim.tsv", setrow(R, 52, f))
# 7 decrement not the inverse word: step 60 decrement reversed without inverting moves
f = fieldsof(R[62]); f[8] = join(reverse(split(f[5])), " "); f[8] == join(reverse(inv1.(split(f[5]))), " ") && (f[8] = f[5] * " " * f[5]); put("routes-lz-bad-inverse.tsv", setrow(R, 62, f))
# 8 unreachable target: the units-5 sticker (upright at LR) is reprinted as 6, so no sticker can show units 5
u5 = only(i for i in 0:23 if fieldsof(P[i+2])[4] == "5" && fieldsof(P[i+2])[5] == join(M.upfor(i, (1,-1,1)), ","))
f = fieldsof(P[u5+2]); f[4] = "6"; put("print-hidden-unreachable.tsv", setrow(P, u5+2, f))
println("controls written; nz LL sticker ", nzll)
