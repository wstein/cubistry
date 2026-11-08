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
| `controls.sh` | One driver for any checker: valid input accepted, six negative controls and two alias controls (O as 0, I as 1) with the expected verdict per rule. |

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
| Control detail | old print 0 of 91 accepted; dropped move 90 accepted / 1 rejected; swapped words 89/2; wrong HTM 90/1; generator 22 and duplicate display abort with the stated reason (`evidence/*controls*.tsv`) [V] |
| Alias controls (strict print with O printed as 0 on 3 stickers, and I printed as 1 on 1 sticker) | strict rule, all three checkers: **REJECTED** (0 of 91 accepted). Legacy rule (Flix `replay legacy`, Julia `rule_replay.jl` with `CUBISTRY_RULE=legacy`): **ACCEPTED** 91 of 91. This is the control that tells the two rules apart [V] |
| Rule self-tests (both rules, Julia and Flix) | all expectations PASS: strict has 0 and 6<->9 only, O is not 0, I is not 1, 8 / N / 12-vs-21 are not half-turn equal; legacy keeps them equal [V] |
| `check_pure.jl matchability`, strict rule, strict print | `pure-matchability 0` [V] |
| Legacy regression, Julia: matchability receipt and chain 2027 | byte-identical to `../pure-split-states/evidence/receipts/*.julia.tsv` [V] |
| Legacy regression, Flix (pure-split jar built with the new `Core.flix`): matchability and chain 2027 | byte-identical to `*.flix.tsv` receipts [V] |
| `verification/flix` with the `Oriented.flix` port | compiles (`./flixw build-jar`); **not run** [V compile only] |

`evidence/*replay-legacy.tsv`: the legacy rule also accepts all 91 words on the strict
print (it is more lenient, so the words alone do not tell the rules apart). The
strict rule is told apart from the legacy rule by the self-tests and by the two alias
controls. The old-print control is only a positions control: that print has a
different sticker layout, so it is rejected 0 of 91 by the legacy rule as well.

The Flix replay prints the HTM per row (`move-check`, column 7); the total 40642 is the
sum of that column over the 91 accepted rows.

## How it ran

Workflow `.github/workflows/upright-verify.yml` lives on `main` (wstein/cubistry#339),
because `research/cube-display-feasibility` has no `.github` and the existing
workflows only start chains. It takes a `research_ref` input (default
`research/cube-display-feasibility`). The first run of this section was made from that
PR before it was merged, with research ref `research/upright-flix-2`: run 42449972802 (research
commit `f7762f1`): jobs `julia`, `flix`, `flix-legacy` all succeeded; the evidence
files are from that run. An earlier run on the superseded branch `research/upright-flix`
had failed once on a wrong self-test expectation (6 and 9 are two artwork classes of
one cell) and on a leaked `FLIX_JAR` variable in the workflow; both are fixed.

## Strict chain command (Flix) and strict path of `pure_chain.jl` (Julia)

The chain verifiers now take the half-turn rule. **Default stays Legacy**, so the committed
chains (`chain-2027` and `chain-2028-2076`, the file names under
`pure-split-states/evidence/`) verify exactly as before; the legacy regression jobs of
`upright-verify.yml` compare their receipts byte for byte.

| Command | Rule | Source state |
|---|---|---|
| `java -jar flix.jar chain PRINT DAG CHAIN ORIG GEOM` (also `... legacy`) | Legacy | DAG root state (unchanged) |
| `java -jar flix.jar chain PRINT - CHAIN ORIG GEOM strict ROOT_MOVES` | Strict (`opticR`) | solved print turned by the root word of the source display |
| `pure_chain.jl PRINT DAG CHAIN` | Legacy | DAG root state (unchanged) |
| `CUBISTRY_RULE=strict pure_chain.jl PRINT DAG CHAIN ROOT_MOVES` | Strict | as above (DAG only supplies the 21 generator permutations) |

In the strict mode the print must have SHA-256 `4fc44606...bcab`
(`upright-feasibility/evidence/print-strict-upright.tsv`), both verifiers still require
the surface identity of the PR #99 print, the source front, every edge front, the pose
replay equal to the direct 294-sticker replay, the declared metrics, the SHA-256 of the full
physical state before and after each edge, the exact edge inverse and the exact whole-chain
inverse. `Stacked.flix` got `frontFailureR` / `stackedMatchR` (rule as the first argument);
`frontFailure` / `stackedMatch` are one-line Legacy wrappers. The flix `matchability`
command still uses Legacy (not needed for the chain) [D].

Also new in `../upright-beam/`: `verify_chain.jl` (independent third checker: it shares only
`verify_moves.jl`, with its own geometry, boards, strict front rule and SHA-256 of the state
text; it parses the chain itself and checks adjacency, HTM, the declared source and end
hashes and every front; it does not recompute the QTM and rotation fields and has no print
pin, which the Julia and Flix verifiers do),
`make_chain.jl` (untrusted chain writer from edge words), `chain_runner_*.sh` and
`chain_controls.sh` (nine mutated inputs per checker).

### Evidence (GitHub Actions run 42463812245, `upright-verify.yml` from branch
`ci/upright-chain`, research code `research/strict-chain-ci` at `8bcea588` = this branch plus
the producer of the follow-up PR) [V]

