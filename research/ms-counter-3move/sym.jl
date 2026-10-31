# Symmetric family (generator side only). Two letter corners A and B carry M
# and S; their third faces are junk ('X', never displayable), so in a valid M
# run they only ever sit at the upper-right cell or at the back. Own-frame
# twists commute with every turn (a turn only multiplies rotations from the
# left), so the S run is the M run started from the M start with A twisted by
# tau and B by tau^-1 (net twist 0, a legal state): S then shows exactly where
# M showed, and every other cell is unchanged. Only the M run is searched.
include("fullvi.jl")

const SA, SB = 7, 8
function ordtwist(c)
    [r for r in 2:NR if PIDX[c, r] == PIDX[c, 1]]
end
axisvec(c, a) = (n = zeros(Int, 3); n[a] = POS[c][a]; n)
# the S axis b of corner c under own twist r (M on home axis 1)
function saxis(c, r)
    for b in 1:3
        ROT[r] * axisvec(c, b) == axisvec(c, 1) && return b
    end
    error("no axis")
end

function symlabels(rest18::Vector{Char})
    lab = fill('X', 24)
    others = [c for c in 1:8 if c != SA && c != SB]
    k = 0
    for c in others, a in 1:3
        k += 1; lab[3(c-1)+a] = rest18[k]
    end
    for (c, r) in ((SA, TWA[]), (SB, TWB[]))
        lab[3(c-1)+1] = 'M'
        lab[3(c-1)+saxis(c, r)] = 'S'
    end
    lab
end
const TWA = Ref(0); const TWB = Ref(0)
# choose own twists with zero net twist: tau_B = inverse direction of tau_A
function settwists()
    TWA[] = ordtwist(SA)[1]
    for r in ordtwist(SB)
        s = ntuple(c -> c == SA ? UInt8(TWA[]) : c == SB ? UInt8(r) : UInt8(1), 8)
        twsum(s) == 0 && (TWB[] = r)
    end
    TWB[] > 0 || error("no zero-twist pair")
end
settwists()

function symscore(rest; K = 10)
    all(x -> count(==(x), rest) >= 1, vcat(collect('a':'f'), collect('0':'9'))) || return 10^9
    count(==(' '), rest) >= 1 || return 10^9
    sh = showtable(mkprint(symlabels(rest)))
    G = buildfull(sh, 'M')
    any(isempty, G.layers) && return 10^9
    f, mins, _ = valueiter(G, K)
    (length(mins) < K || mins[end] >= INF) && return 10^9
    (mins[K] - mins[K-4]) ÷ 4
end
const SYMALPH = vcat([' '], collect('a':'f'), collect('0':'9'))
function annealsym(seed, iters; T0 = 600.0, init = nothing, log = stdout)
    rng = MersenneTwister(seed)
    rest = init === nothing ? shuffle(rng, vcat([' ', ' '], collect('a':'f'), collect('0':'9'))) : collect(init)
    sc = symscore(rest); best = (sc, copy(rest))
    println(log, "seed=$seed init=$sc rest=\"$(String(rest))\""); flush(log)
    for it in 1:iters
        T = T0 * (1 - it / iters) + 5
        q = copy(rest)
        if rand(rng) < 0.75
            i, j = rand(rng, 1:18, 2); q[i], q[j] = q[j], q[i]
        else
            q[rand(rng, 1:18)] = rand(rng, SYMALPH)
        end
        q == rest && continue
        s2 = symscore(q)
        if s2 <= sc || rand(rng) < exp((sc - s2) / T)
            rest, sc = q, s2
            if sc < best[1]
                best = (sc, copy(rest))
                println(log, "seed=$seed it=$it best=$sc rest=\"$(String(rest))\" lab=\"$(String(symlabels(rest)))\""); flush(log)
            end
        end
        it % 200 == 0 && (println(log, "seed=$seed it=$it cur=$sc best=$(best[1])"); flush(log))
    end
    best
end
if abspath(PROGRAM_FILE) == @__FILE__
    annealsym(parse(Int, ARGS[1]), parse(Int, ARGS[2]); init = length(ARGS) >= 3 ? ARGS[3] : nothing)
end
