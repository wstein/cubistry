# Generator-side 2x2x2 fixed-frame model (index tables). Not the proof authority:
# the independent checkers in ../julia and ../flix re-derive everything from vectors.
module M
const V = NTuple{3,Int}
# facelet f in 0:23 = pos*3 + (a-1); pos bits: x>0 -> 1, y>0 -> 2, z>0 -> 4
posvec(pos) = ((pos & 1) != 0 ? 1 : -1, (pos & 2) != 0 ? 1 : -1, (pos & 4) != 0 ? 1 : -1)
posidx(p::V) = (p[1] > 0 ? 1 : 0) + (p[2] > 0 ? 2 : 0) + (p[3] > 0 ? 4 : 0)
function facelet(f)
    pos, a = divrem(f, 3); p = posvec(pos)
    n = ntuple(i -> i == a + 1 ? p[i] : 0, 3); (p, n)
end
function fidx(p::V, n::V)
    a = findfirst(!=(0), n); @assert n[a] == p[a]; posidx(p) * 3 + (a - 1)
end
cross(a::V, b::V) = (a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1])
dot(a::V, b::V) = a[1]*b[1]+a[2]*b[2]+a[3]*b[3]
# clockwise quarter turn seen from outside face with outward normal n: v -> (v.n)n - n x v
cw(v::V, n::V) = (d = dot(v, n); c = cross(n, v); (d*n[1]-c[1], d*n[2]-c[2], d*n[3]-c[3]))
const FACES = [("R",(1,0,0)),("L",(-1,0,0)),("U",(0,1,0)),("D",(0,-1,0)),("F",(0,0,1)),("B",(0,0,-1))]
const MOVENAMES = String[]; const MOVEPERMS = Vector{Vector{Int}}()
for (nm, n) in FACES, (q, suf) in ((1,""),(2,"2"),(3,"'"))
    perm = zeros(Int, 24)
    for f in 0:23
        p, nn = facelet(f)
        if dot(p, n) > 0
            for _ in 1:q; p = cw(p, n); nn = cw(nn, n); end
        end
        perm[f+1] = fidx(p, nn)
    end
    push!(MOVENAMES, nm * suf); push!(MOVEPERMS, perm)
end
# cubie c's sticker facelets given where its x-sticker (reference, facelet 3c) is.
const ROTS = let rs = Vector{NTuple{3,V}}()
    for a in 1:3, b in 1:3, sa in (1,-1), sb in (1,-1)
        a == b && continue
        ex = ntuple(i -> i == a ? sa : 0, 3); ey = ntuple(i -> i == b ? sb : 0, 3); ez = cross(ex, ey)
        push!(rs, (ex, ey, ez))   # images of x,y,z
    end; rs end
rot(R, v::V) = (R[1].*v[1] .+ R[2].*v[2] .+ R[3].*v[3])
const CUBIEFACELETS = let t = fill(-1, 8, 24, 3)   # [cubie+1, reffacelet+1, k] -> facelet of sticker 3c+k-1
    for c in 0:7, R in ROTS
        p = posvec(c); P = rot(R, p)
        fr = fidx(P, rot(R, facelet(3c)[2]))
        for k in 0:2; t[c+1, fr+1, k+1] = fidx(P, rot(R, facelet(3c+k)[2])); end
    end; t end
const F_UL = fidx((-1,1,1),(0,0,1)); const F_UR = fidx((1,1,1),(0,0,1))
const F_LL = fidx((-1,-1,1),(0,0,1)); const F_LR = fidx((1,-1,1),(0,0,1))
# up vector a sticker must carry (in its home frame) to be upright at front cell cpos
function upfor(s, cpos::V)
    p, n = facelet(s)
    for R in ROTS
        if rot(R, p) == cpos && rot(R, n) == (0,0,1)
            # R maps home to cell; need u with R(u) = (0,1,0): u = R^T y
            return (R[1][2], R[2][2], R[3][2])
        end
    end
    error("no rotation")
end
# state: 8 reference facelets packed (5 bits each) into UInt64
pack(v) = (x = UInt64(0); for c in 1:8; x |= UInt64(v[c]) << (5(c-1)); end; x)
getref(st::UInt64, c) = Int((st >> (5(c-1))) & 0x1f)
const IDSTATE = pack([3c for c in 0:7])
applyperm(st::UInt64, w) = (x = UInt64(0); for c in 1:8; x |= UInt64(w[getref(st, c)+1]) << (5(c-1)); end; x)
# where every sticker is: loc[s+1] = facelet
function locs(st::UInt64)
    l = zeros(Int, 24)
    for c in 0:7, k in 0:2; l[3c+k+1] = CUBIEFACELETS[c+1, getref(st, c+1)+1, k+1]; end; l
end
function atfacelet(st::UInt64)
    a = zeros(Int, 24); l = locs(st); for s in 0:23; a[l[s+1]+1] = s; end; a
end
end
