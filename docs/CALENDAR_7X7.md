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
  defined below) in a collapsible block, and the same word as block moves (see
  [Block moves](#block-moves-wide-and-inner-wide) and
  [the middle slice](#middle-slice-blocks-rule-c), a display layer only).
- **The 3D view (stage 2).** The studio scene shows the cube with its 218 surface bodies
  and 294 stickers in the pose of the displayed month. A sticker shows the text and ink
  of the print (`state.v1.json`), so the stickers read as printed (the print uses the digits
  `1` and `0` where the sheet shows `I` and `O`, for example `FR1`). The cube sits slightly turned
  so that three faces show; drag it, or use the Rotation selector and Reset view, to look
  around. The month sheet below stays the reference for what the front face must show.
- **The animated step.** Choosing the previous or next month plays the stored move word
  block by block on the cube: forward is the stored edge, backward is the inverse of the edge
  before it. A block (one or several layers of one axis, or the whole cube for `rot`) turns by the exponent
  of its moves as one animation; the engine's right-handed quarter turn is the right-handed rotation of the
  scene. The controls are **Play/Pause** (pauses after the move in flight), **Skip to end**,
  **Speed** (0.5× to 8×, default 2×; nominal 90 ms per block at 1×, so 8× is about one frame per block when the display keeps up, otherwise it can equal 4×)
  and the option **Middle slice counts as a move** (on by default, see below) and **Reset view**. Previous or
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

## Block moves (wide and inner-wide)

**Display layer only.** The stored data (`graph.v1.json`, generators 1 to 21, three exponents)
and the legacy behavior are unchanged: a word is still a sequence of single-layer moves and
rotations, the digest check after a step is unchanged, and `calendar7-source.json` is
untouched. The page regroups the word of a step into **blocks** for the notation and the animation.
Code: `src/apps/calendar7/blocks.ts` (pure).

- **Why it is safe.** Moves about one axis commute (they turn disjoint layers about the same
  axis). So inside a maximal run of consecutive single-layer moves about the same axis the moves may be
  reordered, and moves with the same exponent on layers that are next to each other may turn together. The
  grouping keeps the multiset of (axis, layer, exponent) of every run exactly: nothing is cancelled,
  added or rewritten, so playing the blocks reaches the same state, hence the same SHA-256 digest, as the word.
- **Block.** An axis (`x`, `y`, `z`), a range of layers `lo..hi` on one side of the middle, and one exponent for
  all of its layers. Layers are -3, -2, -1, 1, 2, 3; layer 0 is never turned alone, so -1 and +1 are
  not neighbors (a block across the middle would turn layer 0 too, which no word does).
  Kinds: `single` (one layer), `outer-wide` (several layers including the outer layer -3 or +3, for example
  the `3Rw`-style turn of the three outer layers on one side) and `inner-wide` (several layers, inner only:
  -2..-1 or +1..+2). A whole-cube rotation is its own block of kind `rotation`: it is free as before, and it ends a
  run (nothing is merged across it). Same exponent means the same physical turn of every layer in the block: the engine's
  quarter turn is the same positive rotation about the axis for every layer.
- **Grouping.** Per run and exponent (in order of first appearance), round r takes the layers that turn more than r
  times and splits them into ranges of neighbor layers, lowest first. This is the smallest number of blocks for the run.
  The function is deterministic: `groupBlocks(word)` gives the blocks, `expand(blocks)` the word of single-layer
  moves they stand for (state-identical to the original word, another order inside each run).
- **Notation.** Axis, layers, turn: `x-3` one layer, `x-3..-1` the layers -3 to -1 together (outer-wide),
  `y+1..+2'` the inner layers +1 and +2 together (inner-wide), `zrot` the whole cube. The turn is empty for a positive
  quarter turn, `'` for a counter-clockwise one (exponent -1) and `²` for a half turn. Single-layer and rotation tokens
  are the same as in the move word; only ranges are new. The raw generators (`g<generator>:<+1|-1|2>`) and the
  move word in the notation of single layers stay visible next to the block word.
- **Two counts** (a third one with the middle slice follows in the next section). *Layer moves* (HTM) is the existing count: every layer of every block counts once, a half turn once,
  rotations not at all. *Block moves* counts one per non-rotation block. For the same step block moves never exceed layer moves;
  whole-cube rotations are counted separately and stay free, as today.
- **Animation.** The player plays one block as ONE tween: every layer of the block turns together by the same angle in
  the time of one move (90 ms at 1x, the speeds 0.5x to 8x are unchanged). The progress line reads
  `block k of n`. Skip, Pause, Previous/Next during a step, reduced motion (a step jumps to its end state) and the digest check
  at the end of every step are unchanged and work on blocks; `StateMismatchError` still stops the view.
- **Not covered.** No change to the stored words, to the chain or to the metrics in the graph; no search for shorter
  words (merging only regroups what the stored word already contains); no merging across a rotation or across the middle layer (the next section lifts both limits as an opt-in).
  How much a different word choice could save is measured separately in the research branch.

## Middle-slice blocks (rule c)

**Display only, like the blocks above.** `graph.v1.json`, generators 1 to 21, `calendar7-source.json`, the solver and the
chain are not touched, and there is no new generator. Code: `groupBlocks(word, { slice: true })` in
`src/apps/calendar7/blocks.ts` (the call without the option keeps the behavior of the previous section).
The measurement behind it is `research/calendar-7x7/wide-blocks` (research pull request 346, rule c).

- **Physical layers.** The cube has the layers -3 to +3 on every axis; layer 0 exists (28 stickers) but no generator turns it
  alone. A block may be any interval of the layers -3..+3 that contains layer 0, for example `x0` (the middle slice), `x-3..0`
  or `y-1..+2`. An interval of all seven layers is a whole-cube rotation and stays free.
- **Why it is the same state.** The slab turn of an interval I by the exponent q equals the whole-cube rotation by q followed
  by the opposite turns (-q) of the layers outside I (at most two intervals, neither contains layer 0). So
  `expand` of a slice block is a word of generators 1 to 21 and the digest check after a step is unchanged.
  The research verified this identity with equal digests for 773 words, and the tests here check it against an independent
  slab-turn implementation for every interval, axis and exponent.
- **Grouping (exact minimum).** In this mode a run is a maximal sequence of moves about one axis, rotations of that axis included
  (they commute with its layers); a rotation about another axis ends it. The run is replaced by the fewest intervals (any exponent,
  nested allowed) whose turns add up to the same net exponent per layer, where seven-layer intervals are free rotations. It is
  the exact minimum (Dijkstra over the 4^7 states of one axis; a plain breadth-first search in the tests agrees on random
  runs); among plans with the fewest blocks, one without an added rotation wins (a rotation is only in the plan when it saves a block, or the run itself contains one), then the narrower blocks. Opposite turns of one layer cancel, so the multiset of the moves is **not** kept, only the state.
- **Notation.** The same as for blocks, with layer 0 allowed in the range: `x0` the middle slice, `x-3..0` the layers -3 to 0,
  `y-1..+2'` the layers -1 to +2 counter-clockwise, `z-2..0²` a half turn. Kind `slice` in the code. Rotations are `xrot` and so on, as before.
- **Three counts.** The page shows, for each step: *layer moves* (HTM, the stored count, unchanged), *block moves without the middle
  slice* (the blocks of the previous section) and *block moves with the middle slice* (rule c). In the third count turning the middle slice
  counts as a move; whole-cube rotations stay free in all three. On the 91 root words of the research
  the layer moves total 40642 and the block moves with the middle slice 30696; on the 576 stored edges 75433 and 52594.
- **Playback.** The player plays rule-c blocks by default, one tween per block; a slice block is animated as a real slab turn of
  its interval including layer 0 (the camera does not move). The option **Middle slice counts as a move** (in the animation
  controls) switches back to the blocks without the middle slice for the next step; a step in progress keeps its blocks. The progress line
  reads `block k of n` in both modes (n counts the rotation blocks too, unless the rotations are deferred, see the next section). A mismatch of the end-of-step SHA-256 still raises
  `StateMismatchError` and stops the view.
- **Not covered.** Nothing stored changes, no search in a larger alphabet, no camera rubber band, no rewriting across runs
  of different axes. Words with different groupings reach the same state, so the same digest.

## Deferred rotations and end alignment

**Display only, again.** Generators 1 to 21, `graph.v1.json`, `calendar7-source.json` and the engine alphabet do not change.
Code: `src/apps/calendar7/deferral.ts` (pure), `soft-start.ts` (the easing) and the player. This is mode F of the research
(`research/calendar-7x7/wide-blocks`, research pull request 346), where the equality of the three digests was verified.

- **The played word has no whole-cube rotation.** A rotation R followed by a layer move m is the same as the conjugate move
  m' = R^-1 m R followed by R. So the page walks the stored word, keeps the product R of the rotations seen so far, and plays
  every later layer move as its conjugate (the same turn of the same slab, named in the frame the cube has by then: axis k, layer
  s times L, exponent s times q, where the sign s = +1 or -1 is the single nonzero entry of row a of R). Nothing is merged,
  cancelled or added, so the number of layer moves (HTM) is exactly that of the stored word. The rule-c grouping of the previous
  section is applied to that word, and the rotation blocks it still forms (a free rotation next to a block) are deferred the
  same way, on the blocks (an interval lo..hi becomes -hi..-lo when s = -1). All rotation components add up to one net rotation.
- **Intermediate orientation.** Between the start and the end of a step the cube may be oriented differently from the stored
  frame. That is accepted: a step starts and ends in the stored frame, and the digest is checked only there. A step without
  stored rotations and without rule-c rotations has no alignment.
- **The alignment.** At the end of the layer blocks the player compares the shown state with the stored target of the step, for
  each of the 24 whole-cube orientations, by SHA-256 digest. Exactly one orientation turns the state into the target (the 294
  stickers are all distinct); it is the product of the deferred rotations, and the tests check that. No match, or a second one,
  raises `StateMismatchError`, as for a wrong digest before. Only after the alignment is the end-of-step digest checked.
- **The alignment is not a move.** It is a free whole-cube rotation, like every rotation before: it adds nothing to the layer
  moves (HTM) or to the block moves (with or without the middle slice), which count the layer blocks only. The page shows it apart:
  `Alignment: x+, y2` (the rotations in the order they turn, `+` a quarter turn in the engine direction, `-` the opposite, `2` a
  half turn) or `Alignment: none`. At most two rotations are needed; the words are chosen deterministically (fewest rotations,
  then fewest quarter turns, then the order x, y, z with exponents +1, -1, 2).
- **Animation.** The alignment is a rotation of the model (all bodies turn about their axis), not a camera move; the Smart
  Rubber Band camera controller is untouched. It uses its soft start, the critically damped response
  x(t) = x0 e^(-rt) (1 + rt + (rt)^2 / 2) with r = 9 per second, ending when less than 1 mrad is left (about 1.3 s for a quarter
  turn at 1x; the speed setting scales the time). The cube viewer exports no pure function for it, so the formula is repeated in
  `soft-start.ts` and a test compares the rate with `ROTATION_TUNING.returnRate`. Under reduced motion a step jumps and needs
  no alignment; if the preference turns on while a step plays, the alignment takes 150 ms per rotation (up to 300 ms).
- **Progress.** `block k of n` counts the layer blocks. The alignment is a final phase after block n, shown as
  `aligning the cube at the end (x+, y2)`; skip and pause work in it.
- **Control.** The option **Align at the end** (on by default) switches the deferral off for the next step; the player class itself
  defaults to the stored behavior (`defer: false`).
- **Tests.** `tests/calendar7-deferral.test.mjs`: seeded random words with many rotations and every stored edge in both
  directions, in both groupings (no rotation entry, unchanged layer moves, the found alignment equal to the product of the removed
  rotations, equal pose and digest), the search finding exactly one of 24, the mismatch cases, negative controls (a wrong rotation,
  a wrong conjugation sign, a dropped alignment), the player phases. The scene test checks the tween end pose to 1e-6.

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
| [tests/calendar7-blocks.test.mjs](../tests/calendar7-blocks.test.mjs) | Block moves: examples, property tests on random words (same state and digest, same multiset), identical digest for every stored edge in both directions, notation and counts on the page |
| [tests/calendar7-slice.test.mjs](../tests/calendar7-slice.test.mjs) | Middle-slice blocks (rule c): examples, independent slab-turn and exact-minimum oracles, property tests on random words, identical digest for every stored edge both ways, counts of the research (91 roots from `tests/fixtures/calendar7-roots91.tsv`, 576 edges), negative controls, the player and the page |
| [tests/calendar7-deferral.test.mjs](../tests/calendar7-deferral.test.mjs) | Deferred rotations and the end alignment: properties, every stored edge both ways, search of the 24 orientations, mismatch, negative controls, soft start, player phases |
| [tests/calendar7-player.test.mjs](../tests/calendar7-player.test.mjs) | Step player (digest equals the stored hash after each step, both directions, chain ends, skip, pause, reduced motion, dispose), tween, sticker art, 3D mount |
| [tests/calendar7-strict-profile.test.mjs](../tests/calendar7-strict-profile.test.mjs) | Strict profile: glyph rule (0 and O, 1 and I, 6 and 9, upright stacks, MON and FRI), agreement with the verifier reading, split-label geometry and drawing |
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
| Split labels (`23/30`, `24/31`) | upright, one line | upright, big first number and small second number (no slash) |

The strict rule mirrors `research/calendar-7x7/upright-moves/verify_moves.jl` on
`research/cube-display-feasibility` (`HALFMAP` and `reading`): a sticker reads as the wanted
cell when its text and ink are equal and it is upright, or it is the digit 0 against a 0, or
its half-turn reading (reversed, 0 6 9 only) equals the wanted text at angle 2. Anything else,
including a quarter-turned letter or an O for a 0, is a mismatch. A split label stays upright
with exactly the same text and ink in both profiles.

**Split labels (strict art).** The label text stays `23/30` and `24/31` in the data and the print;
only the drawing changes, and only in the strict profile (legacy keeps one line). The first number is
drawn at the normal two-digit size (110 px on the 192 px texture, the same size as any other two-digit
label), centered, and lifted so that its digit ink is centered 18 px above the sticker center. The second
number is small (50 px), right-aligned at x = 178 with its baseline at y = 178, so it sits in the lower
right with a margin of at least 14 px. No slash is drawn, and both numbers are upright (no rotation).
The pure geometry is `splitLayout` and `splitInkGap` in `src/apps/calendar7/sticker-art.ts`; the unit test
requires the normal size, the lift, the lower-right alignment with margins of at least 12 px and a gap of
at least 0.0625 of the texture (12 px) between the numbers. The browser spec
`tests/browser/calendar7-split-label.spec.mjs` draws the real Noto Sans 600 in Chromium and measures the
real ink on the canvas: the gap is about 23 px for `23/30` and about 24 px for `24/31`, and it requires
at least 12 px of gap and 10 px of margin. The Noto Sans font (OFL-1.1) is unchanged.

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
