# CI Quality Cube reference

The [CI Quality Cube](../status.html) implements
[issue #84](https://github.com/wstein/cubistry/issues/84) with four fixed front
categories in row-major order: **BUILD, TEST, ANALYZE, REVIEW**. Each category
independently shows Open, Running, OK, Error, or Blocked. All 625 manual
combinations are supported. Events are local simulations; external services and
agent integrations remain outside this reference application.

## Immutable print and artwork

Every physical sticker permanently carries its category at the top, a large
vector icon in the center, and its state word at the bottom. The user-specified
physical words are **OFFEN, LÄUFT, OK, FEHLER, BLOCKIERT**; these intentional German
print labels do not change the English application controls or documentation.
Open uses a gray hollow circle; Running a blue circular arrow; OK a green check;
Error a red cross; Blocked an amber circle with a slash. Meaning is conveyed by
words and shape as well as color, against a light warm background.

The chosen print assigns two corner bodies to each category. In target-twist
order the first carries Open / Open / Running and the second OK / Error /
Blocked. Thus all 24 stickers are labeled, using 20 distinct artworks. All
stickers retain their IDs, local normals, up vectors and asset references while
turning. A state change never replaces or repaints artwork.

The authoritative [SVG artwork](../public/assets/quality/) contains paths rather
than platform emoji or SVG text. The existing shared asset loader checks its
hashes, SVG allowlist and resource bounds. Text is outlined from the existing
Noto Sans 800 asset, `@fontsource/noto-sans@5.2.10`, under the accompanying
[SIL Open Font License](../public/fonts/OFL.txt).
[Artwork provenance](../public/assets/quality/provenance.json) records the font
hash, fontTools version, dimensions, safe area and ink bounds for every label.
Editable words, colors and icon paths remain in the
[export script](../scripts/export-quality-art.py). SVG dimensions are 256×256
with a 14-unit safe area. This prototype does not add a printable sheet exporter.

## Reviewed finite policy and provenance

The promoted data comes from immutable research commit
[`6058f4dc59e36ce226f5840c2e3f5ca635a96b4a`](https://github.com/wstein/cubistry/tree/6058f4dc59e36ce226f5840c2e3f5ca635a96b4a/research/ci-quality-cube).
The publication author snapshot is `e9e544c0b2cfdffc55918e4ef9e8ef4d78d84d9b`.
The separate [independent research review](https://github.com/wstein/cubistry/blob/6058f4dc59e36ce226f5840c2e3f5ca635a96b4a/research/ci-quality-cube/independent-review/REVIEW.md)
classifies all 625 upright displays and the policy as **SAT**. The app promotes
only the chosen fixed print, 625 setup references, a small coordinate catalog,
and the exact 136,080-byte four-tracked-corner distance certificate. It does not
merge the research branch, comparison prints, generators or a new generic solver.

The certificate SHA256 is
`f56224ee1b76e2bdaac4bb8441df5881e6b7c9a51dd6a14e62eff58e78e396d6`.
Its exact-distance histogram for HTM distances zero through seven is
`1,15,198,2030,15396,61768,53528,3144`. The app checks certificate and catalog
hashes before accepting them. Unit tests independently check rank/unrank, the
unique zero, every move inequality and a descending edge for every non-goal.
The catalog's 24-pose action is generated using the existing shared mechanics;
tests compare all 18 actions for all 24 poses on all eight bodies.

The app-specific [policy consumer](../src/apps/status/policy.ts) projects the
actual complete committed cube state into this reviewed coordinate catalog.
For a valid front with one changed category, it preserves the actual IDs of the
three unchanged front stickers, enumerates the changed artwork copies, and
selects a descending certificate route with at most **six HTM**. This bound also
holds after repeated transitions, independently of hidden back-corner poses.
For arbitrary jumps or an interrupted pose without a valid upright category
front, it enumerates at most sixteen target-copy combinations and uses at most
**seven HTM**. Every resulting route is replayed with shared `applyMoves`, and
its complete eight-body endpoint and upright visible target are checked before
animation. There is no inverse-to-setup detour.

Some transitions require six HTM for this fixed print. A universal five-HTM bound
is **UNSAT within the specified five-state paired-body print construction**;
global print optimization remains **UNKNOWN**. The research mean of 4.012821 HTM
uses uniform logical edges followed by uniform source copies and alternate-body
back poses. It is a comparison distribution, not a runtime average promise.

## Declarative application and controls

[`definition.json`](../src/apps/status/definition.json) is the primary app data:

| Field                     | Responsibility                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| `schema`, `version`, `id` | Bounded app-local format                                         |
| `categories`, `states`    | Fixed front order, logical IDs, UI labels and physical words     |
| `print`, `assets`         | Immutable physical sticker frames and hashed vector artwork      |
| `initial`, `targets`      | Initial snapshot and all 625 legal setup references              |
| `edges`, `events`         | Allowed logical transitions and event source/destination table   |
| `demonstration`           | Deterministic category/event sequence                            |
| `policy`                  | Research revision, artifact hashes and verified bound references |

Four native selects permit every manual combination. Event category and event
controls use the same requested snapshot and controller. The 13 directed edges
are Open→Running/Error/Blocked, Running→OK/Error/Blocked/Open,
OK→Running/Open, Error→Running/Open, and Blocked→Running/Open. An event rejected
by its source-state rule leaves the requested snapshot unchanged. Error means
an attempt failed; Blocked means a prerequisite is unavailable.

The current snapshot is the last fully completed display; requested snapshot,
committed move progress, synchronization and errors are shown separately. Rapid
requests finish the current legal turn, discard obsolete remaining moves, and
replan from the actual committed full pose toward the latest request. Returning
to the previous completed snapshot still repairs an interrupted intermediate
pose. **Finish active snapshot** drops the queued target and completes the active
snapshot. **Stop demo** cancels future simulated events while the already
requested physical display finishes. Each demo begins with an explicit request
for the initial snapshot so it is deterministic from any manual selection.

Certificate, artwork or initialization failure never claims a configured
physical display. Animation failure retains the last committed state and count,
freezes further requests, and exposes **Reload application**. If rendering failed
partway through a turn, the visual pose can remain uncertain until that explicit
reload; it is never guessed to have committed.

## Architecture learning report

PuzlWerk owns physical state, identities, orientation, mechanics and solver
capabilities. The existing private `@cubistry/cube-core` and
`@cubistry/cube-mechanics` ReScript contracts remain the accepted transitional
boundary described in [the M1 contract](SHARED_CUBE_M1.md). This reference changes
no provider, generic solver API, shared domain implementation or other repository.
The finite app policy is a consumer of a reviewed certificate, not another
physical engine: only shared mechanics advance full states or validate turns.

Cubistry owns declarative application composition, category controls, demo timing,
visualization, resource ownership and error presentation. The existing
`PhysicalPlayback` numeric API encodes four base-five fields in a thin adapter.
The endpoint is chosen dynamically from the actual pose, cached with its route,
and passed to the existing exact-state completion checks. That avoids requiring
one canonical hidden pose for every logical snapshot or changing the playback
framework. The viewer and its camera behavior remain shared and unchanged.

The imperative remainder is DOM binding, local demo timing and the app-specific
certificate decoder. Potential consolidation lessons are snapshot encoding,
target predicates versus complete endpoint plans, and a clearer failed-animation
recovery contract. Compare these with other reference apps before extracting any
shared runtime. This work does not begin that consolidation.

## Reproduction and validation

Use the existing fontTools artwork environment with Brotli support, then supply
the exact pinned research checkout to the data generator:

```sh
python3 scripts/export-quality-art.py
node scripts/generate-status-design.mjs /path/to/pinned-research-checkout
node --test --test-isolation=none tests/status-definition.test.mjs tests/status-controller.test.mjs
npm run check
npx playwright test tests/browser/status-cube.spec.mjs
npx playwright test --config playwright.pages.config.mjs tests/pages/status-cube.spec.mjs
```

The focused tests cover all target witness hashes, full-body replay and inverse
restoration, certificate edges, repeated per-field routes, strict declarations,
all manual snapshots and event edges, interruptions, resource disposal and fault
freezing. Browser tests inspect installed bitmap colors and vector artwork,
physical viewer/controller agreement, words for every category/state, keyboard
selection, real animation preemption, corruption, and desktop/mobile DPR2 canvas
bounds and camera interaction. Pages tests check the certificate and all twenty
SVG assets under `/cubistry/`. Existing Counter, Timer, HSM, Clock and Calendar
regression gates continue to apply. The retained `status.html` URL and `status-cube`
chooser value remain compatible; the chooser label is now CI Quality Cube.
