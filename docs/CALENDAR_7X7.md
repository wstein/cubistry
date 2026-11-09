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
- Range: only the months of the proven chain, **May 2026 to December 2099**, can
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
  of the strict print (`state.v1.json`), including the letters `MON` and `FRI`.
  Letters and digits are distinct; `I` is not `1` and `O` is not `0`. The cube sits slightly turned
  so that three faces show; drag it, or use the Rotation selector and Reset view, to look
  around. The month sheet below stays the reference for what the front face must show.
- **The animated step.** Choosing the previous or next month plays the stored move word
  block by block on the cube: forward is the stored edge, backward is the inverse of the edge
  before it. A block (one or several layers of one axis, or the whole cube for `rot`) turns by the exponent
  of its moves as one animation; the engine's right-handed quarter turn is the right-handed rotation of the
  scene. The controls are **Play/Pause** (pauses after the move in flight), **Skip to end**,
  **Speed** (milliseconds per quarter turn: 100, 250, 500 ms or 1 s, default 250 ms)
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
  by replaying the stored edges from the chain root), no setup tutorial from a solved cube, no
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

## Reading and following a step

The **Orientation** control defaults to **Before moves**. The cube first turns
into its target frame using at most three free x/y rotations, then builds the
month using conjugated layer blocks. **After moves** retains the previous end
alignment, and **Stored rotations** leaves whole-cube rotations in the played
word. Orientation and middle-slice changes apply to the next step; the current
step keeps its plan through pauses and navigation interruptions.

Previous/Next show the destination and the number of actual animated moves.
This counts nonrotation blocks with the selected middle-slice setting, regardless
of notation. Whole-cube rotations are free. Alternative counts, including the
stored HTM/QTM and equivalent generator expansion, live under **Technical details**.

**Notation** selects one word: **Blocks**, **Layer moves (equivalent)** or
**Raw generators (equivalent)**. Expansions describe the same played blocks in
legal generators 1 through 21. A physical middle slice has no generator of its
own: its expansion uses a whole-cube rotation and opposite outer-layer turns.
Those algebraic rotations are marked free and are not separate animations.
Each highlighted expansion group plays together as one block.

During a step, its original source and destination stay in the active word panel,
even though the sheet already names the target month. Preview words are hidden
while that panel is active. The current group is outlined, completed groups use
secondary ink, and following scrolls only the bounded word box. Navigation first
fits the cube and controls into the studio scrollport and focuses the active
heading without another scroll. Subsequent move following preserves ancestor
scroll positions and keyboard focus. Changing notation during playback applies
to the next step so the active mapping stays fixed. Settings selected while the
viewer loads are retained. Skip, replacement navigation and failure clear the
retired highlight.

## Block moves (wide and inner-wide)

