# Systematic neighborhood descent over full-model prints (generator side
# only): evaluates every single swap and every single relabel of the current
# print, moves to the best strict improvement; on a plateau it moves to a
# random equal-score neighbor not seen before.
include("annealfull.jl")
function sweep(lab0, rounds; seed = 1)
    rng = MersenneTwister(seed)
    lab = collect(lab0); sc = fullscore(lab)
    seen = Set([String(lab)])
    println("start $sc \"$(String(lab))\""); flush(stdout)
    for r in 1:rounds
        nbrs = Vector{Vector{Char}}()
        for i in 1:24, j in i+1:24
            lab[i] == lab[j] && continue
            q = copy(lab); q[i], q[j] = q[j], q[i]; push!(nbrs, q)
        end
        for i in 1:24, g in ALPH
            g == lab[i] && continue
            q = copy(lab); q[i] = g; validlab(q) && push!(nbrs, q)
        end
        shuffle!(rng, nbrs)
        bestq = nothing; bests = sc; eq = Vector{Vector{Char}}()
        for q in nbrs
            String(q) in seen && continue
            s = fullscore(q)
            if s < bests
                bests, bestq = s, q
                println("  improve $s \"$(String(q))\""); flush(stdout)
                break
            elseif s == sc
                push!(eq, q)
            end
        end
        if bestq !== nothing
            lab, sc = bestq, bests
        elseif !isempty(eq)
            lab = rand(rng, eq)
        else
            println("local minimum"); break
        end
        push!(seen, String(lab))
        println("round $r score $sc \"$(String(lab))\""); flush(stdout)
    end
end
sweep(ARGS[1], parse(Int, ARGS[2]); seed = parse(Int, ARGS[3]))
