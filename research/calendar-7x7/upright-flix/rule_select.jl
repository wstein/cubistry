# SPDX-License-Identifier: AGPL-3.0-or-later
# Selectable glyph half-turn rule for the Julia checkers (included by check_pure.jl,
# pure_chain.jl and the scripts of this directory).
#   CUBISTRY_RULE=legacy  (default) the rule of every chain in main: 0 1 2 5 8 H N S X Z and
#                         6<->9 are half-turn equal, the letters O and I fold to 0 and 1.
#   CUBISTRY_RULE=strict  owner rule of ../upright-feasibility: only the digit 0 and 6<->9;
#                         no aliasing (O is not 0, I is not 1).
# Usage in a script, as two separate TOP-LEVEL statements (the redefinitions must be
# visible to code that runs afterwards):
#   include(joinpath(@__DIR__,"..","upright-flix","rule_select.jl"))
#   select_rule!(Main)
cubistry_rule()=get(ENV,"CUBISTRY_RULE","legacy")
if cubistry_rule()=="strict" && !isdefined(@__MODULE__,:STRICT_HALF)
    include(joinpath(@__DIR__,"..","upright-feasibility","strict_rule.jl"))
end
function select_rule!(mods...)
    rule=cubistry_rule()
    rule in ("legacy","strict") || error("CUBISTRY_RULE must be legacy or strict, got $rule")
    rule=="strict" && Base.invokelatest(apply_strict_rule!,mods...)
    rule
end
