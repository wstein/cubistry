# Shared include file for the scripts.
const HERE = @__DIR__
include(joinpath(HERE, "Cube.jl")); include(joinpath(HERE, "MiniJSON.jl")); include(joinpath(HERE, "Replay.jl"))
include(joinpath(HERE, "Search.jl"))
using .Cube, .MiniJSON, .Replay, .Search
include(joinpath(HERE, "ReplayExtra.jl"))
using .ReplayExtra
