# Reads the old counter print (research/counter-2x2-optimization/stickers.csv) as a warm start only.
function oldprint(path=joinpath(@__DIR__, "..", "..", "counter-2x2-optimization", "stickers.csv"))
    lab = fill(-1, 24)
    pv(s) = Tuple(parse.(Int, split(strip(s, ['[', ']', '"']), ",")))
    for ln in readlines(path)[2:end]
        parts = [m.match for m in eachmatch(r"\"[^\"]*\"|[^,]+", ln)]
        role, img = parts[6], parts[7]; f = M.fidx(pv(parts[9]), pv(parts[10]))
        lab[f+1] = role in ("TL", "TR") ? BLANK : role == "DT" ? tens(parse(Int, img)) : units(parse(Int, img))
    end
    st = M.IDSTATE
    for mv in split("U2 F' L U' R'"); st = applyw(st, UInt8.(M.MOVEPERMS[findfirst(==(mv), M.MOVENAMES)])); end
    lab, st
end
