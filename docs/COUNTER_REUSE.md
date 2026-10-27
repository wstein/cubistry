# Existing cube code reuse audit for the 2×2 counter

Source inspection performed for Cubistry issue #18. No external issue or comment
was created. No CubeAssembler/CubeLab source was executed in this audit.

## Existing issues

- https://github.com/wstein/cubistry/issues/18 explicitly requires reuse assessment
  for the 2×2 MVP, including solver licenses, sizes, and target-display caveats.
- https://github.com/wstein/cubistry/issues/12 already requires a comparative
  CubeAssembler/CubeLab renderer audit for the older 5×5 pilot. It is not an MVP
  prerequisite. No separate dedicated reuse issue was found among the repository's
  open and closed issues at inspection time.

## CubeAssembler

Repository: https://github.com/wstein/cube-assembler
Pinned revision: d62d1715e041c6b808fcce08c597fcb4a3ce5c98
License: MIT, copyright 2026 Werner Stein (root LICENSE, also package.json).

- src/client/view3d/cubeView3D.tsx: Preact application component with orbit camera,
  layered turn animation, preferences, and UI hooks. Manual turns default locked
  through src/core/app/Preferences.res layerMovesOn(..., false), but a saved
  cookie can enable them. An MVP adapter must enforce its own policy explicitly.
- src/core/view/CubeMesh.res and cubeView3DGraphics.ts: positions, normals,
  vertex colors, occlusion, and indices; no per-sticker image UV/texture path.
  Existing cube rendering alone therefore cannot represent immutable oriented
  numeral/text images without a real sticker-image adapter.
- src/core/view/TurnAnimation.res: reusable independent camera functions
  clampPitch and viewTurn in its final view section. Original drag speed is
  0.008 radians/pixel, pitch is clamped at ±(π/2−0.05), and inertia velocity is
  clamped at ±0.006 radians/ms. The original useCubeCamera.ts caller clamps
  elapsed time to at least 8 ms. This is a useful narrow MIT adaptation for a
  Three.js renderer without importing Preact or the old application shell.
- src/core/view/CubeViewState.res: facePreset('f') gives zero yaw and pitch;
  useful for an explicit readable-front reset. Original isometric preset is
  pitch 0.52, yaw −0.74.
- src/core/view/Mat4.res: dependency-free column-major matrix functions,
  3,641 source bytes. Available if required, but Three.js already provides its
  own matrices; do not add an unused port solely to claim reuse.

Source SHA-256:

- TurnAnimation.res: 0d1ae5eb3dfa8fb0ccf18bdb171f8f6de2d0c0cc65e8de83d7fd2a82b14eff7d
- CubeViewState.res: 589129355b41888c8a4d1b944752e7972e49903e0adaba39caef648ecea8c7d9
- Mat4.res: ff39f2b5bbc724ae39ea59247526942a266a1471db4fba11a592d0c1224184fb

Keep the MIT notice and attribution with any adapted code. The repository also
bundles third-party fonts and other dependencies with their own notices; a
camera-only extraction does not require those assets.

## CubeLab

Repository: https://github.com/wstein/cubelab
Pinned revision: 89053d06df0a992acf68506d0dec5082c71dfaab
License: AGPL-3.0-or-later (root LICENSE and package.json). Root NOTICE also
identifies a GPL-3.0-or-later third-party 4×4 solver port; copying the entire
application is inappropriate for a minimal 2×2 adapter.

- src/client/cube-gl.ts: 2,601 lines, 101,053 bytes. Its CubeViewport API includes
  setScene, animateTurn, resetCamera, smoothOrbitTo, etc., but its state is
  color-facelet based and it has no sticker-image/UV input. There is free-camera
  interaction, but extensive teaching/smart-cube overlay logic is unrelated.
- src/Solver/Optimal2x2Solver.res, Canonical2x2.res, Optimal2x2Table.res and
  public/solver/optimal-2x2.v2.bin provide an actual existing 2×2 table solver.
