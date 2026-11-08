<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Legal move words for the accepted strict upright print (stage 1)

**Status: research study, not certified. Research only: no change to the app, the
chain workflow, the old checkers or Flix.** Base: branch
`research/cube-display-feasibility` (head `599d9b4`). Print:
`../upright-feasibility/evidence/print-strict-upright.tsv` (SHA-256
`4fc44606e5dcdd745647f57b3086570910b4068a48d001553f99b1625106bcab`), accepted by
the owner. Rule: only the digit 0 and 6 <-> 9 read the same after a half turn;
everything else is upright; O is not 0, I is not 1.

Marks: **[V]** verified (a Julia script here printed it, output in `evidence/`),
**[I]** inference, **[D]** deferred. Everything verified is **Julia only; Flix was
not run.**

## Result

| Question | Result |
|---|---|
| Legal move word from the solved cube to a state that shows the display, strict rule | **91 / 91** displays (7 weekdays x 13 month types) [V] |
| Independent replay (own geometry, own boards, own strict rule), 91 displays | **ACCEPT_ALL_91**, 0 violating turned stickers [V] |
| Turned readings the replay accepted | 91 (one per display): a 6 sticker shown as 9. No digit 0 turned, no other glyph, no split label turned [V] |
| HTM, 91 words (whole-cube rotations free) | **median 447, mean 446.62, min 389, max 489**, total 40642 [V] |
| Generators | 1..21 only (layers -3..-1, +1..+3 and rotations 7, 14, 21), no layer 0 [V] |
| The words are search results | not optimal, no savings claimed |
| 2028-01 root state | display 25, word of 481 HTM [V] |
| Chain smoke (4 edges from the 2028-01 root, one retained state) | 4 / 4 accepted by the independent replay, 270 to 462 HTM per edge, all four through the orbit-solve fallback [V] |
| The 863-edge chain | **not started** [D] |
| Flix port and Flix replay | **not done** [D] |

Because every word is a product of legal generators, each of the 91 front displays
is **reachable**; this closes the gap that `../upright-feasibility` left open (the
cubie matching there was only a necessary condition). The checks below cover the
front (49 cells) only; the other 245 stickers are don't-care by design.

## How the words were made

`synth_strict.jl` (untrusted generator) reuses the unchanged pure-split machinery:
`pure-split-states/pure_common.jl` (print, boards, front rule), the PR #130 global
beam search, the planner orbit solve (`pure-split-states/orbit_solve.jl`) and, as in
`pilot/producer-resume.jl`, the hybrid finish. The **only** change is the glyph rule:
`../upright-feasibility/strict_rule.jl` redefines `image_normal`, `artwork` and
`HALF` at run time in `Main`, `Minimax.Planner` and `Minimax.Validator`. Goal is
the 49 front cells of one display, start is the identity (solved cube).

**The global beam always stalls from the solved cube** [V] (`evidence/beam-experiments-display1.tsv`,
display 1, seven settings: default, width 80 / patience 16, `strict=false`,
lambda 6 with depth 120, hybrid finish): the best hybrid word was 436 HTM, the
orbit solve 440. So the 91 words are the **planner orbit solve**, which takes
3 s per display (about 5 minutes for all 91); the beam, 4 to 9 minutes per try, is
skipped (`MODE orbit`). A first word per display is a long walk (about 450 HTM);
the old pure-split DAG started the beam from nearby PR #99 states, which is why its
edges are much shorter (median 15 HTM). The two are not comparable.

## Independent verification [V]

`verify_moves.jl` shares **no code** with the solver or the research checkers. It
parses the print itself, builds the 91 boards from the calendar rules itself (month
letters scheme A, Sunday-first weekdays, split labels `d/(d+7)` for six-week months),
asserts that the 888 months 2026-2099 give exactly 91 distinct boards and that the 91
words cover them, applies the moves on 294 stickers (quarter-turn maps for axis x, y,
z), recomputes the HTM, and applies the strict front rule: a front sticker must carry
the cell text and ink upright; the only turned readings are a `0` at any angle and a
half-turned sticker whose reversed `0/6/9` reading is the cell text.

- `evidence/verify-moves.tsv`: per display verdict, HTM, turned readings, a state digest.
- `crosscheck_library.jl` (research library, `evidence/crosscheck-library.txt`): the
  state digest of the independent replay equals the library `state_digest` of the
  composed generator permutations for **91 / 91** words [V]. This checks the geometry
  and the move convention; it is not a second rule check.
- `negative_controls.sh`, `evidence/negative-controls.tsv`: the valid file is
  accepted, and each of six controls is rejected (old print: 91 fail; one move
  dropped; two words swapped; generator 22; wrong declared HTM; a duplicate display).
