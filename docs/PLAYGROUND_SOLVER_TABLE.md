# 2×2 Playground solver table transport

Tracks [issue #107](https://github.com/wstein/cubistry/issues/107). The owner's
2026-10-30 handoff authorizes this focused fix after accepting/merging PR #100;
the older issue's deferred scheduling note no longer applies.

## Confirmed root cause before the fix

On baseline `8ffb5e2`, [`tableLoader`](../src/apps/playground/solver.ts) compared
HTTP `Content-Length` with 1,837,112 before reading the response. That header
measures the encoded HTTP representation. Fetch transparently decodes a gzip
body, while retaining the transfer header. A correct decoded table therefore
fails the premature header comparison and is incorrectly labeled `Invalid`.

The observed production response at
`/cubistry/assets/optimal-2x2.v2-Dw9VXx8W.bin` was HTTP 200 with gzip encoding,
978,165 encoded bytes and 1,837,112 decoded bytes. The decoded SHA-256 exactly
matches the provider pin:

```text
3b7f10a07d2e13b54044e9073b46f39544640fb6adf8e903ed84f8c3199dae5a
```

Before changing production source, a deterministic Node HTTP server served the
actual installed provider table with gzip and a real encoded `Content-Length`.
Real Node Fetch decoded and authenticated those bytes, then the old loader failed:

```text
node --test tests/solver-table.test.mjs
encoded Content-Length=937134; decoded bytes=1837112; SHA-256=<matching pin>
FAIL: PlaygroundError: Unexpected solver table size. code: Invalid
at src/apps/playground/solver.ts:40
exit status: 1
```

Local zlib and the CDN use different compressed sizes; both are legitimate
representations of the same authenticated binary. This demonstrates a transfer-
versus-decoded-length mistake, not a corrupt table, bad physical state, wrong
provider version or missing asset. No table regeneration or copied binary is
needed.

## Source and initialization boundaries

[`puzlwerk-source.json`](../puzlwerk-source.json) pins the provider source/package
integrity. `prepare-puzlwerk.mjs` verifies or reproducibly builds that package;
the provider's module-relative `TABLE_URL` is bundled by Vite as a hashed asset
under the selected production/preview base. The provider authenticates the
complete table with its exported `TABLE_SHA256`, then decodes the v2 signature,
entry count and payload checksum. The table contains a 32-byte header and
packed distances for 3,674,160 states (1,837,112 bytes total).

Source tracing through `PlaygroundController.prepareSolve` shows initialization
is requested by **Solve exact target**, not page construction or Scramble. The
same loader serves classic and Landscape designs, independent of seed or state.
Uncompressed development responses can pass the old comparison. Counter/Timer/HSM
use the existing adapter's separate default loader without this header check;
the 3×3 provider is separate. This is source/Node HTTP evidence, not a browser
click-sequence observation.

## Correction and regression coverage

The loader now bounds/counts the actual decoded stream, then authenticates the
provider-exported `TABLE_SHA256` before fulfilling its cached resource promise.
The maximum and exact decoded size remain 1,837,112 bytes. Failed loads clear
that promise; retry uses HTTP `cache: reload` to bypass stale cached responses.
Successful concurrent/repeated requests still share one authenticated fetch.
No decompression-ratio guess or untrusted header replaces byte validation.

HTTP, missing-body, HTML, transport, size and hash failures are recoverable
`Unavailable` outcomes; deadline/abort errors remain `Timeout`. Actual physical
input/replay failures retain `Invalid`. The provider's existing snapshot, hash,
signature/version, entry-count/checksum and exact-physical replay checks are
unchanged. No solver algorithm, table asset or source pin changed.

[`solver-table.test.mjs`](../tests/solver-table.test.mjs) covers valid real gzip
initialization; missing/wrong-path/HTML assets; truncated/oversized decoded data;
wrong-version and same-length corruption; stream cancellation/errors; real HTTP
timeout/retry; shared/concurrent/repeated initialization; and full controller
recovery without changing the failed session's state, history or move counts.
Its event-driven controller test confirms no initialization during construction
or Scramble, followed by resource loading on Solve and a successful later retry.

Classic and Landscape **seed 44 / 20 moves** both restore the exact target in
15 returned HTM in this regression. Independent shared-mechanics replay checks
all body poses plus every sticker's identity, position, normal and up; source
printing stays unchanged. This is not an HTM optimality claim. Existing Counter
42→43 and chained complete-state regressions also pass unchanged.

## Reproducible production and preview asset verification

The standalone [`solver-table-assets.mjs`](../tests/solver-table-assets.mjs) audit
inspects the emitted runtime URL and requires exactly one packaged 2×2 binary,
its exact decoded size and provider hash. It serves that built asset over real
HTTP gzip and initializes both designs through the resource boundary/provider,
then independently replays their seed-44 solutions. It performs no build in the
default unit suite and launches no browser.

```sh
VITE_BASE_PATH=/cubistry/ npm run build
node tests/solver-table-assets.mjs dist /cubistry/
VITE_BASE_PATH=/cubistry/pr-preview/pr-109/ npm run build
node tests/solver-table-assets.mjs dist /cubistry/pr-preview/pr-109/
```

Both audits found one `assets/optimal-2x2.v2-Dw9VXx8W.bin`, the appropriate base
prefix, 1,837,112 decoded bytes with the pinned SHA, and a successful compressed
shared fetch followed by exact-body/sticker-frame replay for both designs.

**E2E NOT RUN.** Browser confirmation on the owner's deployed URL remains manual:
use classic and Landscape, seed 44 / 20 moves, then Solve exact target; confirm
loading, legal playback and exact-target completion, and retry a failed resource
request without losing the session. Source/Node HTTP evidence does not establish
a browser click-sequence observation. No browser/Playwright test, deployment or
merge is authorized by this work.
