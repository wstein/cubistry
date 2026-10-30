# 3×3 Super Picture Cube

Source and acceptance boundary for [#117](https://github.com/wstein/cubistry/issues/117), delivered in Draft [PR #118](https://github.com/wstein/cubistry/pull/118).

## Existing sources and reuse

The original Picture Puzzle Playground has a size-2 capability contract. The new `picture3.html` page offers classic colors and Super Picture artwork together, linked from that 2×2 page. Its canonical 3×3 mechanics remain `src/apps/calendar/model.ts`: 54 immutable sticker identities on 26 visible bodies, including center `up` vectors. No size-3 support is invented in the size-2 core.

`CalendarViewer` accepts optional per-sticker artwork and pixel refreshes. Calendar's default glyph path remains intact. The new page reuses its rounded physical scene, construction controls, legal-turn animation, stationary camera and presentation-only reset. Image edits and appearance changes preserve canonical state, history and active layer pivots. The shared static asset loader's immutable-image conventions inform the design; its static URL/manifest transport policy is not bypassed to store uploads.

Each source face has a fixed normal and print-up vector; image right is explicitly `cross(up, normal)`. Row/column coordinates select nine immutable tile IDs on that local basis, including B/L/U/D conventions. Puzzle moves transform canonical position, normal and up; presentation rotation transforms only the rendered assembly. Exact solved requires every tile identity, position, normal and up, including all six centers. Classic colors intentionally retain the same exact physical goal.

Restore via history verifies and plays the inverse of the applied history prefix through legal moves. It preserves the redo path and pictures; cancellation finishes the active legal turn and leaves a coherent cursor. It does not teleport the cube or reset presentation. Solve is a separate, replay-verified route.

## Local images and persistence

Six labeled inputs accept PNG, JPEG or WebP raster images; uploaded SVG and remote URLs are unsupported. Zoom and horizontal/vertical position controls are keyboard-operable, with live face/cube previews. Canonical image frames are 768×768 and the nine tiles are 256×256. Three original AGPL-3.0-or-later vector example sets live in `src/apps/picture3/presets.ts`; they need no external photos or fonts.

Limits are 8 MiB per source, 32 MiB per active set, 16 megapixels and 8192 pixels per source side. Headers are checked before decoding. Serialized decoding and aspect-preserving resizing bound retained sources to at most 1536 pixels per side, including EXIF-oriented photos. Full-set replacement temporarily retains both old and staged rasters to make failure atomic; browser decoder/GPU overhead varies. Image/canvas resources are closed or released on replacement and permanent teardown. Trusted preset object URLs are always revoked. Stale upload/set/preset work cannot replace a newer choice.

Named sets store original raster blobs and crop metadata in IndexedDB, with a versioned schema, explicit save/load/delete, and limits of 10 sets / 64 MiB. Saving the same name replaces that saved set only after its transaction commits. A failed save or decode preserves current unsaved pictures and existing saved data. Blocked/private-mode/quota errors have retry guidance; editing remains available when storage is unavailable. Reload lists saved sets for explicit loading. Nothing is automatically uploaded, synchronized or put into URLs/localStorage. Back/Forward cached pages retain unsaved photos, crops and puzzle state; permanent navigation releases resources after any active turn settles.

## Verified exact solving

The accepted dependencies already provide the required pieces: the existing Calendar transition adapter's `toPattern` maps ordinary cubies for `cubing/search`, and pinned `@puzlwerk/solver-3x3-picture@0.1.0` at `ffe513c43f5d622810b9a3c9aff2fac88163d0f0` supplies center-kernel references. Calendar's front-only center symmetry is not reused as a six-photo goal.

A dedicated worker aligns the physical center frame, solves ordinary pieces, measures all six residual center orientations in ULFRBD order, and applies the **inverse** of the reference word. The reference constructs zero→residual; applying it forward would double quarter-turn twists. Both worker core and caller replay the complete route against all 54 immutable frames before playback. The existing adapter's type declaration now describes its already-exported `toPattern`; no solver algorithms, tables, provider pins or research data change.

The caller enforces a 20-second hard deadline, termination/cancellation and a 400-move route cap. Errors/timeouts report Unavailable/Timeout and preserve the puzzle. The provider's maximum reference length is 286 outer HTM; correction routes can be long. No optimality or guaranteed completion-time claim is made. Exhaustive replay of the finite 2048-state even-parity center kernel verifies references and inverse restoration; this is conformance evidence, not a shortest-path or SAT proof.

## Reproducible checks

Run `npm run setup` once, then:

- `node --test tests/picture3-*.test.mjs tests/viewer-rendering.test.mjs tests/favicon.test.mjs`
- `node tests/picture3-center-replay.mjs` (standalone exhaustive center conformance, outside the default unit suite)
- `npm test`, `npm run typecheck`, `npm run build`
- `VITE_BASE_PATH=/cubistry/ npm run build` then `node tests/picture3-assets.mjs dist /cubistry/`
- `VITE_BASE_PATH=/cubistry/pr-preview/pr-118/ npm run build` then `node tests/picture3-assets.mjs dist /cubistry/pr-preview/pr-118/`

The artifact audit parses emitted entry resources and executes the actual compiled solver worker plus nested ordinary-solver imports under a Node shim, independently replaying seed 44 / 20 moves. This is static/Node packaging evidence, not a browser run. The two existing/new worker graphs currently emit separate vendor chunks of approximately 1.24 MB each; the new page loads its own worker graph only when Solve is requested. The canonical 2×2 table is not duplicated. Exact-head results belong in the PR evidence.

## Pending browser and owner acceptance

The earlier session restriction on E2E/browser execution remains in force pending coordinator clarification of #117's screenshot/browser request. No browser tests, screenshots or visual pass are claimed. Deterministic tests cover six-face landmarks, center twists, real dependency solves, frame alignment, decoded bounds, stale work, object URLs, transactional storage, legal restore/cancel and cached-page lifecycle. Independent source review does not replace owner visual acceptance.

Owner preview checks remain: all three presets on all six faces; six different photos including portrait/EXIF images; zoom/position with keyboard and pointer; B/D orientation and seams after turns; edits while scrambled; classic/picture construction; named save/reload/delete; invalid files and full/unavailable storage; Back/Forward recovery; legal scramble/undo/redo/restore/cancel; exact Solve including center-only twists; narrow/wide layouts, focus labels and status announcements. Browser regression runs and requested screenshots remain outstanding until policy permits them. Keep the PR Draft; no author Ready, merge or deployment.