| Check | Result |
|---|---|
| Smoke chain 2028-01 .. 2028-05, 4 edges, 481 HTM (`../upright-beam/evidence/chain-smoke.moves.tsv`) | Julia `status VALID_CONTINUOUS_CHAIN 4 218 294 49`, Flix the same line; the two receipts are **byte-identical** (`chain-smoke.julia.tsv`, `chain-smoke.flix.tsv`) |
| Independent replay `verify_chain.jl` | `chain-verdict ACCEPT_CHAIN 4 2028-5`; its own state SHA-256 equals the declared hash at the root and after each of the 4 edges (`chain-smoke.replay.tsv`) |
| `make_chain.jl` on `chain-smoke-edges.tsv` | reproduces the committed chain file byte for byte |
| Negative controls, three checkers | valid ACCEPT; old print, dropped move, generator 22, extra move, non-adjacent month, wrong source month, substituted source hash, wrong root word, other layer with the same declared metrics: **9 of 9 REJECTED** by each of Julia, Flix and the replay (`chain-controls-*.tsv`) |
| Legacy regression (Julia and Flix chain 2027, matchability) | still byte-identical to the committed receipts (jobs `julia`, `flix-legacy` of the same run) |
| 91-word replays and rule self-tests | unchanged, all pass (jobs `julia`, `flix`) |

Rule self-check: a chain mutation that only a legacy checker would accept needs an
edge whose end front differs between the rules, which the smoke chain does not have. So
each of the three chain verifiers (Julia, Flix, replay) runs a start-up self-check on the
source front before replaying: a 1/2/5/8 sticker turned by 180 degrees and an "I" sticker
in a "1" cell must be rejected by the strict rule (Legacy must accept them; Julia and Flix
print `rule-selfcheck` and abort on a deviation, the replay is strict only). The nine
mutations themselves are rejected for structural reasons (hash, metrics, front, print
pin). The Julia and Flix verifiers also require the exact `FOUND` status in the root-word
row. Common-mode
risk is unchanged: boards and rule are one reading of the owner rule, Julia and Flix by the
same author.

## Not verified, not done

- **The 863-edge chain was not started by this work** [D] (see the section above and `upright-chain.yml`).
- `Oriented.flix` and the `HalfRule` port in the verification project are compiled
  only [D].
- Common-mode risk: the boards and the rule in `Replay.flix`, `verify_moves.jl` and
  `rule_replay.jl` are one reading of the owner rule (the research front checker used
  by `rule_replay.jl` is independent code). The words are search results, not optimal.
- The Flix port is a structural port by the same author; Julia and Flix agree on every
  count above, which is evidence, not a proof that the rule itself is right.
