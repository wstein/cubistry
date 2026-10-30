# 3×3 Super Picture Cube

Implementation boundary for [#117](https://github.com/wstein/cubistry/issues/117).

## Existing sources and reuse

The current Picture Puzzle Playground has a size-2 capability contract, not a classic 3×3 mode. The existing production 3×3 path is `src/apps/calendar/model.ts` and `CalendarViewer`: 54 immutable sticker identities on 26 visible bodies, including center `up` vectors. The new 3×3 Playground will offer classic colors and Super Picture artwork together, linked from the existing 2×2 page. It will reuse those mechanics and the existing rounded physical scene, materials, legal-turn animation and stationary-camera presentation. Calendar defaults and 2×2 contracts remain intact.

The shared asset loader already establishes image origin, hashing and immutable printed identity, but its static URL/manifest policy is not an upload store. Local photo decoding/cropping therefore needs a bounded local image pipeline, feeding a narrow per-sticker artwork seam in the existing 3×3 viewer. Photos must not be transmitted or embedded in static manifests.

Each source face has a fixed normal and print-up vector; image right is their cross product. Row/column coordinates select nine immutable tile IDs on that local basis, including B/L/U/D conventions. Puzzle moves transform canonical position, normal and up. Presentation rotation transforms only the rendered assembly. Crop changes update artwork, not canonical state or move history. Exact solved means every tile ID, position, normal and up matches the target, including all six centers.

## Local images and persistence

Six explicitly labeled face inputs will accept bounded raster images. Crop zoom and position are keyboard-operable numeric/range controls with a live square preview. Each face raster is 768×768 and each of its nine tiles is 256×256. Three original bundled vector example sets will be usable without uploads; no external photos, fonts or network artwork are needed.

Named sets will store photo blobs and crop metadata in IndexedDB, with a versioned schema, count/byte limits, explicit save/load/delete and actionable storage errors. A failed save must preserve the active unsaved set and existing saved data. Invalid/oversized/undecodable files must preserve the previous face. Decoded images and temporary object URLs require explicit cleanup, including stale asynchronous work and teardown. No server photo upload or automatic photo synchronization belongs in this feature.

## Exact solving boundary

The pinned production dependency `@puzlwerk/solver-3x3-picture@0.1.0` at `ffe513c43f5d622810b9a3c9aff2fac88163d0f0` is already consumed by Calendar's center planner. Its API and center-orientation contract are being audited before selecting the new Playground solver path. A regular color-solved condition is insufficient. Any enabled exact solution must replay against all canonical tile frames. If this iteration cannot supply verified exact solving, the UI must explicitly report Unavailable and link a dedicated follow-up; it must never label rotated centers solved.

## Evidence and acceptance

Deterministic tests will cover all face coordinates/UVs, legal turns, center twists, exact goals, image/crop bounds, stale/decode cleanup, storage recovery and controller state. TypeScript and production builds remain required. Browser/E2E execution and screenshots are currently paused under the earlier session restriction while the coordinator resolves #117's browser-evidence request. No screenshots or visual pass will be invented. Independent source review and owner preview acceptance remain required; no author Ready, merge or deployment.
