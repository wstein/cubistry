#!/usr/bin/env julia
# Native executable replay: direct rigid-sticker rotation, not solver verdicts.
include(joinpath(@__DIR__, "..", "english", "replay_legal.jl"))

const PRINT_SHA256 = "b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931"

function read_sequence(path)
    lines = strict_lines(path)
    @assert length(lines) >= 3 && lines[1] == "cubistry.calendar7.practical.v1"
    a = split(lines[2], '\t'); b = split(lines[3], '\t')
    @assert length(a) == 2 && a[1] == "source"
    @assert length(b) == 3 && b[1] == "destination"
    source = canonical_integer(a[2]); year = canonical_integer(b[2]); month = canonical_integer(b[3])
    @assert 1 <= source <= 91 && 2026 <= year <= 2099 && 1 <= month <= 12
    @assert length(lines) <= 100003
    moves = Tuple{Int,Int}[]
    for line in lines[4:end]
        f = split(line, '\t')
        @assert length(f) == 3 && f[1] == "move"
        g = canonical_integer(f[2]); q = canonical_integer(f[3])
        @assert 1 <= g <= 21 && q in (-1, 1, 2)
        push!(moves, (g, q))
    end
    (;source, year, month, moves)
end

function calendar_goal(year, month)
    a = board(year, month, "EN"; merge_six_nine=false)
    start = month <= 9 ? 5 : 1
    for c in 1:7
        a[1,c] = start <= c <= start+2 ? (string(collect(MONTHS["EN"][month])[c-start+1]), "month") : ("", "blank")
        g, ink = a[3,c]
        !isempty(g) && parse(Int,g) > 7 && (a[3,c] = (g*"↶", ink))
    end
    (;year, month, board=a)
end

# Explicit coordinate formulas independently rotate the actual sticker poses.
function turn_vector(v, axis)
    axis == 1 && return (v[1], -v[3], v[2])
    axis == 2 && return (v[3], v[2], -v[1])
    (-v[2], v[1], v[3])
end
function direct_move(state, generator, exponent)
    axis = div(generator-1, 7)+1
    slot = mod(generator-1, 7)+1
    layer = (-3, -2, -1, 1, 2, 3, 99)[slot]
    result = state
    for _ in 1:mod(exponent,4)
        result = map(result) do s
            if layer == 99 || s.pos[axis] == layer
                merge(s, (pos=turn_vector(s.pos,axis), normal=turn_vector(s.normal,axis), up=turn_vector(s.up,axis)))
            else
                s
            end
        end
    end
    result
end

function verify_sequence(dag_path, sequence_path; output=stdout)
    input = read_sequence(sequence_path)
    print_path = joinpath(@__DIR__, "..", "english", "evidence", "physical-print.tsv")
    @assert bytes2hex(sha256(read(print_path))) == PRINT_SHA256 "Immutable printing changed"
    source = read_physical(print_path)
    proof = replay_dag(dag_path; require_full=false)
    @assert haskey(proof.targets, input.source)
    p = signed_perm(proof.registers, proof.targets[input.source])
    state = decode_physical(source, p, proof.action)
    source_goal = physical_targets("EN")[input.source]
    validate_front(state, source_goal)
    initial = copy(state)
    initial_hash = state_digest(initial)
    htm = qtm = rotations = rotation_qtm = 0
    for (generator, exponent) in input.moves
        state = direct_move(state, generator, exponent)
        g = UInt16.(proof.action.generators[generator])
        for _ in 1:mod(exponent,4)
            p = compose(p, g)
        end
        @assert state == decode_physical(source, p, proof.action) "Direct sticker/pose action disagreement"
        if generator % 7 == 0
            rotations += 1; rotation_qtm += abs(exponent)
        else
            htm += 1; qtm += abs(exponent)
        end
    end
    validate_front(state, calendar_goal(input.year, input.month))
    final_hash = state_digest(state)
    for (g,q) in reverse(input.moves)
        state = direct_move(state,g,-q)
    end
    @assert state == initial "Exact inverse restoration failed"
    println(output, "source-sha256\t", initial_hash)
    println(output, "endpoint-sha256\t", final_hash)
    println(output, "metrics\t", join((htm,qtm,rotations,rotation_qtm,length(input.moves)), '\t'))
    println(output, "status\tVALID_EXECUTABLE_TRANSITION\t218\t294\t49")
    (;input, initial_hash, final_hash, htm, qtm, rotations, rotation_qtm)
end

if abspath(PROGRAM_FILE) == @__FILE__
    @assert length(ARGS) == 2 "Expected original DAG path and executable sequence path"
    verify_sequence(ARGS[1], ARGS[2])
end
