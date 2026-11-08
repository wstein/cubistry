# English 7×7 calendar cube (data stage and first mode)

**Status: research candidate, not certified.** This page describes the data, the
pin, the replay test and the user interface (month sheet and 3D cube) of the English 7×7 monthly
calendar cube. The 3×3 [calendar page](../calendar.html) and its
[documentation](CALENDAR_CUBES.md) are unchanged.

## The mode (stages 1 and 2)

The chooser of `index.html` lists **7x7 Calendar** (mode id `calendar7`, group
cubes, one cube); it opens at `index.html?app=calendar7`. The mode shows the 7×7
cube in 3D, the 7×7 month sheet of the same month and the move word to the previous and to
the next month.

- URL parameters: `year` and `month` (1 to 12), only together. Without them the
  current month is used.
- Range: only the months of the proven chain, **January 2028 to January 2076**, can
  be shown. Any other month, including the current month while it is outside that range, gets a "Not available
  yet" message with links to the first and the last chain month.
- Steps: previous and next month along the chain. The move word of a forward step is
  the stored edge; a backward step is the inverse of the edge before it. A token is
  the axis (`x`, `y`, `z`), the layer (`-3` to `-1`, `+1` to `+3`, or `rot` for the
  whole cube), then `'` for a counter-clockwise quarter turn or `²` for a half turn.
  Each step also lists the raw generators (`g<generator>:<+1|-1|2>`, generators 1 to 21 as
  defined below) in a collapsible block.
- **The 3D view (stage 2).** The studio scene shows the cube with its 218 surface bodies
  and 294 stickers in the pose of the displayed month. A sticker shows the text and ink
  of the print (`state.v1.json`), so the stickers read as printed (the print uses the digits
  `1` and `0` where the sheet shows `I` and `O`, for example `FR1`). The cube sits slightly turned
  so that three faces show; drag it, or use the Rotation selector and Reset view, to look
  around. The month sheet below stays the reference for what the front face must show.
- **The animated step.** Choosing the previous or next month plays the stored move word
  move by move on the cube: forward is the stored edge, backward is the inverse of the edge
  before it. A move turns the layer of its axis, or the whole cube for `rot`, by the exponent
  of the move; the engine's right-handed quarter turn is the right-handed rotation of the
  scene. The controls are **Play/Pause** (pauses after the move in flight), **Skip to end**,
  **Speed** (0.5× to 8×, default 2×; nominal 90 ms per move at 1×, so 8× is about one frame per move when the display keeps up, otherwise it can equal 4×) and **Reset view**. Previous or
  Next during a step first brings the cube to the end of that step, then plays the new step.
  Under `prefers-reduced-motion: reduce` nothing animates: a step jumps to its end state and
  the page says so.
- **The shown state is the engine state.** The cube always shows a pose of the engine, never an
  approximation. At the end of every step (played, skipped, interrupted or jumped) the
  SHA-256 digest of the pose is compared with the stored hash of the month's node
  (`graph.v1.json`); a difference stops the view with a message, hides the cube and disables the controls until the
  page is reloaded, and leaves the month sheet alone. The page publishes the digest it computed as `data-c7-digest` on `#calendar7-root`
  (with `data-c7-month` and `data-c7-state`); the browser test compares it with the graph.
- **Not in this stage:** no solver, no jump to a non-adjacent month (a jump would
  walk the chain, up to tens of thousands of moves; a month given in the URL is shown at once
  by replaying the stored edges from the chain root), no route from a solved cube, no
  sticker sheet. The page says so. The status stays **research candidate, not certified**.
- Code: `src/apps/calendar7/month-view.ts` (pure), `player.ts` (step state machine, no DOM),
  `tween.ts` (one timed move), `sticker-art.ts` (paper, inks, text fitting), `viewer.ts` (the
  WebGL scene) and `mount.ts` (DOM); tests in `tests/calendar7-mode.test.mjs`,
  `tests/calendar7-player.test.mjs` and `tests/browser/calendar7-3d.spec.mjs`. The mode uses the
  existing display, graph and engine modules and adds no new mathematics.
