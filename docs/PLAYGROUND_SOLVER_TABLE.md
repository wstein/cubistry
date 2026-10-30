# 2×2 Playground solver table transport

Tracks [issue #107](https://github.com/wstein/cubistry/issues/107). The owner's
2026-10-30 handoff authorizes this focused fix after accepting/merging PR #100;
the older issue's deferred scheduling note no longer applies.

## Confirmed root cause before the fix

The throw is in [`tableLoader`](../src/apps/playground/solver.ts), which compares
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

The correction must bound and count the decoded stream and authenticate its
pinned hash before fulfilling the cached resource promise. Failed loads must
clear that promise for retry. The provider's existing format/version/integrity
checks and independent exact-physical move replay remain authoritative. Resource
errors must be recoverable `Unavailable`/`Timeout` outcomes, while illegal input
or failed physical replay retains its existing invalid-state handling.

**E2E NOT RUN.** Browser confirmation on the owner's deployed URL remains a
manual check; no browser/Playwright test, deployment or merge is authorized.
