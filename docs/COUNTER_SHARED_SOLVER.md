# Shared 2×2 counter solver integration

Tracks [Cubistry #23](https://github.com/wstein/cubistry/issues/23) and
[PuzlWerk #5](https://github.com/wstein/puzlwerk/issues/5). The solver implementation
was accepted in provider PR #13. Its lowercase package naming was accepted in
[provider #14](https://github.com/wstein/puzlwerk/pull/14); this consumer starts from main after merged
[Cubistry #29](https://github.com/wstein/cubistry/pull/29). Neither rename branch
is modified by the integration; this consumer remains a separate Draft PR.

## Reproducible dependency, without publication or vendoring

`@puzlwerk/solver-2x2` is private and is not published to npm. There is no release
archive to pretend is already available. `puzlwerk-source.json` pins the actual
provider repository, immutable 40-character commit, package/version and SHA-512
package integrity. The package-lock records the same integrity.

```sh
npm run setup
npm run dev
```

`setup` runs `prepare:solver` before `npm ci`. The standard-library-only preparation
script checks a cached artifact's integrity or fetches the pinned provider into
its **own temporary checkout outside the repository**, installs its locked build
toolchain and compiles/packs its real workspace. The temporary checkout is removed.
Only the ignored `.puzlwerk-dependency/solver-2x2.tgz` installation artifact remains;
`npm ci` installs it as an ordinary file dependency. No solver implementation or
separate lookup table is maintained or versioned in Cubistry. There is no registry
publication, provider change or runtime Git/network dependency on GitHub.

Two separate source rebuilds produced the identical package integrity. To verify
again, run `node scripts/prepare-puzlwerk.mjs --rebuild`. A mismatching rebuild
fails rather than silently editing pins or falling back to a different solver.
A first source rebuild requires Git/npm network access; an already verified local
artifact can be reused. Provider compiler/runtime dependencies stay pinned in the
provider lock. Existing consumer dependency versions and `@cubistry/*` names remain
unchanged; only the shared solver dependency is added.

The pin is the accepted provider main revision after merged #14; #29 is also
merged in the consumer base. This is still not a registry release. The reviewed
provider tree produces the same verified package bytes as its pre-merge source.
Never silently follow a mutable branch name or use another scope.

## Physical contract and HTM

The thin `src/adapters/puzlwerk-2x2.ts` boundary consumes the existing complete
Cubistry v1 print/state types. Only the size-2 topology literal is narrowed after
validation; cubie IDs, sticker definitions, body frames and print identity remain
unchanged. The core and viewer do not import solver code. The UI calls the existing
controller; the solver and target/queue logic remain outside the UI layer.

The adapter always calls:

```ts
solver.solve2x2(currentState, targetState, { mode: 'exactPhysical' })
```

It parses returned tokens through the existing legal move parser and replays them
through Cubistry's independent mechanics, requiring equality with the **complete**
target. The controller repeats complete-state and visible-target checks after the
actual animation finishes. Stickers stay attached to bodies; no printed image is
replaced and no glyph symmetry normalizes away a physical pose.

Witnesses still define a complete target and the initial state. They are no longer
inverted/concatenated to route playback through the reference state. Each plan uses
the actual authoritative current physical state. Existing animation scheduling,
queued targets, stop-after-current, same-value no-op, failure recovery/configuration,
reset and timer rules are retained. Failed/uncommitted turns do not advance state
or counts. The total is the actual returned token count and completed increases
only after `animate` resolves and its physical state is committed.

HTM counts `R`, `R2` and `R'` once each, including face turns used in provider frame
correction. No general exactPhysical HTM optimality is claimed. For the fixed
42 → 43 regression the new sequence is:

```text
U R' U' F2 R2 U R F' U F'
```

That is **10 HTM**, versus the old 9 + 9 = 18-move witness detour. Other transitions
may require frame correction and are not promised shortest exact paths. This is
not optimization over every possible state displaying the same partial front.

## Browser and static Pages resources

The provider owns its versioned table and validates its SHA-256/header/checksum.
The consumer fetches the module-relative provider `TABLE_URL` once, with a bounded
startup request; a missing/corrupt table fails setup and does not enable a witness
fallback. Table bytes are reused across immutable print reconfigurations.

Vite excludes this asset-owning package from dependency prebundling and emits its
`.bin` resource under the configured base. Development loads the installed provider
resource; production/Pages bundle one hashed table asset from that same dependency,
not a copied file under `public/`. The existing Pages workflow remains main-only.
Both workflows prepare the pinned dependency before `npm ci`; no deployment or
workflow dispatch is performed by this PR.

The build also retains exact provider LICENSE/NOTICE/COPYING/provenance and the
source pin under `dist/licenses/puzlwerk/`. Cubistry and this dependency are
AGPL-3.0-or-later; original CubeLab attribution remains intact. This does not
relicense any sibling application.

## Verification

```sh
npm run check
PLAYWRIGHT_PORT=5201 npm run test:e2e
PLAYWRIGHT_PORT=5202 npm run test:pages
```

Focused regressions verify exact 42 → 43, padded/unpadded 42 → 43 → 7 → 42 using
each actual replayed state, all cubies and 24 sticker positions/normals/up frames,
inverse restoration and corrupted-table rejection. The fresh path is checked by
`tests/shared_solver_replay.py`, which imports only the existing independent Python
checker, not JavaScript, ReScript or the provider. A corrupted body orientation is
rejected by that independent checker.

Existing committed-HTM, queued targets, interruption, reset, configuration failure,
timer, camera, mobile/accessibility and print tests are retained. Golden HTM values
in tests describe selected pinned regressions, not a production lookup table or an
optimality proof. A browser test records actually resolved viewer moves and checks
its final complete state with Python. Static `/cubistry/` tests render upright
42/43/07/99, require 10/10 for 42 → 43, verify one table request, notices and absence
of asset/console errors. The library-only example remains independent of the solver.

This PR does not migrate other core packages, implement a new solver, copy upstream
solver sources into the repository, publish packages, add Chronocube or restructure
the knowledge base. The previous M1 acceptance documents remain historical records.