- **Renderer.** The view reuses the 3×3 calendar's composition, built from the exported
  size-neutral parts of `@cubistry/cube-viewer` (`PhysicalCubeScene`, presentation geometry,
  plastic and sticker materials, studio lighting, camera fitting, smart rotation). Only
  `CubeViewer` itself is limited to the size-2 print and state contract, so it is not used. One
  deviation: the bodies use one bevel segment instead of three (108 instead of 588
  triangles per body, 23k instead of 128k for the cube). The scene renders on demand: an idle
  cube draws nothing, and a frame of a turn allocates nothing.

## What this is

A 7×7×7 cube with 218 surface bodies and 294 stickers shows the month sheet of any
month on its front face: three month letters, the weekday names, and the dates,
Sunday first. The print is the **pure split, month-letter scheme A** from the
Research branch (`research/calendar-7x7/pure-split-states`):

- a month that needs a sixth week row folds it under the date seven days earlier as
  a stacked sticker (`23/30` or `24/31`); there are no overflow marks;
- the month letters sit in columns 5 to 7 for January to September and in columns 2
  to 4 for October to December;
- 240 stickers are printed and 54 are blank.

The checkers behind it (Julia `pure_chain.jl` and a Flix port) share the front rule
and a structural port of the same logic. No independent review of the 91 display
states exists yet. This is why the status stays "research candidate, not certified".

## Domain: what is covered and what is not

| Covered | Not covered |
| --- | --- |
| A chain of 576 month-to-month edges from **January 2028** to **January 2076**, one physical state kept throughout | Anything before 2028-01, in particular **2026-11 to 2027-12** (this period lies before the chain starts) |
| All 91 display types (7 start weekdays × 13 month types) occur on the chain | **2076-02 to 2099-12**: the chain does not reach 2099-12 yet; 287 more edges are still to be produced |
| The display sheets of all 888 months 2026 to 2099 | A route from a solved cube to the chain root: no practical setup route exists |
| Replay, hash equality with the research receipts, inverse restoration, front check | Shortcut or star routes: every jump would be a walk along the chain |
| | Optimizer, solver, sticker sheet or physical build instruction |

### Start state

Because there is no setup route, the start state is a **pose snapshot**: the 294
stickers are applied to the cube in the pose listed in `state.v1.json` (D-3 of the
design). The snapshot is the January 2028 root of the chain, derived by the Research
code from the print and the legal word DAG; its SHA-256 digest equals the source hash
of the chain.

## Files

| File | Content |
| --- | --- |
| [calendar7-source.json](../calendar7-source.json) | The pin: research commit, SHA-256 of every research file, Julia export and runtime file, provenance |
| `data/calendar7/research/` | Byte copies of the pinned research print, chain and Julia receipt |
| `data/calendar7/julia/` | Output of [scripts/calendar7/export-julia.jl](../scripts/calendar7/export-julia.jl): root pose snapshot and display sheets |
| `public/calendar7/state.v1.json` | The printing (piece, text, ink) and the root pose of each sticker |
| `public/calendar7/graph.v1.json` | Route graph: 577 nodes (state hash, display, month) and 576 edges (move words) |
| `public/calendar7/displays.v1.json` | 91 display sheets and the display id of each month 2026 to 2099 |
| [scripts/prepare-calendar7.mjs](../scripts/prepare-calendar7.mjs) | Pin, convert and check (Node, no Python) |
| `src/apps/calendar7/` | Pure engine, display, graph, month-view, player and tween modules (no DOM, no timers), the sticker art, the WebGL viewer and the DOM mount of the mode |
| [tests/calendar7-replay.test.mjs](../tests/calendar7-replay.test.mjs) | Full replay and negative controls, part of `npm test` |
| [tests/calendar7-mode.test.mjs](../tests/calendar7-mode.test.mjs) | Registry entry, month choice, navigation bounds, move words and mount |
| [tests/calendar7-player.test.mjs](../tests/calendar7-player.test.mjs) | Step player (digest equals the stored hash after each step, both directions, chain ends, skip, pause, reduced motion, dispose), tween, sticker art, 3D mount |
| [tests/calendar7-strict-profile.test.mjs](../tests/calendar7-strict-profile.test.mjs) | Strict profile: glyph rule (0 and O, 1 and I, 6 and 9, upright stacks, MON and FRI), agreement with the verifier reading, diagonal split-label geometry and drawing |
| [tests/calendar7-sheet-colors.test.mjs](../tests/calendar7-sheet-colors.test.mjs) | Month sheet palette: every ink on its cell at 4.5:1 in light and dark |
| [tests/browser/calendar7-3d.spec.mjs](../tests/browser/calendar7-3d.spec.mjs) | The 3D view in a browser: pose digest, animated step, controls, 375 px |