**Display layer only.** Block grouping reads the stored data (`graph.v1.json`,
generators 1 to 21, three exponents) without modifying it or its source pin. A word
is a sequence of single-layer moves and rotations. The page regroups it into
**blocks** for notation and animation; the end-of-step digest check still applies.
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
  the time of its turns. **Speed** is the time per quarter turn, the repository's Rotation Speed stops: 100 ms, 250 ms (default), 500 ms and 1 s.
  A block lasts the speed times its quarter turns (a half turn takes twice as long, as in the cube viewer's "quarter-turn" duration unit). This holds for
  single layers, wide blocks, the middle slice and whole-cube rotations (x, y, z, x2, y2, z2, wherever they sit), with the same easing. The progress line counts actual animated nonrotation moves. Skip, Pause, Previous/Next during a step, reduced motion (a step jumps to its end state) and the digest check
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
- **Three counts.** Technical details list, for each step: *layer moves* (HTM, the stored count, unchanged), *block moves without the middle
  slice* (the blocks of the previous section) and *block moves with the middle slice* (rule c). In the third count turning the middle slice
  counts as a move; whole-cube rotations stay free in all three. On the 91 root words of the research
  the layer moves total 40642 and the block moves with the middle slice 30696; on the 883 stored strict edges 103618 and 79100.
- **Playback.** The player plays rule-c blocks by default, one tween per block; a slice block is animated as a real slab turn of
  its interval including layer 0 (the camera does not move). The option **Middle slice counts as a move** (in the animation
  controls) switches back to the blocks without the middle slice for the next step; a step in progress keeps its blocks. The progress line counts the actual nonrotation blocks; rotations are named separately as free. A mismatch of the end-of-step SHA-256 still raises
  `StateMismatchError` and stops the view.
- **Not covered.** Nothing stored changes, no search in a larger alphabet, no camera rubber band, no rewriting across runs
  of different axes. Words with different groupings reach the same state, so the same digest.

## Deferred rotations and end alignment

**Display only, again.** Generators 1 to 21, `graph.v1.json`, `calendar7-source.json` and the engine alphabet do not change.
The factorization below describes **After moves**. The default **Before moves**
uses the equivalent prefix factorization: if B followed by R is the original
word, R followed by the conjugate R B R^-1 reaches the exact same full pose.
Axes, layer signs and exponents are transformed together; the words are never
arbitrarily reordered. The prefix uses only x/y turns (all 24 orientations need
at most three); software tests check every stored edge in both directions and
both slice settings, including inverse restoration. This is application
equivalence testing, not a new research proof.
Code: `src/apps/calendar7/deferral.ts` (pure) and the player. This is mode F of the research
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
  Rubber Band camera controller is untouched. It is timed and eased exactly like a single-layer turn: the Speed setting times its quarter turns is
  its duration and the view's smoothstep is its easing. The prefix follows the selected speed too: at the default 250 ms,
  a quarter turn takes 250 ms and a half turn takes 500 ms; at 1 s, they take 1000 ms and 2000 ms. There is no fixed
  one-second prefix override. The unused earlier soft-start helper has been removed. Under reduced motion a step jumps
  and needs no orientation turns; if the preference turns on while a step plays, each remaining prefix or suffix
  rotation takes 150 ms, independent of its angle and the selected speed.
- **Progress.** The free orientation is a separate prefix or suffix phase. Only
  nonrotation blocks contribute to the move count; skip and pause work in every phase.
- **Control.** **Orientation** selects Before moves (the page default), After moves
  or Stored rotations. The player class retains its stored default for compatibility;
  an explicit orientation overrides the older `defer` option.
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
- 243 stickers are printed and 51 are blank.

The joined chain is accepted by Julia `pure_chain.jl`, the Flix chain checker,
and the separately implemented Julia `upright-beam/verify_chain.jl`. These checks
replay all 883 edges against physical sticker states and calendar fronts. The
status remains "research candidate, not certified": this is retained-state replay
evidence, not a physical build certification or a claim of shortest routes.

## Domain: what is covered and what is not

The shipped strict chain covers **May 2026 through December 2099**: 884 nodes,
883 chronological edges and 103618 layer moves (HTM). November 2026 works without
URL parameters. The display table covers all 888 months in 2026 through 2099,
but January through April 2026 have no shipped physical route. Dates outside that
range, shortest routes, an optimizer, a print sheet generator and physical build
instructions are not provided.

### Data flow and the January 2028 seam

The app consumes one immutable printing and root pose from state.v1.json, one
chronological retained-state chain from graph.v1.json, and the 91 display sheets
with month-to-display IDs from displays.v1.json. The player walks stored edge
words for jumps; adjacent months play that edge or its inverse. Each completed
step checks the full 294-sticker state digest. Display identity alone cannot
replace physical state identity, and the 98 display transitions are not reusable
edges between arbitrary retained states.

Two verified Actions artifacts supply the source chains: run 42523213490,
artifact upc-chain-42523213490-s1 (May 2026 to January 2028, 20 edges, 2255 HTM),
and run 42479620239, artifact upc-chain-42479620239-s6 (January 2028 to December
2099, 863 edges, 98431 HTM). Their January 2028 digests differ. The original
artifacts and receipts stay separately pinned and unchanged.

The final window edge (December 2027 to January 2028) is derived from its original
word, the inverse of the entire window chain, the inverse of the window root
word, and the full-chain root word. Adjacent equal generators are
combined modulo four; the original window endpoint may be canceled from this
route. No state is reset or substituted. The final digest is the
full-chain root digest, after which its 863 edges are unchanged. There is one
January 2028 node. The seam costs **3057 HTM**, 2932 more than the original window
edge (125 HTM); it is intentionally long and makes no optimality claim.

The bridge generator normalizes adjacent equal generators because the independent
upright replay checker measures HTM after that normalization. An initial raw
concatenation produced equal states but inconsistent declared HTM (3334 versus
3057); only the generated word was corrected. No checker was changed. All three
unchanged checkers then replayed the normalized chain.

### Start state

The root pose snapshot is May 2026, exported by the pinned Julia research code
from the strict print and its strict root word. Its SHA-256 equals the chain
source digest. The root word gives a legal setup from the solved printing; this
app still starts with the snapshot and does not present a setup tutorial.

DEFAULT_RULE_PROFILE is global. All runtime data is strict, so it switches
globally; no date-dependent profile selection or second runtime data set exists.

## Files

| File | Content |
| --- | --- |
| [calendar7-source.json](../calendar7-source.json) | The pin: research commit, SHA-256 of every research file, Julia export and runtime file, provenance |
| `data/calendar7/research/strict/` | Original pinned research/artifact inputs, the derived joined chain and its three replay receipts |
| `data/calendar7/julia/` | Output of [scripts/calendar7/export-julia.jl](../scripts/calendar7/export-julia.jl): root pose snapshot and display sheets |
| `public/calendar7/state.v1.json` | The printing (piece, text, ink) and the root pose of each sticker |
| `public/calendar7/graph.v1.json` | Route graph: 884 nodes (state hash, display, month) and 883 edges (move words) |
| `public/calendar7/displays.v1.json` | 91 display sheets and the display id of each month 2026 to 2099 |
| [scripts/prepare-calendar7.mjs](../scripts/prepare-calendar7.mjs) | Pin, convert and check (Node, no Python) |
| `src/apps/calendar7/` | Pure engine, display, graph, month-view, player and tween modules (no DOM, no timers), the sticker art, the WebGL viewer and the DOM mount of the mode |
| [tests/calendar7-replay.test.mjs](../tests/calendar7-replay.test.mjs) | Full replay and negative controls, part of `npm test` |
| [tests/calendar7-mode.test.mjs](../tests/calendar7-mode.test.mjs) | Registry entry, month choice, navigation bounds, move words and mount |
| [tests/calendar7-blocks.test.mjs](../tests/calendar7-blocks.test.mjs) | Block moves: examples, property tests on random words (same state and digest, same multiset), identical digest for every stored edge in both directions, notation and counts on the page |
| [tests/calendar7-slice.test.mjs](../tests/calendar7-slice.test.mjs) | Middle-slice blocks (rule c): examples, independent slab-turn and exact-minimum oracles, property tests on random words, identical digest for every stored edge both ways, counts of the research (91 historical roots from `tests/fixtures/calendar7-roots91.tsv`, 883 strict edges), negative controls, the player and the page |
| [tests/calendar7-turn-timing.test.mjs](../tests/calendar7-turn-timing.test.mjs) | Speed stops (100/250/500/1000 ms per quarter turn), rotation turns equal layer turns in duration (speed x quarter turns) and easing in every orientation |
| [tests/calendar7-deferral.test.mjs](../tests/calendar7-deferral.test.mjs) | Deferred rotations and the end alignment: properties, every stored edge both ways, search of the 24 orientations, mismatch, negative controls, player phases |
| [tests/calendar7-player.test.mjs](../tests/calendar7-player.test.mjs) | Step player (digest equals the stored hash after each step, both directions, chain ends, skip, pause, reduced motion, dispose), tween, sticker art, 3D mount |
| [tests/calendar7-strict-profile.test.mjs](../tests/calendar7-strict-profile.test.mjs) | Strict profile: glyph rule (0 and O, 1 and I, 6 and 9, upright stacks, MON and FRI), agreement with the verifier reading, split-label geometry and drawing |
| [tests/calendar7-stickerless.test.mjs](../tests/calendar7-stickerless.test.mjs) | Stickerless face art and scene on a hand-made layout fixture (`tests/calendar7-fixture.mjs`) |
| [tests/calendar7-center.test.mjs](../tests/calendar7-center.test.mjs) | Strict 6 and 9: ink box centered on the sticker (also turned by a half turn); other labels and legacy unchanged |
| [tests/calendar7-sheet-colors.test.mjs](../tests/calendar7-sheet-colors.test.mjs) | Month sheet palette: every ink on its cell at 4.5:1 in light and dark |
| [tests/calendar7-schemes.test.mjs](../tests/calendar7-schemes.test.mjs) | Color scheme data: ten schemes, one default, roles present, frozen, text contrast gates and line contrast |
| [tests/calendar7-scheme-apply.test.mjs](../tests/calendar7-scheme-apply.test.mjs) | Schemes applied to the sticker and face art: every label class in all ten schemes (ground, ink, contrast), blank tiles, folded labels, weekday-row line, `schemeById` |
| [tests/browser/calendar7-schemes.spec.mjs](../tests/browser/calendar7-schemes.spec.mjs) | Schemes in the real viewer: sampled texture pixels for Paper Red, Paper Blue and Dracula, in-place redraw without new textures, stickerless body color, `?scheme=` |
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
- The shipped strict rule has no glyph aliases. Only 0 (any turn) and 6/9
  (half turn) have neutral readings; other glyphs and split labels must be upright.

## Color schemes

`src/apps/calendar7/schemes.ts` holds ten color schemes of the month sheet as plain role tokens (day fill and ink, weekday ink, weekend fill or tint and ink, band, month ink, weekday row, empty days, seam, the two lines and the SUN/SAT ink): Paper Red (default), Paper Blue, Classic, Solarized Light, Gruvbox Light, Dracula, Monokai, Gruvbox Dark, Catppuccin Mocha and High Contrast. Saturday and Sunday share one weekend token set. The 3D view applies what it can of a scheme (see below); there is no scheme UI yet. [tests/calendar7-schemes.test.mjs](../tests/calendar7-schemes.test.mjs) checks the structure and the contrast of every text pair (4.5:1; 3:1 only for the two large bold pairs of Paper Red: weekend numerals and SUN/SAT letters; the small second number of folded weekend labels uses `weekendInkSmall` at 4.5:1) and of every line against the tiles it touches, empty days included (3:1); band edges are not gated. The six third-party palettes (inspired by Solarized, Gruvbox, Dracula, Monokai, Catppuccin) are written from memory, not checked against official sources, and need a license check.

Limitation: the shipped print (`public/calendar7/state.v1.json`, 294 stickers; ink classes blank 51, dark 151, red 62, month 25, weekday 5) has one blank class, and `src/apps/calendar7/sticker-art.ts` fills by `text === ""` (`BLANK_PAPER`) versus `PAPER`. A band that runs continuously over the blank tiles of row 1, a line under row 1, or white empty days next to a colored band need a separate "band blank" tile class and therefore new print data, planned with the row-1 name layout. The 3D view applies the rest, as described next.

### Schemes in the 3D view

The default scheme is Paper Red (`isDefault` in `schemes.ts`); `?scheme=<id>` picks another one (`paper-blue`, `classic`, `dracula`, ...), an unknown or empty id gives the default without an error, and `Calendar7Viewer.setScheme(id)` (also on the mounted mode) changes it in memory. The choice is not stored between visits: the shared Appearance storage knows only construction and frame color, so a persistent choice waits for the catalog. `classic` is the sheet look of the data (cream band, brick weekend), not the print look the 3D view drew before schemes (`drawSticker` without a scheme still draws that, and `INK_COLORS`, `PAPER` and `BLANK_PAPER` stay as they were).

The mapping uses only the printed label and its ink class, never the position of a tile, because a tile is a moving object:

| Tile (label, print ink) | Ground | Ink |
| --- | --- | --- |
| digits, ink dark | `dayFill` | `dayInk` |
| MON to FRI, ink weekday | `weekdayRowFill` or `dayFill` | `weekdayInk` |
| weekend digits and folded labels, ink red | `weekendFill`, else `weekendTint` | `weekendInk`; the small second number of a folded label `weekendInkSmall` |
| SUN and SAT, ink red | `weekdayRowFill`, else the weekend ground | `sunSatInk` |
| month letters, ink month | `bandFill` or `dayFill` | `monthInk` |
| blank | `emptyFill` | none |

A scheme with `lineRow2` draws that line at the bottom edge of the weekday-name tiles (MON to FRI, SUN, SAT), `px` times 4 texture pixels thick (the texture is 192 px, a sheet tile about 48 px); on a stickerless face it sits on the bottom edge of the flat part. The folded labels keep the strict art and the 6/9 rule is unchanged. A stickerless cube takes the day fill as its body color; a sticker cube keeps the dark plastic frame.

What waits for a new print class `band` (with the row-1 name layout): the print has one blank class, so a blank tile of row 1 cannot join the month band and shows `emptyFill`, and white empty days next to a colored band are not possible; `lineRow1` (the line under row 1) is not drawn; the `seam` token is used by the sheet only (the 3D view has no drawn seam). Until then a band scheme shows its band on the month-letter tiles only.

## Rule profiles: legacy and strict

The app has two rule profiles, selected in one place: `DEFAULT_RULE_PROFILE` in
`src/apps/calendar7/profile.ts`. There is no URL parameter and no user-facing switch.

| | `legacy` (explicit compatibility profile) | `strict` (default, shipped) |
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

**Stickerless surface (3D view).** `Calendar7Viewer.configure(printing, pose, surface)` takes the surface
`"sticker"` (default, unchanged: 294 sticker bodies on 218 surface bodies) or `"face"`. With `"face"` the same scene
is built, then `PhysicalCubeScene.setConstruction("stickerless")` (the 3x3 calendar uses the same call) hides the 294
sticker meshes and gives each cubie face the label texture, so there is no sticker body and no gap between stickers;
the cut faces keep the plastic color. The face texture is the sticker art (`drawSticker`: sizes, fit, split labels,
6 and 9 rule) scaled about the center by `FACE_SCALE`. `FACE_FLAT` (0.9106) is the flat part of the body face in
texture space (checked against the real geometry); the text square of the face label is `FACE_TEXT_SQUARE` = 0.92 of
the flat face (a sticker label uses 0.86 of its sticker), so `FACE_SCALE` = 0.9106 * 0.92 / 0.86. The paper fills the
whole texture. 0.92 was picked from the candidates 0.86, 0.92 and 0.97 on the real ink of three-letter labels: it is
the largest with at least 4% of the flat width clear on every side (VEM is the tightest, 4.2%; at 0.97 it is 1.4%).
Labels of up to three letters use the unchanged fit (font 80 px reduced to the text square).

The surface is chosen by the optional top-level field `"surface"` of the state file (`parseState`): `"sticker"`
(default when absent) or `"face"`; any other value is the error `state surface must be "sticker" or "face"`. The
mount passes it to `Calendar7Viewer.configure`. The shipped `state.v1.json` has no such field and draws stickers. The
sticker print sheet is not affected. Tests: `tests/calendar7-stickerless.test.mjs` (pure drawing, geometry, scene) and
`tests/browser/calendar7-stickerless.spec.mjs` (real viewer and Noto Sans), both on the hand-made fixture
`tests/calendar7-fixture.mjs`.

**Centered 6 and 9 (strict art).** The strict rule accepts a 6 shown as a 9 turned by a half turn, so the
sticker is rotated by 180 degrees about its center and any ink offset from the center shows as twice that drift
between the two readings. The single digits `6` and `9` are therefore drawn with an alphabetic baseline at the font
size 140 px, placed from the real Noto Sans 600 ink extents so that the ink box is centered on the 192 px sticker,
horizontally and vertically (`halfTurnDigitPlacement` in `sticker-art.ts`; before, the "middle" baseline put the ink
center about 5 px above the center, so the two readings differed by about 10 px in height). Legacy, other digits,
two-digit labels, letters and split labels keep their drawing. The unit test is
`tests/calendar7-center.test.mjs`; `tests/browser/calendar7-center.spec.mjs` measures the real ink in Chromium
(at most 0.5 px off the center, upright and turned). The sticker colors are the same in both page themes.

**What is profile-gated.** `imageNormal` and `frontFailure` in `display.ts` take the profile as
the last argument, and `drawSticker` in `sticker-art.ts` takes it as the fourth; the default is
`DEFAULT_RULE_PROFILE`. Every call in the mode (chain verification, the 3D viewer) uses the
default strict profile. Explicit legacy tests remain for its historical behavior.
`monthCells` is not gated: the display sheet already uses `MON`, `FRI`, `23/30` and `24/31`.

The strict print and root words are copied unchanged from research. The HTML
month sheet still shows split labels on one line in both profiles. A printable
sticker sheet generator remains separate future work.

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

Regenerate from a checkout of the pinned research commit at `$RESEARCH`:

```sh
PURE=$RESEARCH/research/calendar-7x7/pure-split-states
STRICT=data/calendar7/research/strict
DAG=/tmp/calendar7-strict-dag.tsv
gunzip -c "$PURE/evidence/dag-all.tsv.gz" > "$DAG"
julia --startup-file=no scripts/calendar7/join-strict-chains.jl \
  "$PURE" "$STRICT/window/moves.tsv" "$STRICT/full/moves.tsv" \
  "$STRICT/moves-strict.tsv" "$STRICT/chain-2026-2099.moves.tsv"
julia --startup-file=no scripts/calendar7/export-julia.jl \
  "$PURE" "$DAG" "$STRICT/chain-2026-2099.moves.tsv" \
  "$STRICT/print-strict-upright.tsv" "$STRICT/moves-strict.tsv" data/calendar7/julia
node scripts/prepare-calendar7.mjs
```

The research checkers are pure_chain.jl (CUBISTRY_RULE=strict, PRINT DAG CHAIN
ROOT_MOVES), the pure-split Flix jar's chain command, and
upright-beam/verify_chain.jl (PRINT ROOT_MOVES CHAIN). Store the generated Julia
and Flix receipts without their startup rule-selfcheck line; they must be
byte-identical. Pin their hashes and the independent replay receipt under
calendar7-source.json generatedSources. Never relabel artifact receipts as the
joined-chain receipt. The TypeScript replay is an application regression check,
not a replacement for the Julia and Flix proof checkers.

## Pin

The strict research inputs are pinned to
8c823fe6f6e3cd3c9ecc4e5797177498944ac285. The full artifact used research ref
7b704c368e9ea497be9e3e8dd54e5b5ff761bbba. Artifact run workflow heads are separate
from those research refs and are recorded in calendar7-source.json. Its sources
bind research bytes; artifacts bind original downloaded bytes; generatedSources
bind the joined chain, generator and new receipts. The strict print SHA-256 is
4fc44606e5dcdd745647f57b3086570910b4068a48d001553f99b1625106bcab.

## Licensing

The code (`src/apps/calendar7/`, `scripts/prepare-calendar7.mjs`,
`scripts/calendar7/export-julia.jl` and the tests) remains AGPL-3.0-or-later. The data
(`public/calendar7/`, `data/calendar7/` and the research data they come from: print,
display sheets, states, chain, move words, edges and receipts) is a separate work under
CC BY-SA 4.0, SPDX-License-Identifier: CC-BY-SA-4.0:

> Created by Werner Stein with AI assistance (Codex, OpenAI). Licensed under CC BY-SA 4.0
> (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.

Each data directory carries a `NOTICE.txt`; see also
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
