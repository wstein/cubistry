# Picture Puzzle Playground

The [playground](../playground.html) combines manual legal turns, repeatable
scrambles, exact Solve, undo/redo, and move history for a physical 2×2 cube.
It is a reference application for [issue #85](https://github.com/wstein/cubistry/issues/85),
not a new renderer or general application framework.

## Behavior and physical contract

Choose Landscape pictures, Pastel Garden, a picture theme (see below) or Classic colors. Each is a separate immutable print
with eight body IDs, 24 sticker IDs, fixed local normals and up vectors, and a
complete initial physical target. Changing design or choosing Start new session
explicitly creates a new physical puzzle and clears history after the active
legal turn finishes. It never changes an old puzzle's print during motion.
There is no session persistence or upload feature.

The 18 buttons and notation field accept only R/L/U/D/F/B with an optional prime
or 2. Unsupported or mixed invalid words are rejected before motion. Keyboard
users can activate buttons or submit notation; outside controls, face letters
turn a face and Shift selects its inverse. Escape cancels after the active turn.
Manual input and undo/redo are disabled during playback or solver preparation.
The controller also rejects them with a Busy message if called directly.

Exact solved requires the original eight complete body poses and all 24 sticker
frames. Rotational equivalence classifies those same physical pieces in any of
24 proper whole-cube frames. For example, `R L'` is rotationally solved and not
exactly solved; exact Solve corrects that physical frame. Classic color symmetry
never discards piece identity or orientation. Camera orbit changes only the view.

A scramble is a recorded legal word of 1–100 HTM moves, seeded by an unsigned
32-bit integer including zero. It avoids consecutive identical faces; it does
not sample uniformly random cube states. The displayed history contains only
completed moves and their source. Half turns count as one HTM and take twice
the selected quarter-turn duration. The default is 100 ms per quarter turn.
The history cursor reports the active word prefix; turns played counts actual
committed turns, including undo and redo. A new move after undo drops the redo
branch. Undo/redo replay real inverse/original legal turns.

Scramble restart, Solve, Cancel, and a new session discard obsolete queued moves
but finish the active turn first. Solve then plans from the actual committed
pose. A generation and immutable source check reject late solver preparation.
A cancelled scramble/solve retains only its completed prefix. A viewer rejection
or endpoint mismatch freezes the controller without committing the failed turn;
the UI explicitly requires reload and shows Unknown goal badges. No recovery
pose is guessed.

## Solver capability and failure states

The app calls the existing typed
[`createCounterSolver`](../src/adapters/puzlwerk-2x2.ts) adapter without renaming or
modifying it. Its immutable PuzlWerk source/artifact pin remains in
[puzlwerk-source.json](../puzlwerk-source.json). The adapter uses the actual
`create2x2Solver` / `solve2x2` provider in `exactPhysical` mode. It checks HTM,
mode, move count and complete canonical replay. The playground independently
serializes/parses the legal returned word, replays it through shared mechanics,
and checks all eight body poses and 24 sticker frames before playback. The
committed endpoint is checked again after animation. Neither exact HTM optimality
nor a universal arbitrary picture-cube move bound is claimed.

The app-local resource callback loads the provider's module-relative TABLE_URL
once, with a 10-second AbortSignal deadline and the exact 1,837,112-byte bound.
Provider initialization authenticates its SHA-256. Failed loads can retry;
there is no runtime source fetch, alternate solver, or witness fallback.

User-facing states include Loading, Playing, Verified, Cancelled, Unsupported,
NoPath, Invalid, Timeout, and Unavailable. Actual resource failures are
Unavailable; timeout/abort deadlines are Timeout; corrupted tables and rejected
replay are Invalid. NoPath is reserved for an explicit capability/provider
failure and is covered by injection: legal reachable 2×2 sessions do not
fabricate a no-path outcome. The synchronous pinned 2×2 solve has no separately
claimed hard CPU deadline; preparation fetch is bounded.

## 3×3 evaluation: unsupported by this application

The shared `@cubistry/cube-core` validation, mechanics and `CubeViewer` runtime
support size 2. Their interfaces include topology metadata but reject size 3;
a larger number is not an implemented interactive profile. This application
therefore offers no 3×3 session, manual model, history, or viewer.

This is distinct from the pinned `@puzlwerk/solver-3x3-picture` capability already
used by Calendar. Its actual typed `PictureRequest` takes 54 URFDLB facelets,
explicit ULFRBD center orientations and optional center symmetry/depth/node
bounds; `solvePicture3x3` returns solved, unknown or invalid. Its contract asks
callers to run it in a worker with a hard deadline. Calendar provides its own
54-sticker model, bounded worker and exact-reference handling, described in
[the center-aware provider notes](calendar-center-provider.md). Reusing that
solver alone would not provide this app's complete physical IDs, target and
interactive viewer. No 3×3 center migration or unsupported claim that the
provider cannot solve oriented pictures is made here.

## Artwork and visual inspection

Six original geometric landscape illustrations use SVG shapes only: mountain
lake, moon hills, desert, forest, sky, and fish. Full faces use a 320×320 viewBox;
each sticker is a 160×160 quadrant with matching viewBox origin. The sticker's
source normal/up and face-right cross product select its row and column.
No fonts, external images, stock art, text nodes, clipping paths or external
resources are used. The authoritative generator is
[`build-playground-art.mjs`](../scripts/build-playground-art.mjs); regenerate with
`node scripts/build-playground-art.mjs`. It writes complete faces, cropped tiles
and their integrity manifest. Formatting of the generated TypeScript is cosmetic.
Copyright 2026 Cubistry contributors, AGPL-3.0-or-later, matching the repository
[license](../LICENSE). This provenance travels with the generator,
[bundled artwork notice](../public/playground/NOTICE.txt), and app footer.

### Pastel Garden design

Pastel Garden is a third picture design with the same physical contract as
Landscape pictures: its own print (`playground_pastel_v1`), 24 uniquely oriented
sticker tiles, and no quarter-turn equivalence. The left, front, right and back
faces form one continuous landscape: a shared ground profile and a winding garden
path meet exactly at every shared edge, with a dawn, day and night story around
the belt. Its front face is Sunny, the right face a garden with Pip, the top a
layered sun and moon sky with cloud kids whose edges blend smoothly into the
neighboring faces' colors (clouds tinted by the neighbor), and the bottom a
picnic meadow with Tulia and Plop, where the front face's garden path continues
as stepping stones to the blanket. The other reviewed top and bottom proposals, the
single-blue sky variant and the retired tulip meadow and pond are kept as
drafts in [`assets/playground-pastel-proposals/`](../assets/playground-pastel-proposals/up.svg)
(see also its [down sheet](../assets/playground-pastel-proposals/down.svg)) and are
not wired in. The six characters are original inventions, not modeled on
any licensed character. The art follows the same constraints as above and the
asset validator's SVG subset (no clipping paths, `url()` references or dash
patterns). The authoritative generator is
[`build-pastel-garden-art.mjs`](../scripts/build-pastel-garden-art.mjs); regenerate
with `node scripts/build-pastel-garden-art.mjs`. It writes the faces, tiles,
net preview, integrity manifest and typed asset list. Run
`node scripts/check-pastel-garden-tiles.mjs` to verify that every tile has enough
detail to place and differs from its own 90, 180 and 270 degree rotations. See the
[artwork notice](../public/playground-pastel/NOTICE.txt). Legibility at physical
sticker size has not been reviewed.