### Conventions

- 21 generators: for each axis x, y, z the layers -3, -2, -1, 1, 2, 3, then the
  whole-cube rotation (generators 7, 14, 21). There is **no layer 0** generator.
- A positive quarter turn maps `(x,y,z)` to `(x,-z,y)`, `(z,y,-x)` and `(-y,x,z)`
  about x, y and z. A layer is selected by the body position.
- A move is a generator and an exponent of -1, 1 or 2. A half turn counts once;
  rotations are counted separately.
- A word in `graph.v1.json` uses one character per move; the alphabet and index
  formula are in the file.
- The front rule of the shipped (legacy) profile is the Research rule, not appearance
  matching: O and 0, I and 1 are equal glyphs, half-turn symmetric glyphs and the pairs 6
  and 9 are accepted, and a stacked label must be upright with exactly the same text and ink.

## Rule profiles: legacy and strict

The app has two rule profiles, selected in one place: `DEFAULT_RULE_PROFILE` in
`src/apps/calendar7/profile.ts`. There is no URL parameter and no user-facing switch.

| | `legacy` (default, shipped) | `strict` (prepared, not active) |
| --- | --- | --- |
| Glyph aliases | O = 0 and I = 1 | none: O is not 0, I is not 1 |
| Equal after a turn | 0 (any turn), 1 2 5 8 H N S X Z (half turn) and 6 and 9 | only the digit 0 (any turn) and 6 and 9 (half turn) |
| Weekday labels in the print | `M0N`, `FR1` | the letters `MON`, `FRI` |
| Split labels (`23/30`, `24/31`) | upright, one line | upright, drawn diagonally |

The strict rule mirrors `research/calendar-7x7/upright-moves/verify_moves.jl` on
`research/cube-display-feasibility` (`HALFMAP` and `reading`): a sticker reads as the wanted
cell when its text and ink are equal and it is upright, or it is the digit 0 against a 0, or
its half-turn reading (reversed, 0 6 9 only) equals the wanted text at angle 2. Anything else,
including a quarter-turned letter or an O for a 0, is a mismatch. A split label stays upright
with exactly the same text and ink in both profiles.

**Diagonal split labels (strict art).** The text square is 86 percent of the sticker. The first
number sits top-left (left-aligned), the second bottom-right (right-aligned), the slash is
centered between them, all three upright. The digit ink height is 0.35 of the text square
(Noto Sans digit ink height 0.735 em, so the font size is 0.35 times the square divided by 0.735).
The slash is centered, upright and short on purpose (ink height 0.24 of the text square): the numbers
sit in the corners, so a taller slash stroke would touch them. The layout is stroke-aware: the slash is
modeled as a stroke polygon (about 0.12 em thick) and the numbers by their digit ink (side bearings
removed), and the unit test requires an ink gap of at least 0.02 of the texture (about 3.8 px at
192 px; the model gives about 5 px) to both numbers for 23/30 and 24/31. A browser check of the real
font (Chromium, 192 px) is still advisable before the switch. The pure geometry is `splitLayout` and
`splitInkGaps` in `src/apps/calendar7/sticker-art.ts`. The Noto Sans font
(OFL-1.1) is unchanged.

