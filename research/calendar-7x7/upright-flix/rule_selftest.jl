#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Self-test of the selectable half-turn rule on the research code that the old Julia
# checkers use (image_normal, artwork, HALF). Run once per rule:
#   CUBISTRY_RULE=legacy julia --startup-file=no rule_selftest.jl
#   CUBISTRY_RULE=strict julia --startup-file=no rule_selftest.jl
# Exit code 1 if any expectation fails.
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
include(joinpath(@__DIR__,"rule_select.jl"))
select_rule!(Main)
function selftest()
    rule=cubistry_rule();strict=rule=="strict";bad=Ref(0)
    chk(name,got,want)=(ok=got==want;ok || (bad[]+=1);println("rule-selftest\t",rule,'\t',name,'\t',got,'\t',ok ? "PASS" : "FAIL"))
    ink="dark"
    keys_now=join(sort(collect(keys(HALF))))
    chk("half-glyph-set",keys_now,strict ? "069" : join(sort(collect("012568HNSXZ9"))))
    chk("six-nine-half-turn",image_normal("6",2,ink)==image_normal("9",0,ink),true)
    chk("six-quarter-turn-differs",image_normal("6",1,ink)==image_normal("6",0,ink),false)
    chk("six-half-turn-not-upright",image_normal("6",2,ink)==image_normal("6",0,ink),false)
    chk("zero-any-turn",image_normal("0",1,ink)==image_normal("0",0,ink),true)
    chk("eight-half-turn",image_normal("8",2,ink)==image_normal("8",0,ink),!strict)
    chk("N-half-turn",image_normal("N",2,ink)==image_normal("N",0,ink),!strict)
    chk("12-vs-21-half-turn",image_normal("12",2,ink)==image_normal("21",0,ink),!strict)
    chk("letter-O-is-zero",image_normal("O",0,ink)==image_normal("0",0,ink),!strict)
    chk("letter-I-is-one",image_normal("I",0,ink)==image_normal("1",0,ink),!strict)
    chk("artwork-O-is-zero",artwork("O",ink,2,3)==artwork("0",ink,2,3),!strict)
    chk("artwork-I-is-one",artwork("I",ink,2,3)==artwork("1",ink,2,3),!strict)
    chk("artwork-six-nine",artwork("6",ink,2,3)==artwork("9",ink,2,3),true)
    println("rule-selftest-verdict\t",rule,'\t',bad[]==0 ? "PASS" : "FAIL",'\t',bad[])
    bad[]==0
end
if abspath(PROGRAM_FILE)==@__FILE__
    selftest() || exit(1)
end
