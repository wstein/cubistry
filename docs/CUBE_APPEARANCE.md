# Cube appearance: when a cube looks solved

`@cubistry/cube-appearance` ([source](../packages/cube-appearance/src/index.ts)) is a pure,
DOM-free package. It decides which stickers look alike and whether a state looks like a goal.
It adds no solver and changes no application: `PwCore`, `PwMechanics`, the skill and the
playground suitability display are untouched. Status: stage S1 of the visual-goal solver plan;
nothing consumes the package yet.

## Rule and owner decisions

A cube counts as solved when it looks solved: symmetric orientations, duplicate stones and
symmetric odd-N centers are accepted. The binding decisions:

| ID | Decision | Where it lives |
| --- | --- | --- |
| D1 | The display counts a whole-cube rotation as solved; solvers target the fixed frame. | `AppearancePolicy.wholeCubeRotation` |
| D2 | Rotation twins (6 and 9) are equal for pictures, not for date, time or counter displays. | `AppearancePolicy.rotationTwins`, presets `POLICY_PICTURE` and `POLICY_DISPLAY` |
| D3 | Strict thresholds for solvers, looser ones for advice and display; vector themes use exact equality. | `STRICT_THRESHOLDS`, `LOOSE_THRESHOLDS`, `EXACT_THRESHOLDS` |
| D4 | A strict identity mode exists; the default is visually solved. | `POLICY_IDENTITY`; `makePolicy()` is visual |
| D5 | Picture cubes constrain all six faces; partial goals only for date, time and counter. | `AppearanceGoal.scope` (`full` or `display`) |
| D6 | Identical stones are interchangeable with the induced rotation, also at N of 4 or more. | `deriveStones` (geometry only; see limits) |
| D7 | Optimality is claimed only where proven. | This package makes no optimality claim |
| D8 | The classifier lives in a pure package. | `packages/cube-appearance` |

## Terminology: order and period

Three vocabularies name the same three cases. Cubistry's `equivalentQuarterTurns` lists the
quarter turns that look identical; the skill says `none`, `2-fold`, `4-fold`; PuzlWerk acceptance
groups are C1, C2, C4. PuzlWerk ADR 0008 item 6 names the same groups by **period**, where its "C1"
means period 4 and its "C4" means period 1. Do not read "C4" as "period 4".

| Skill `symmetry` | `order` (this package) | `equivalentQuarterTurns` | Group | `period = 4 / order` |
| --- | :-: | --- | :-: | :-: |
| none | 1 | `[0]` | C1 | 4 |
| 2-fold | 2 | `[0, 2]` | C2 | 2 |
| 4-fold | 4 | `[0, 1, 2, 3]` | C4 | 1 |

The code uses only `order` (how many quarter turns look alike) and `period` (how many stay
distinguishable). Turns are quarter turns counterclockwise as seen from outside the cube;
`turn` values are compared modulo the period.

## Classifier

`classifyTiles(tiles, options)` takes upright RGBA tiles (the caller renders them; tile `id` is the
asset id) and returns a `Classification`, a diagnostic record for both levels:

- **Pixel metric.** Alpha is composited over white with integer arithmetic. Two pixels differ when
  their largest channel difference exceeds `pixelTolerance`; two tiles are within tolerance when at
  most `share` of the pixels differ. Strict is 16 and 0.5 percent, loose is 24 and 3 percent, exact
  is 0 and 0 (vector themes: identical art renders identically).
- **Symmetry.** Order 4 needs the quarter and half turn to match, order 2 the half turn.
- **Identical groups** (`i0`, `i1`, ...) and **rotation-twin groups** (`t0`, ...) use deterministic
  **complete linkage**: two groups merge only when every cross pair is within tolerance, closest pair
  first, ties to the lowest indexes. A chain A~B, B~C never pulls in C when A and C differ. A false
  split costs extra moves; a false merge would show an unsolved cube as solved.
- **Twin offset.** Each twin member records `turn`: the tile equals the group representative (the
  smallest id) turned that many quarter turns. For symmetric classes the turn is reduced modulo the
  period; the class order is the minimum order of its members. Twin groups are unions of identical groups.
- **Exact groups** (equal pixel hashes) are reported independent of any threshold.
- **Centers (odd N).** `centerTileIds(n)` names the six middle stickers in the skill's `F_row_col`
  form; `analyzeCenters` reports order, period, `orientationNeeded` (order below 4) and
  `orientationExact` (order 1).
- **Diagnostics.** Per tile: hash, detail share, `rotDiff` for 1, 2 and 3 quarter turns, and the
  nearest tile outside the own identical and twin class.

The result is independent of input order. `inputSha256` ties it to the rendered pixels.

## AppearanceMap (`cubistry.appearance@2`)

`toAppearanceMap(classification, { printId, renderer, level })` freezes one level (default
`strict`) into data that solvers and the Julia and Flix checkers read without pixels. Schema:
[cubistry.appearance-2.schema.json](../packages/cube-appearance/schema/cubistry.appearance-2.schema.json).