**What is profile-gated.** `imageNormal` and `frontFailure` in `display.ts` take the profile as
the last argument, and `drawSticker` in `sticker-art.ts` takes it as the fourth; the default is
`DEFAULT_RULE_PROFILE`. Every call in the mode (chain verification, the 3D viewer) uses the
default, so the shipped behavior, the pinned data and the existing tests are unchanged.
`monthCells` is not gated: the display sheet already uses `MON`, `FRI`, `23/30` and `24/31`.

**What is pending.** The strict print (`print-strict-upright.tsv` on the research branch)
needs its move words and chain, which are not available yet. Until then
`calendar7-source.json` stays pinned to the legacy research commit and the data in
`public/calendar7/` and `data/calendar7/` stays the legacy print and chain. Switching to strict
later is a data change (new print, graph, state and pin) plus setting `DEFAULT_RULE_PROFILE`
to `"strict"`; the legacy-print assertions in the existing tests (for example `M0N`) will then
be replaced by the strict ones in the same change. The HTML month sheet still shows split
labels on one line in both profiles.

## Verification

```sh
node scripts/prepare-calendar7.mjs --check                   # pins, copies, derived files
node scripts/prepare-calendar7.mjs --check --require-commit  # also against the research commit
node --test tests/calendar7-replay.test.mjs                  # full replay, about two seconds
```

The test replays every edge on the 294-sticker model, requires the complete-state hash
of every node to equal the Research receipt (the receipt it produces is byte-identical
to the Julia receipt), restores every edge and the whole chain by its inverse, checks
every front against the display sheet, and requires an independent month-sheet
generator to equal the Julia display table for all 888 months. Negative controls must be rejected: a flipped move, a changed generator, a rotation in
place of a layer move and a truncated move word (these four share one expected message,
"front differs", because the front is checked before the end hash), wrong declared
metrics, a wrong target hash with a correct word ("end hash differs"), a changed print,
the neighboring month as root, edges out of chain order, a node count that does not
match the edge count, a wrong display id, a month that breaks adjacency, a wrong root
display id, and a tampered display cell at the root and at an edge target. A wrong ink
and a quarter-turned plain sticker are checked through the reason of `frontFailure`, and
the pin controls only through the word "pin". The two inverse-restoration checks cannot be
falsified without corrupting the engine itself.

Regenerate the Julia exports with Julia 1.13 as in `mise.toml` and a checkout of the pinned research
commit at `$RESEARCH`:

```sh
PURE=$RESEARCH/research/calendar-7x7/pure-split-states
gunzip -c $PURE/evidence/dag-all.tsv.gz > /tmp/dag-all.tsv
julia --startup-file=no scripts/calendar7/export-julia.jl \
  $PURE /tmp/dag-all.tsv data/calendar7/research/chain-2028-2076.moves.tsv data/calendar7/julia
node scripts/prepare-calendar7.mjs
```

## Pin

The pin names the research commit `bcee891dd0d247383d5b7604f106cb76180c98d7` on
`research/cube-display-feasibility`, the merge of the pull request that stores the chain
there. Research is merged by rebase, which rewrites commit ids, so a new research commit
needs a new pin: `node scripts/prepare-calendar7.mjs --pin <commit> --branch
research/cube-display-feasibility`. The SHA-256 values of the data do not change.

## Licensing

The code (`src/apps/calendar7/`, `scripts/prepare-calendar7.mjs`,
`scripts/calendar7/export-julia.jl` and the tests) remains AGPL-3.0-or-later. The data
(`public/calendar7/`, `data/calendar7/` and the research data they come from: print,
display sheets, states, chain, move words, edges and receipts) is a separate work under
CC BY-SA 4.0, SPDX-License-Identifier: CC-BY-SA-4.0:

> Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0
> (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.

Each data directory carries a `NOTICE.txt`; see also
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
