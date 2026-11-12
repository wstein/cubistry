# Picture Cube (formerly Picture Puzzle Playground)

Status: the application is being widened to cube sizes 2 to 7 in a stack of four pull requests
(size control, upload and fit for every size, editor and history from the 3×3 page, solver for
2×2 and 3×3 plus redirects). Step 1 is the name and the size control: the page offers 2×2 to 7×7
and `size=2` to `size=7` in the URL, but **only 2×2 is playable**. The shared mechanics and viewer
run size 2 only. A larger size is shown disabled, and `size=3` to `size=7` keep the 2×2 with a note.
The default size is 2 for now and becomes 3 when 3×3 is playable here.

The Picture Cube is a mode of the host (`index.html?app=playground&size=2`; `playground.html` stays until it is retired). The [playground](../playground.html) combines manual legal turns, repeatable
scrambles, exact Solve, undo/redo, and move history for a physical 2×2 cube.
It is a reference application for [issue #85](https://github.com/wstein/cubistry/issues/85),
not a new renderer or general application framework.

## Behavior and physical contract

Choose Landscape pictures, Pastel Garden, a picture theme (see below) or Classic colors. Each is a separate immutable print
with eight body IDs, 24 sticker IDs, fixed local normals and up vectors, and a
complete initial physical target. Changing design or choosing Start new session
explicitly creates a new physical puzzle and clears history after the active
legal turn finishes. It never changes an old puzzle's print during motion.
Your own pictures (see "Your own pictures" below) are a further design, created in this
browser only. There is no session persistence.

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
The artwork is licensed under CC BY-SA 4.0 (see "Picture theme license" below);
the program code is AGPL-3.0-or-later, matching the repository
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

The theme images, including the original Landscape pictures and Pastel Garden, are licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), not under the AGPL
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
- `christmas`, Christmas: a gingerbread cookie, a snowman by a cottage, a reindeer under a lamp post and a teddy bear on a snowy night, with an aurora and a smiling star above and a lantern with gifts on a sled below.
- `easter`, Easter: a snail with a watering can, a bunny with an egg basket, a chick hatching from its egg and a sleepy lamb holding an egg, with an egg balloon and a kite above and a nest of eggs below.
- `halloween`, Halloween: a cat in a witch hat, a smiling pumpkin, a ghost and a hanging bat on a moonlit night, with bats and a crescent moon above and a spider, candy and pumpkins below.

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

### Your own pictures, suitability and template

The Pictures panel of [playground.html](../playground.html) (closed by default, so the controls do not
move) holds three tools. All of them run in the browser; nothing is uploaded to a server.

**Face set model.** An upload produces the same `FaceSet` as a built-in theme (`id` `upload`, six face
sources with URL, format, SHA-256 and pixel size). `sliceFaceSet`, the suitability measures and rendering
never look at where a set came from. `createDesign("upload", set)` builds the design (print
`playground_upload_<hash>_v1`).

**Upload.** PNG or SVG. Either choose six files named `F`, `B`, `L`, `R`, `U`, `D` (case-insensitive,
`F.png`, `u.svg`), or one net image in the standard cross (U above F; L F R B in one row; D below F). A
net is recognized by its 4:3 aspect (within 2 percent) and cut into six faces at the boundaries
k·width/4 and k·height/3 (PNG: rounded to whole pixels; SVG: exact user units, never rounded); cells are
stretched to square faces in both formats. Any other aspect leaves the slots as they are and asks for a manual
assignment. The six slots of a small net also accept a file each by
click, keyboard (Enter on a focused slot) or drag and drop. A face must be square. The format is decided by
content, not by file name. When all six faces are present the pictures load as the design "Your pictures";
changing or removing them starts a new session like any design change. Replacing is atomic: all files of a
selection are read first and the slots change only after the new set has loaded; a failure (an unreadable
file, a face that is too large once cleaned, a failed load) is shown in the panel and leaves the slots and the
active design as they were. Changes and "Remove my pictures" run one after another in the order made. The
print id contains a hash of the six face hashes (`playground_upload_<hash>_v1`), so different pictures never
share one.

**Limits.** 5 MB per file, 20 MB per selection, at most six files, PNG at most 4096 pixels per side
(validated from the header and again by decoding). Faces are kept at no more than 1024 pixels per side; a
PNG is always decoded and drawn again, so metadata chunks are dropped. The asset loader has a separate
in-memory path for these bytes: URLs under `/uploaded/` are never fetched; the loader recomputes the
SHA-256 against the manifest, re-applies size and signature checks and decodes through a blob URL that it
revokes right after decoding. Built-in assets keep the same-origin, hash-pinned fetch path unchanged, and an
`/uploaded/` URL without a local source fails closed.

**SVG safety.** The checks run in a Worker (`svg-worker.ts`), which is terminated after 8 seconds; all
patterns are linear-time and numeric attributes are capped at 64 characters before any pattern runs, with
regression tests that bound the time of the known pathological inputs. Uploaded SVG is untrusted. [`svg-sanitize.ts`](../packages/cube-assets/src/svg-sanitize.ts)
tokenizes it without the DOM, checks every element and attribute against an allowlist and serializes the
result again; only that output is kept, loaded through `<img>` or a blob URL, never inlined into the page,
and the loader re-checks that its bytes are in canonical sanitized form. Rejected (whole file):
DOCTYPE/ENTITY and unknown entities, processing instructions, `script`, `foreignObject`, `iframe`,
`object`, `embed`, `image` (including data: sources), `use`, `a`, animation elements, `url()` that is not
a same-document fragment, `javascript:`/`data:`/`@import`, CSS escapes, malformed or oversized input.
Stripped (reported, the rest is kept): event-handler attributes, `href` that is not a same-document
fragment on a gradient, unknown and namespaced attributes and elements, `style` elements, filters and
patterns.

**Suitability display.** For the selected design and a cube size 2 to 7 it shows a traffic light and counts,
for example "12 stickers flat, 4 identical groups, 9 rotation-ambiguous", with thumbnails of the problem
stickers. It advises only and never blocks. Each sticker is classified as flat, identical to another,
rotation symmetric (none, 2-fold or 4-fold) or a turned copy (90, 180 or 270 degrees) of another. The pure
measures live in [`suitability.ts`](../src/apps/playground/suitability.ts) and are shared with the
`--sizes` mode of `scripts/check-pastel-garden-tiles.mjs`, whose output is unchanged. Only flat stickers and flat faces set the light
(green: none; yellow: up to a quarter of the stickers; red: more, or a whole face flat). Identical, symmetric
and turned stickers are information, not errors: they are counted, with the none, 2-fold and 4-fold symmetry
numbers, and marked on the thumbnails (visible marks plus full sentences for screen readers). The playground
mechanics support size 2 only, so for larger sizes the display says that the size is not playable yet and
describes the pictures only.

**Resolution.** Advice is 100 pixels per sticker, so a face needs 200 pixels for 2×2 up to 700 pixels for
7×7. Smaller PNG faces get a warning; SVG has no such limit.

**Template.** "Download PNG" and "Download SVG" give a blank net for the chosen size with the tile grid and
the labels U, L, F, R, B, D (PNG: n·400 × n·300 pixels). The SVG passes the sanitizer unchanged and the
template can be uploaded as a net.

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
