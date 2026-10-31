# Usage: julia finalize.jl LABELS(comma list, engine frame) SEEDSTATE OUTDIR [ntry]
# Finds exact closed cycles for LZ and NZ on one print, rebases the print so that the LZ
# start state is the printed solved state, and writes checker inputs.
include(joinpath(@__DIR__, "export.jl"))
lab = parse.(Int, split(ARGS[1], ",")); seed = parse(UInt64, ARGS[2]); out = ARGS[3]
ntry = length(ARGS) >= 4 ? parse(Int, ARGS[4]) : 30
W = buildwords(5)
res = Dict{Symbol,Any}()
for mode in (:lz, :nz)
    if mode == :nz
        # seed for NZ: nearest state showing "_0" from the LZ seed
        out_ = Tuple{UInt64,Int32}[]; succ!(out_, W, lab, seed, 0, :B, 5, :nz)
        isempty(out_) && (println("nz: no seed within 5"); continue)
        s = first(out_[argmin([W.len[x[2]] for x in out_])])
    else
        s = seed
    end
    b = bestcycle(W, lab, s, :B, mode; ntry)
    b === nothing && (println(mode, ": no closed cycle found"); continue)
    println(mode, " cost ", b[1], " hist ", histo(W, b[2]), " total ", sum(W.len[b[2]]))
    res[mode] = b
end
haskey(res, :lz) || exit(1)
g0 = res[:lz][3]
nl = rebase(lab, g0)
# re-express states in the rebased frame by replaying words from the identity
mkpath(out)
writeprint(joinpath(out, "print.tsv"), nl)
writeroutes(joinpath(out, "routes-lz.tsv"), W, nl, M.IDSTATE, res[:lz][2], :lz)
writesetup(joinpath(out, "setup-lz.tsv"), "lz", "")
if haskey(res, :nz)
    # NZ start in rebased frame: same relative word from LZ start
    w = connect(W, g0, res[:nz][3])
    println("lz->nz setup ", w)
    if w !== nothing
        st = foldl((s, mv) -> applyw(s, UInt8.(M.MOVEPERMS[findfirst(==(mv), M.MOVENAMES)])), split(w); init = M.IDSTATE)
        writeroutes(joinpath(out, "routes-nz.tsv"), W, nl, st, res[:nz][2], :nz)
        writesetup(joinpath(out, "setup-nz.tsv"), "nz", w)
    end
end
println("labels-rebased ", join(nl, ','))