### Picture theme license

The theme images are licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), not under the AGPL
that covers the program code: "Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry."
Each theme directory carries a `NOTICE.txt` with this text, the committed
art generators are art data under the same license, and
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) lists every theme.
Pictures a user adds in the browser never leave it and stay the uploader's
responsibility.

### Picture themes

Further picture sets are registered as themes in
[`themes.ts`](../src/apps/playground/themes.ts). A theme is stored independently of
the cube size: the six whole 320×320 faces in `public/playground-<id>/` plus a
manifest and a notice, and one registry entry. The registry holds generic
`FaceSet` values (`id`, display name, optional print version, and six face sources with
URL, format, SHA-256 and pixel size), and `sliceFaceSet(set, n)` depends only on that
type, never on which set it is, so a future user upload (six images, or one net image
cut into six) only has to produce a `FaceSet`. No pre-cut tiles are stored.
`sliceFaceSet` cuts the faces into the n×n stickers of a size-n cube (ids
`F_<row>_<col>`): one image asset per sticker with a pixel `crop` of its face. The asset
loader fetches, validates and decodes each face once, shares it between its crops, and
counts crops apart from the 64 whole assets (up to 512, enough for 6·7·7 = 294 stickers).
The decoded face counts against the 8 Mpixel budget only until its last crop is cut, and
every crop counts for its own pixels. The cut is therefore loader-valid for sizes 2 to 7
(tested), but the playground can only play size 2: larger sizes need size-n mechanics,
viewer and solver, which do not exist yet. For sizes that do not divide 320 the tile edges
are rounded to whole pixels, so neighboring tiles differ by at most one pixel in width.

