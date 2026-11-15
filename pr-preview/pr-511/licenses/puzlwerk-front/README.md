# Front-goal 3x3 solver (ReScript)

Private source package `@puzlwerk/solver-3x3-front@0.0.0`, not an npm publication. It finds a shortest route, in
half-turn metric (HTM), that makes the front face of a 3x3x3 show accepted stickers at all nine positions after a free
whole-cube rotation, optionally with the center picture upright. It is a ReScript port of the Cubacle front-goal engine
(`wstein/cubacle`, `solve_front_goal`, ABI 3 export `cubacle_front_solve`). No WebAssembly is involved.

Scope: this package is the solver only. The goal codec and evaluator of the `front-image-classes` registry entry
(protocol minor 1.2, [solver-stream.md](../../specs/001-core-foundation/contracts/solver-stream.md) sections 2.3 and 3.3)
are task T013a and are **not** part of this package or its pull request. The consumer adapter that builds the nine accepted
lists from a pose is a separate change.

## API

```js
import { solveFront3x3, solveFrontText } from "@puzlwerk/solver-3x3-front";
```

`solveFront3x3(request)` is synchronous. Run it in a worker; the host can also terminate the worker.

| Field | Meaning |
| --- | --- |
| `facelets` | 54 letters `URFDLB`, layout U0-8 R9-17 F18-26 D27-35 L36-44 B45-53, row-major, centers home |
| `centerTwists` | six numbers 0 to 3 for U R F D L B; their sum has the parity of the corner permutation |
| `accepted` | nine nonempty lists, front positions row-major (facelets 18 to 26), of home facelet numbers 0 to 53 |
| `centerUp` | the front center twist must be 0 after the final rotation |
| `tableMs` | table build budget in ms, 0 = none (text interface: 0 = 3000) |
| `searchMs` | search budget in ms, read every 65,536 nodes (default 4000) |
| `maxNodes` | search node cap (default 5,000,000); the node that crosses the cap is counted (cap n reports n + 1) |
| `maxMoves` | deepest route looked for (default 21) |
| `onProgress`, `cancel` | see Progress and cancel |

Results (`status`): `ok` (`moves`, `rotation`, `nodes`, `tablesMs`), `noRoute` (none within `maxMoves`, or the goal is
unsatisfiable), `searchBudget` (`nodes`), `tableBudget` (`permille`), `cancelled` (`stage` `tables` with `permille`, or
`search` with `nodes`), `invalid` (`reason`). Budget answers carry no partial route.

`solveFrontText(line, options)` is the text interface of the Cubacle export: nine TAB separated fields
`version(1) facelets twists accepted centerUp table_ms search_ms max_nodes max_moves`, answer `[status, text]` with status
0 ok (`1 TAB moves TAB rotation TAB nodes TAB tables_ms`), 1 bad input, 2 no route, 3 search budget (`nodes=`),
4 table budget or table build cancelled (`permille=`), 5 search cancelled (`nodes=`; not in the Rust export).

## Algorithm (the Rust engine's definition)

- Goal: 24 views, one per whole-cube rotation, in the order of the rotation words (identity first, breadth first over
  `x y z`). A view gives, per constrained slot, the accepted (piece, orientation) pairs; impossible views, duplicates (first
  kept) and views whose center twists cannot match the corner parity are dropped. `centerUp` conditions the front center
  twist; the final rotation is the first rotation whose own view the end position meets.
- Rotation words: `x` turns like R, `y` like U, `z` like F, tokens applied left to right. The 24 rotations are spelled with at
  most two tokens (suffix `'` or `2`): the first word in the order empty, `x x2 x' y y2 y' z z2 z'`, then pairs in that order, that has
  the same effect.
- Groups9 tables: nine tables of four tracked cubies, 24^4 one-byte entries each (breadth first distance from the abstract
  goals, all 18 turns), plus a 4096-entry table of the six center twists when a view conditions them. Cubies are ranked per
  orbit by the sum over views and constrained slots of 1 / (pieces the slot accepts), ties by lower piece number (not the
  ranking of the research code). Groups: C0-3, C4-7, E0-3, E4-7, E8-11, C0 C1 E0 E1, C2 C3 E2 E3, C0 C1 C2 E0, E0 E1 E2 C0.
- Search: IDA* from the largest table value at the start up to `maxMoves`; turn order U R F D L B with quarter, half,
  counterclockwise; a face may not follow itself, and of two opposite faces U, R, F come first. The first goal leaf is the
  answer. Nothing is cached between calls.

## Progress and cancel

- `onProgress({stage: "tables", permille})` is called while the tables are built (strictly rising, last value 1000) and
  `onProgress({stage: "search", nodes, depth})` every 65,536 nodes. Returning `false` cancels. A start that already meets the
  goal builds nothing and reports nothing.
- `cancel` is an `Int32Array` (a `SharedArrayBuffer` view in a worker); a nonzero first element cancels. It is checked every
  4096 steps of the table build and every 65,536 nodes of the search, together with the deadline. The search deadline is not
  read earlier than the first 65,536 nodes, so `searchMs: 0` still searches that far.
- A synchronous call cannot be interrupted from its own thread: use the callback or the flag from inside, or terminate the worker.
- The node counter is a float, exact to 2^53 nodes (no 32-bit wrap); not tested beyond 2^31 nodes (hours of search).

## License and provenance

AGPL-3.0-or-later (`LICENSE`, `COPYING`). `NOTICE` names the Cubacle revision the port follows and retains the MIT notice of
min2phase (Chen Shuang) that the Cubacle cubie model derives from; `provenance.json` lists the ported Rust sources with SHA-256.

## Data and checks

- `res/FrontData.res` (turn tables, rotation tables, rotation words) is generated by `node tools/gen-front-data.mjs`
  from `tools/front-model.mjs`, an independent derivation from the facelet geometry; `test/front-solver.test.mjs` regenerates it
  and compares.
- The test uses 183 cases and the answers of the Cubacle ABI 3 export (`test/fixtures/front-solver/`, provenance in the
  first record of each file): status, route, final rotation and node counts are identical for all 183 cases. It also replays
  routes with an own cube model, checks optimality by an own depth-first search on short routes, budgets, request checks,
  progress and cancel.

## Differences from the Rust engine

1. A group coordinate is a flat index stepped by two 576-entry pair tables, not four packed digits (same distances and nodes).
2. The child bound stops at the first table that reaches the remaining depth (same decisions and nodes, fewer table reads).
   The internal `unstable_setLazyBound(false)` (not in the types, for measurement and tests) reads all nine like Rust.
3. The node counter is a float; the cap is not clamped.
4. The reason text of a no-route answer differs from the Rust text; the status is the same.
5. Progress and cancel of the search, and status 5, are additions; the table observer follows the Rust observer.

Build: `npm run build` (ReScript 12.3.1, about 0.4 s for this package). Emitted ES modules: 57.5 KB raw, 12.8 KB gzip,
11.4 KB brotli, plus 9.6 KB of ReScript runtime modules.

Measured on Node 22, 183 cases, one process (Cubacle WASM in parentheses): table build median 81 ms (72 ms), search median
0.1 ms (0.12 ms) and maximum 44 ms (76 ms) with the early-exit bound, first solve in a fresh process 120 ms (135 ms), peak RSS
110 MiB (89 to 99 MiB). In headless Chromium the tables take 84 ms (72 ms).
