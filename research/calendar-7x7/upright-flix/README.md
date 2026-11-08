<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Strict upright rule in Flix and in the old Julia checkers

**Status: research verifier, not certified.** Base: branch
`research/cube-display-feasibility` (head `e3af203`). It ports the strict upright
rule of `../upright-feasibility` and `../upright-moves` to the Flix side and to the old
Julia checkers, so that the new print and the 91 move words can be verified in both
languages. Nothing here changes an app file, an existing workflow or the behavior of
the chains in main. Julia and Flix only, no Python.

Marks: **[V]** verified by a GitHub Actions run (see below), **[I]** inference,
**[D]** deferred.

Rule (owner): only the digit 0 (circular, any turn) and the single digits 6 <-> 9 read
the same after a half turn; every other glyph is upright; O is not 0 and I is not 1.
The **legacy** rule is the one the chains in main use (0 1 2 5 8 H N S X Z and 6 <-> 9,
O folds to 0, I folds to 1).

## What changed

| Where | Change |
|---|---|
| `../english/flix/src/Core.flix` | `enum HalfRule { Legacy, Strict }`, `halfCharR`, `halfWordR`, `opticR`. `halfChar`, `halfWord` and `optic` are now one-line wrappers of the Legacy rule, so every existing Flix project keeps its meaning. |
| `../verification/flix/src/Oriented.flix` | Same: `HalfRule`, `halfCharR`, `halfWordR`, `orientedArtR`; `halfChar`, `halfWord`, `orientedArt` stay Legacy. |
| `../pure-split-states/check_pure.jl`, `pure_chain.jl` | Two lines each: `include rule_select.jl` and `select_rule!(Main)`. `CUBISTRY_RULE=legacy` (default, nothing changes) or `strict`. |
| `rule_select.jl` | Loads `../upright-feasibility/strict_rule.jl` and applies it to `Main` when `CUBISTRY_RULE=strict`. |
| `rule_selftest.jl`, `flix/src/Replay.flix selftest` | Expectations for both rules (0, 6/9, 8, N, 12 vs 21, O, I, artwork). |
| `flix/src/Replay.flix`, `flix/build.sh` | Flix replay of `../upright-moves/evidence/moves-strict.tsv`; uses only `Core.flix`. |
| `rule_replay.jl` | Julia replay through the **research** front checker (`front_failure`, `direct_move`), so the selectable rule of the old Julia checkers is what is exercised. `../upright-moves/verify_moves.jl` stays the independent Julia replay. |
| `controls.sh` | One driver for any checker: valid input accepted, six negative controls rejected. |

## Replay (all CI, `evidence/`)

`Replay.flix` reads the print itself, rebuilds the 91 front boards (month letters
scheme A, Sunday first, split labels `d/(d+7)`), applies the words on 294 stickers with
its own geometry (generators 1..21, no layer 0), recomputes the HTM and checks every
front cell with `opticR`.

| Check | Result |
|---|---|
| Flix replay, strict rule, 91 words | **ACCEPT_ALL_91**, recomputed HTM total 40642 (same as the Julia evidence) [V] |
| Julia `verify_moves.jl` (independent), 91 words | **ACCEPT_ALL_91** [V] |
| Julia `rule_replay.jl`, strict rule (research checker), 91 words | **ACCEPT_ALL_91** [V] |
| Negative controls, same six for all three checkers | old print, dropped move, swapped words, generator 22, wrong HTM, duplicate display: **all REJECTED** [V] |
| Control detail | old print 0 of 91 accepted; dropped move 90/1; swapped words 89/2; wrong HTM 90/1; generator 22 and duplicate display abort with the stated reason (`evidence/*controls*.tsv`) [V] |
| Rule self-tests (both rules, Julia and Flix) | all expectations PASS: strict has 0 and 6<->9 only, O is not 0, I is not 1, 8 / N / 12-vs-21 are not half-turn equal; legacy keeps them equal [V] |
| `check_pure.jl matchability`, strict rule, strict print | `pure-matchability 0` [V] |
| Legacy regression, Julia: matchability receipt and chain 2027 | byte-identical to `../pure-split-states/evidence/receipts/*.julia.tsv` [V] |
| Legacy regression, Flix (pure-split jar built with the new `Core.flix`): matchability and chain 2027 | byte-identical to `*.flix.tsv` receipts [V] |
| `verification/flix` with the `Oriented.flix` port | compiles (`./flixw build-jar`); **not run** [V compile only] |

`evidence/*replay-legacy.tsv`: the legacy rule also accepts all 91 words on the strict
print (it is more lenient, so this is expected and not a defect). The strict gate is
therefore shown by the self-tests and by the old-print control (the old print carries
the O/0 and I/1 aliases and fails 91 of 91 under the strict rule).

## How it ran

Workflow `.github/workflows/upright-verify.yml` lives in a separate small PR against
`main` (wstein/cubistry#339), because `research/cube-display-feasibility` has no
`.github` and the existing workflows only start chains. It takes a `research_ref`
input. Until it is on main it also runs on that PR (pull_request trigger limited to the
workflow file), with research ref `research/upright-flix`. Run 42448915650 (research
commit `027888e`): jobs `julia`, `flix`, `flix-legacy` all succeeded. The first run
failed on a wrong expectation in my own self-test (6 and 9 are two artwork classes of
one cell) and on a leaked `FLIX_JAR` variable in the workflow; both were fixed and the
run above is the second.

## Not verified, not done

- **The 863-edge chain was not started** [D].
- The strict rule is **not** wired into the Flix `chain` command or `Stacked.flix`
  (they still call `optic`, Legacy). The Julia `pure_chain.jl` accepts
  `CUBISTRY_RULE=strict`, but no chain file exists for the strict print, so that path
  is untested [D].
- `Oriented.flix` and the `HalfRule` port in the verification project are compiled
  only [D].
- Common-mode risk: the boards and the rule in `Replay.flix`, `verify_moves.jl` and
  `rule_replay.jl` are my reading of the owner rule (the research front checker used by
  `rule_replay.jl` is independent code). The words are search results, not optimal.
- The Flix port is a structural port by the same author; Julia and Flix agree on every
  count above, which is evidence, not a proof that the rule itself is right.