- Table size: exactly 1,837,112 bytes: 32-byte header + packed 4-bit distances
  for 3,674,160 whole-rotation-canonical corner states. Decoder checks magic,
  version, dimensions, size, and FNV checksum. All 18 U/D/L/R/F/B HTM generators
  are considered during distance-gradient reconstruction.
- Important frame caveat: Optimal2x2Solver.solve(state) only requires the final
  canonical coordinate to be zero; the complete cube can remain globally
  rotated. Canonical2x2.rotationTokensToIdentity(finalCubies) is the provided
  correction. randomStateScrambleFromTables already appends it. A counter with
  a fixed readable front must independently replay/correct the full frame.
- The documented ≤11 HTM optimality concerns solving the ordinary color cube
  modulo whole rotations, not optimal movement to an arbitrary counter display.

## Other solver candidates and recommendation

cubing 0.66.1 has SPDX license MPL-2.0 OR GPL-3.0-or-later and npm unpacked size
2,147,445 bytes. npm integrity:
sha512-a1DShbjpyTVwoSwg7wyBjEhdvQrhh0/qtJWCzPtNtGDJ7JX18K1gwXlxA+mOVIrNbp5drnnqcmw7+ygnM5Fi6A==
Its experimentalSolve2x2x2 API runs a WASM twips solver through a worker. The
installed implementation uses generators U,F,L,R, not an R/U/F-only fixed-anchor
subgroup. Both L and R are available. Its experimental status and full-frame
replay still need to be respected.

cubejs 1.3.2 is MIT, unpacked size 100,293 bytes, but is a 3×3 two-phase solver
rather than an existing dedicated 2×2 lookup-table advantage.

For a fixed 100-target MVP, prefer the already reused cubing solver only in an
offline witness producer, then ship independently verified legal paths as a
small immutable browser asset. This avoids a 1.8 MiB database and runtime search
on every user's machine. Use the narrow MIT CubeAssembler camera-input adapter
for actual renderer reuse and a small genuine per-face sticker-image renderer.
Do not substitute a screen-space text overlay for physical sticker images.
Do not claim routes via canonical states are shortest routes to arbitrary
admissible display states.

## MVP integration

The counter ports `clampPitch` and `viewTurn` into
[`src/vendor/orbit-input.mjs`](../packages/cube-viewer/src/orbit-input.ts), preserving the
[MIT copyright/license](../src/vendor/CUBE_ASSEMBLER_LICENSE.txt). This is actual
camera-input reuse; it never changes physical cube state. Three.js 0.180.0
provides the WebGL scene, while a narrow image-sticker adapter attaches the
24 immutable source images and their fixed frames to eight real corner meshes.
This adapter is necessary because the audited renderers only have color faces.

`cubing` 0.66.1 is a development-only generator dependency. The browser does not
import its solver, workers, or tables. Instead it loads the 19,793-byte witness
asset with the fixed prints and 100 checked words. The app's production JS was
about 487 KB before compression (about 124 KB gzip) in the checked Vite build;
the witness is about 20 KB and the pinned Noto Sans Latin font is 13,496 bytes.
The CubeLab full lookup table would add 1,837,112 bytes plus runtime dependencies
without being needed for these preverified goals. Paths through a common source
state are valid and reproducible, not advertised as shortest transitions.

Three.js is MIT licensed. Noto Sans, supplied by pinned
`@fontsource/noto-sans` 5.2.10, uses the SIL Open Font License; the bundled
[font license](../public/fonts/OFL.txt) accompanies its Latin 600 WOFF2 asset.
This font supports reproducible Latin/German label text. Other scripts can use
browser fallback; their exact typography is not claimed reproducible across
operating systems. Every configured label is still rasterized once into two
fixed image halves, and both physical copies share the identical texture.
No font or image is fetched from an external service at runtime.