At size 2 each theme is its own design with the same physical contract as Pastel Garden:
print `playground_<id>_v<version>`, 24 uniquely oriented stickers, no quarter-turn
equivalence. **When a face image changes, bump the theme's `version` in `themes.ts`** so the
print id changes with the art; the model test compares each theme's face digest with
`tests/fixtures/playground-theme-pins.json` and fails if the art changed under an old
version. Each face must stay within the asset loader's 256 KiB per-file and 4 MiB per-set
limits.

The Design selector lists every registered theme. A theme's faces are fetched when it is
first selected, not at page load, and only once even if it is selected again while loading.
While a theme loads, the selector shows it, the status says so, and every control that acts
on the current puzzle is disabled, so no move is made that the finished switch would
discard. Choosing another design meanwhile cancels the pending one. A failed load keeps the
current puzzle and reports the error.

Registered themes:

- `seasons`, Four Seasons: a lamb in spring, a duckling in summer, a fox in autumn leaves and a penguin in winter around the belt, with a rainbow sun above and a picnic blanket below.
- `bremen`, Town Musicians: a donkey with a guitar, a dog with a drum, a cat with a tambourine and a rooster with a horn making music along a forest path, with a starry sky and a ribbon of notes above and a woodland path below.
- `martin`, Lantern Parade: a child, a fox, a pony and an owl with a hedgehog carry lanterns through an autumn evening, with a crescent moon and flying swallows above and fallen leaves and a pond below.
- `space`, Starry Sky: a smiling star, a rocket, a satellite and a crescent moon on a starry night, with constellations above and a rocket on a moon launch pad below.

To add a theme: copy the six faces (`F`, `B`, `R`, `L`, `U`, `D` `.svg`) and a `NOTICE.txt`
into `public/playground-<id>/`; run `node scripts/build-playground-theme.mjs <id>` to
write `manifest.json` and `src/apps/playground/theme-assets/<id>.ts` and to print the face
digest; add the entry to `themes.ts` and the digest to the pins file.
`node scripts/build-playground-theme.mjs --check <id>` verifies the generated files are
current. `node scripts/check-pastel-garden-tiles.mjs` cuts the size-2 stickers of every theme
(or of the sets named as arguments) and checks them for detail and distinct rotations;
`--sizes` also reports the same measures for sizes 3 to 7 as information. The unit tests
pin each face by SHA-256 and reject text, images, scripts, styles, gradients, filters,
clipping paths, `url()`, `data:` and `@import` content.

Actual DPR2 Chromium captures were inspected: the front mountain/lake continues
across the four correctly oriented stickers, a side illustration remains
attached to its pieces, controls remain legible, and the single canvas fits
its host at desktop and mobile widths. The app explicitly gives the canvas CSS
width/height 100% and display block because CubeViewer uses setSize with CSS
updates disabled. These are presentation checks, not physical proof claims.

- [Desktop capture](assets/playground/desktop.png), 2560×2574 pixels at DPR2.
- [Mobile capture](assets/playground/mobile.png), 780×3544 pixels at DPR2.

## Architecture learning report

