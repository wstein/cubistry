# M1 acceptance: live existing solver and independent library consumer

This focused delta depends on [PR #20](https://github.com/wstein/cubistry/pull/20)
and uses its actual ReScript core and TypeScript viewer unchanged. Its stacked
base is `feat/18-two-by-two-counter` at
`e9ded21852d79a0a7382f027c3c185572013c913`. It does not merge or rewrite that PR. Its later Web Crypto fix `507fb46` is
mirrored with an ordinary cherry-pick so this head also gives actionable
localhost/HTTPS guidance; the temporary duplicate dependency patch is explicit.
The [requirements snapshot](../research/m1-acceptance/requirements.json) records
[issue #21](https://github.com/wstein/cubistry/issues/21) at
**2026-10-27T15:59:51Z**, including body/comment digests. The latest five-point
DoD and Codex handoff take precedence over older broad research proposals.

## What runs

The regular counter retains its fast, independently verified fixed witness
paths. A separate acceptance page closes the live-solver gap: choose a value,
call the existing `cubing@0.66.1` solver, execute its newly computed moves on the
shared physical state, verify the complete state and front target, then inspect
the real rendered stickers. No new search, renderer or physical engine is added.

The [thin adapter](../src/adapters/cubing-2x2.ts) extracts the already-used KPuzzle
position/orientation correspondence from the preserved
[offline generator](../research/counter/generate.mjs). It calls
`experimentalSolve2x2x2` twice: start to its reference state, then the inverse of
target to reference. Each result must solve in the exact physical frame. The
combined path must replay to the full target through both cubing and the shared
ReScript mechanics. The target completion comes from the preserved witness;
the adapter does not search for an unknown partial image goal or independently
rotatable sticker states. Neither this path nor its display length is claimed
optimal. The adapter is outside core, mechanics and viewer.

The start is always the original immutable padded print after
`R U F2 L' D B`. Fixed representative goals are **00, 07, 42, 58 and 99**. Their
complete states remain defined by the preserved proof. The newly computed
[saved paths](../research/m1-acceptance/live-solver-output.json) and
[independent result](../research/m1-acceptance/independent-replay.json) are separate
from the original witnesses; no earlier proof artifacts are overwritten.
Solver words may vary between invocations; start, goals, pinned backend and
replay requirements are reproducible. The [acceptance manifest](../research/m1-acceptance/manifest.json)
records hashes for this delta. Earlier PR #20 manifests remain historical
snapshots of their recorded base commits; they are not overwritten by the new
example/build/test configuration.

## Five-point DoD evidence

| Criterion | Executed evidence |
| --- | --- |
| 1. Counter target and existing solver | Live dev endpoint calls the existing solver for each selected goal. Node tests and browser tests independently replay their **freshly returned** paths with Python; visible WebGL pixels decode both digits and their upright baseline markers for all five values. |
| 2. Load fixed designs | Existing versioned design/SRI guards remain. A separate library fixture loads color, SVG image and font-backed text; a 404 image produces a defined diagnostic and leaves move controls disabled. Existing invalid schema/SVG/resource tests remain. |
| 3. Orientation and animation | All moves use the ReScript presentation API and existing generic viewer. The live page checks authoritative state equals the viewer state and complete target; pixel tests check the actual front image. No additional free-sticker solver dimension is introduced. |
| 4. Reproduction and inverse | The independent Python checker replays all 24 physical sticker identities/positions/normals/up vectors, compares complete frozen goal states and restores the exact scrambled start by every inverse path. A tampered saved path is rejected. |
| 5. Actual independent library use | The [standalone consumer](../examples/library-only/main.ts) imports only shared packages, loads its [own design](../public/examples/library-design.json), executes R and its inverse, and restores model and rendered pixels. Browser requests must contain no counter modules, counter design or solver. |

The Python [live-result checker](../research/m1-acceptance/verify_live_solver.py)
imports neither JavaScript/ReScript nor cubing. The Node test invokes the live
backend and passes fresh results to that checker. The browser test does the same
with actual HTTP responses; it does not merely validate a checked-in catalog or
trust a `data-value` attribute.

## Reproduce and inspect

```sh
npm ci --cache /tmp/cubistry-npm-cache
npm run check
npm run test:live-solver
PLAYWRIGHT_BROWSERS_PATH=/tmp/cubistry-playwright PLAYWRIGHT_PORT=5181 CI=1 npm run test:e2e
npm run dev -- --port 5181 --strictPort
```

Open `http://127.0.0.1:5181/solver-acceptance.html` and select a target. The
independent consumer is at `http://127.0.0.1:5181/library-example.html`. Its own
arrow/text print is unrelated to counter values or title fragments. Both pages
are build inputs; the standalone library page also works as a static build.

The live solver endpoint exists **only in the local Vite development server**.
The built acceptance page explicitly disables solving and instructs users to
run the dev server. No production backend or hosting architecture is introduced,
and cubing is not added to the browser counter bundle. The existing dual
MPL-2.0/GPL-3.0-or-later solver remains a pinned dev dependency; no backend source
is copied or relicensed. The example reuses the already pinned OFL font and adds
one project-owned vector arrow.

## Local harness limits

[The middleware](../src/dev/acceptance-plugin.ts) accepts only same-origin
localhost POST JSON, exactly one numeric whitelisted goal, at most 64 body bytes,
and one in-flight solve. It rejects cross-site origins/fetch metadata, malformed
requests and unsupported values. Request-body collection expires after two
seconds; solver response waiting expires after 30 seconds. A timeout does not
terminate cubing's worker CPU, so its single-flight lock remains held until that
work settles. No hard memory/CPU cancellation or public service claim is made.
There are no request-supplied paths, states, code or process commands.

The PR stays **Draft even after independent review** until the user requests
promotion. No auto-merge, new solver, 3×3+ work, Rust edits, hosted repository,
PuzWerk changes, namespace publication or external migration belongs to this
slice. Future partial image constraints remain follow-ups after M1 acceptance.