- Common-mode risk: the board generator and the rule are my reading of the owner
  rule. They are independent code from the research checkers, but the same
  reader wrote both. The research `validate_front` (strict rule patched in) also
  accepted every word in `synth_strict.jl`.

## The chain: what it needs [V] for counts, [I] for effort

`chain_plan.jl`, `evidence/chain-plan.tsv`:

- **Root:** display 25 (2028-01); its word is in `evidence/moves-strict.tsv`
  (481 HTM). The chain keeps one physical state and goes through 864 months,
  **863 edges**, to 2099-12.
- **Edge graph:** the 863 month steps use only **98 distinct directed display
  transitions** between the 91 displays (every display is used, out-degree 1 or 2, no
  self loop). It is a graph with cycles, not a DAG. An edge word depends on the
  retained state, not only on the two displays, so the 98 do not give 98 reusable edge
  words. A reusable edge would be the route through the solved cube; its HTM as a
  naive concatenation (inverse of one word, then the other) has median 900, max 953
  (upper bound only).
- **Smoke test, 4 edges** (`chain_smoke.jl`, `evidence/chain-smoke-edges.tsv`,
  replayed by `verify_smoke.jl`, `evidence/verify-smoke.tsv`): 2028-01 to 2028-05.
  The global beam stalled in every edge and the orbit-solve fallback produced
  442, 462, 270 and 430 HTM (1604 total) in about 190 to 250 s each (932 s CPU).
  Beam stall of the first edge (`evidence/chain-smoke-beam-stall.txt`): 43 wrong
  front positions at the start, 4 left (three corner/wing positions and the core
  position 253) when the beam ran out of macros.
- **Effort [I]:** edges are strictly sequential (each starts from the previous
  state). At the measured 230 s and about 400 HTM per edge, 863 edges are about
  55 CPU hours and about 350000 HTM, versus 158 s and about 130 HTM per edge for the
  old pure-split chain. This is **not** cheap (the limit given was 1 h CPU), so the
  chain was not started. Next stage should first look at why the beam stalls under
  the strict rule (a 4-position residue including the core cell) or give the fallback
  a better solver, then run the existing `pure-split-chain` machinery with the strict
  rule and print.

## Reproduce

```sh
cd research/calendar-7x7/upright-moves
gunzip -c ../pure-split-states/evidence/dag-all.tsv.gz > /tmp/dag-all.tsv   # pose action only
P=../upright-feasibility/evidence/print-strict-upright.tsv
julia --startup-file=no synth_strict.jl /tmp/dag-all.tsv $P OUT.tsv orbit     # 91 words, ~5 min
julia --startup-file=no verify_moves.jl $P OUT.tsv                            # independent replay
julia --startup-file=no crosscheck_library.jl /tmp/dag-all.tsv $P OUT.tsv evidence/verify-moves.tsv
julia --startup-file=no chain_plan.jl $P OUT.tsv
julia --startup-file=no chain_smoke.jl /tmp/dag-all.tsv $P OUT.tsv 4 SMOKE.tsv
julia --startup-file=no verify_smoke.jl $P OUT.tsv SMOKE.tsv
./negative_controls.sh julia evidence/negative-controls.tsv
```

Julia 1.10.x (1.10.5 used). `evidence/moves-strict.tsv` SHA-256
`fd0c11b39dba401b5487c68538748a1cd9f5b3cbde793fe4bf6bc6a91e6f90e5`; the
`seconds` column is timing, not deterministic. Tests only via GitHub Actions:
nothing was added to a workflow, and no CI test covers these scripts yet.

## Not done, and what would change [D][I]

- **Flix (next stage).** `english/flix/src/Core.flix` (`halfChar`, `halfWord`,
  `optic`: fold of O/I and the HALF table) and `verification/flix/src/Oriented.flix`
  still carry the old rule. The branch has no `.github` directory, so a Flix test run
  through GitHub Actions cannot be set up inside this research branch; I did not port
  blind. The port plus a Flix replay of `evidence/moves-strict.tsv` is the next stage.
- **Old checkers.** `check_pure.jl`, `pure_chain.jl` and the Flix `chain` command use
  the old rule and the PR #99-derived print identity; the new print needs the rule
  parametrized there (or `strict_rule.jl` ported) before they can accept these words.
- **Main app (not edited).** `display.ts` (`HALF`, `imageNormal`, O/I aliases),
  `tests/calendar7-replay.test.mjs` lines 159-165, `src/apps/calendar7/sticker-art.ts`
  (diagonal split branch), `month-view.ts` if it draws split cells, the print sheet
  generator (no calendar7 support), and the data the app pins (new print digest, new
  states; `displays.v1.json` is unchanged). Old chain edges are invalid under the new
  print.
- **Physical.** Same caveats as `../upright-feasibility` (real recess of corner and wing
  pieces, 6 turned is still a 6 glyph).