| Area                     | Observation and ownership                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Declarative fields       | Design style, topology, immutable print/body/sticker IDs, local normals/up, material and image references/integrity, complete target, 24 goal frames, capability and allowed moves are data.                                                                                                                                                                                                                                                                                                                       |
| Imperative work          | App-local bounded queued words, async request generations, active-turn transaction, history entries/cursor, redo truncation and new-session lifecycle belong to Cubistry composition.                                                                                                                                                                                                                                                                                                                              |
| Physical ownership       | Shared private ReScript packages retain the accepted transitional `@cubistry/*` boundary. Their mechanics construct and validate every physical endpoint; PuzlWerk owns foundation semantics and solver capabilities. No second physical engine was introduced.                                                                                                                                                                                                                                                    |
| Reuse                    | CubeViewer, asset validation/loading, source geometry, parse/serialize/inverse moves, presentMove, canonical state equality and the existing pinned solver adapter are reused directly.                                                                                                                                                                                                                                                                                                                            |
| Counter seam friction    | Numeric target playback naturally fits Counter/Timer/Status. Free command history with inverse cursor navigation does not have those numeric goals, so this reference uses a local controller instead of forcing history into Counter playback. No generic runtime or provider extraction is included.                                                                                                                                                                                                             |
| Resource friction        | Existing solver adapter accepts an injected table callback. That seam permits app-specific bounded fetch/error behavior without changing Counter or duplicating its solver integration.                                                                                                                                                                                                                                                                                                                            |
| CubeAssembler comparison | Read-only source inspection at `d62d1715e041c6b808fcce08c597fcb4a3ce5c98` confirmed Preact `cubeView3D.tsx` composition and `useCubeTurns.ts` imperative queue/history with `finishTurn` commits. `CubeMesh.res` has positions/normals/colors/occlusion, not image UV assets. Existing CubeViewer already retains its MIT camera-input reuse. Migrating capture/preferences/gestures and color-grid state would not preserve oriented image IDs automatically. No source was copied or external checkout modified. |
| 3×3 boundary             | Calendar's actual picture provider is useful evidence, but the shared interactive physical profile and viewer remain size 2. A capability result alone cannot create the missing physical/view lifecycle.                                                                                                                                                                                                                                                                                                          |
| Recommendations only     | Consider explicit command-history and solver resource seams after comparing these reference apps. Carry full-state replay and physical transaction semantics into any later shared boundary. Compare CubeAssembler image support under identical frame tests before choosing a future renderer seam. No consolidation is implemented.                                                                                                                                                                              |

The source comparison supplements [FRAMEWORK_SOURCE_AUDIT](FRAMEWORK_SOURCE_AUDIT.md)
and [COUNTER_REUSE](COUNTER_REUSE.md); accepted architecture records are unchanged.

## Verification

Meaningful Node tests cover both designs with the real pinned provider, legal
scramble seed boundaries/inverses, immutable IDs/frames, exact vs rotated goals,
manual and scramble undo/redo chains and new branches, active-turn interruption,
stale async requests, invalid input/results, bounded resources, explicit failure
states, and frozen uncommitted viewer failures. Browser tests exercise actual
keyboard controls, both designs, authenticated solve, undo/redo, moving word
replacement, stale table loads, corrupt bytes, failed rendering, camera-only
orbit, DPR2 desktop/mobile containment and resource errors. A static Pages test
checks chooser navigation and image/table paths under `/cubistry/`.

```sh
node tests/playground-model.test.mjs
node tests/playground-controller.test.mjs
npm run check
CI=1 npm run test:e2e -- tests/browser/playground.spec.mjs tests/browser/counter.spec.mjs
CI=1 npm run test:pages
CI=1 npm run test:pr-preview
```

Existing Python regression commands in `npm run check` remain unchanged and are
reported as regression gates, not authoritative proof confirmation. This change
introduces no proof certificate and no new Python verifier.

The branch began at freshly fetched main `3a7eaa5887ac12c7b0a9827465b004c5bc26ce4b`,
which already contained the human-merged Status/Quality work from PR #86.
No PR #86 worktree or feature branch was modified. Chooser/Vite/README/test edits
extend that actual main; human rebase remains the preferred merge strategy.