```json
{
  "schema": "cubistry.appearance", "version": 2, "printId": "demo",
  "classifier": { "module": "@cubistry/cube-appearance", "version": 1, "level": "strict",
    "thresholds": { "pixelTolerance": 16, "share": 0.005 }, "sample": 80,
    "renderer": "vector", "inputSha256": "<64 hex>" },
  "classes": { "i0": { "order": 1 }, "i1": { "order": 1 }, "t0": { "order": 1 } },
  "assets": { "six": { "identical": "i0", "twin": "t0", "turn": 2 },
              "nine": { "identical": "i1", "twin": "t0", "turn": 0 } }
}
```

Each asset has an identical class and a twin class; the policy picks the level. `turn` is the
offset of the upright asset against the twin class representative. `appearanceSha256(map)` is the
SHA-256 of the canonical JSON (keys sorted, no whitespace, integers and finite numbers only), so
other languages can reproduce it. `validateAppearanceMap` is the strict ingress check (it also
checks cross references and that each turn is below the class period, which the schema cannot).
Maps are deep-frozen.

Compute maps for themes and vector sets offline and ship them with their hash; compute upload maps
once at runtime after the crop is committed and store them with the design. Browser rasterization
can differ near a threshold, so a map must not be recomputed on another device.

## Goal and predicate

`cubistry.goal@2` ([schema](../packages/cube-appearance/schema/cubistry.goal-2.schema.json)) lists
constrained facelet slots (`x,y,z|nx,ny,nz`, doubled integer coordinates). A slot names the reference
asset, the quarter-turn index of its up vector and `matching` (`exact` or `equivalent`). Classes come
from the map and the policy at evaluation time, so one goal serves identity, visual and twin judging.
A slot may pin the physical `sticker`. Free slots are simply absent. Builders:
`goalFromState(print, state, options)` (full goal, or `display` with `only`) and
`goalFromTarget(printId, target)` (adapter for `cubistry.target@1`).

`matchesAppearance(print, state, goal, map, policy)` (and `makeMatcher` for repeated use):

- **Visual:** the occupant must be in the goal asset's class, and its turn (twin offset plus
  quarter-turn index) must equal the goal's modulo the class period; `exact` slots compare modulo 4.
- **Identity:** assets and frames only, no map. Without sticker pins this reproduces
  `matchesTarget` of `PwMechanics` exactly (tests cross-check it on the counter fixtures, a classic-color
  print and a mixed-symmetry print). With pinned stickers (`goalFromState`) it equals `stateEquals`.
  A visual call without a map behaves like identity.
- A goal pins its map by hash; a missing or different map throws.
- `wholeCubeRotation` tries all 24 frames and reports the first matching frame.

## Stones

`deriveStones(print, map, policy)` finds interchangeable stones from stickers plus geometry: stones P
and Q are interchangeable when some rigid frame maps P's home slot onto Q's and every sticker lands on
a sticker of the same class with an equal turn modulo the period. This is an equivalence relation.
`frames(p, p)` is a stone's own symmetry (for a middle center: 4 divided by the sticker period), and
`generators` generate the group H of appearance automorphisms. `applyAutomorphism` relabels a state
with the induced frames. Tests prove on the 2x2 that the goal set found by exhaustive search equals
the orbit of the generators intersected with the legal states (24 for four equal top corners; 1 for a
lone symmetric corner, 3 for two, 6 for two with the same picture).

Limits: only the 2x2 has an engine; the model is geometric and tested on synthetic 3x3 and 4x4
prints. Whether pieces of N of 4 or more actually move between slots with an induced rotation is
unverified. The package makes no claim about optimal move counts, parity or reachability beyond the
2x2 checks above.

## Migration (not part of this change)

Both consumers are unmerged, so this change does not touch them:

- **Skill (PR #248).** `symmetry.mjs` should re-export `classifyTiles` and keep a v1 JSON adapter:
  `symmetry` maps from `order` (table above), groups from `identical` and `twins` (the offset is new),
  and `orientationNeeded` from `analyzeCenters`. The skill's single-linkage union becomes
  complete linkage, and its 2 percent rule becomes the loose level for the report and the strict level
  for any map. The skill is plain Node: Node 24 runs the TypeScript sources directly; if the skill must
  stay self-contained, vendor a generated copy and check it by hash.
- **Suitability display (PR #258).** `suitability.ts` keeps its traffic light but should call the shared
  loose level instead of its own `measureRgba`/`twinDiff`, and must not feed solver decisions.
  Its exact raw-pixel hash corresponds to `exactGroups`.

## Tests

`tests/cube-appearance-classify.test.mjs` and `tests/cube-appearance-goal.test.mjs` cover
SHA-256 against `node:crypto`, known symmetry and twin offsets (including near-threshold cases),
no transitive merge, input-order independence, schema and golden hashes, the identity cross-check
against `matchesTarget` and `stateEquals`, whole-cube rotation, rotation-twin policy, invariance of the
predicate under every stone automorphism, and the exhaustive 2x2 goal-set oracle.
