# HSM raw-input profile (seconds-first print)

Additive profile of the native Flix and Julia checkers for the HSM (hours, minutes,
seconds) seconds-first witnesses. It is **not** part of the frozen issue-74 contract in
[SPEC.md](SPEC.md): `SPEC.md`, [INTERFACE.md](INTERFACE.md), [coverage.json](coverage.json),
`conformance/manifest.json`, `conformance-pin.json` and the 195 existing cases are unchanged.
Everything specific to this profile is in this file, in `flix/src/Hsm.flix`,
`julia/Hsm.jl`, `conformance-hsm/` and `tools/build_hsm_corpus.jl`.

Authority is the one of [AUTHORITY.md](AUTHORITY.md): a witness counts as CONFIRMED for the
claims listed under [Verified claims](#verified-claims) only when **both** checkers accept the
raw file, each reading it itself. No Python verifier is a gate. The research Python verifiers
(`verify.py`, `verify_modes.py`) were used once as a sanity comparison and play no role.
The checkers do not vote: any difference between Flix and Julia in accept/reject, in a number
or in a hash is `UNKNOWN` and needs a root-cause investigation (AUTHORITY.md, rule 3).

## Commands

```sh
# from the repository root, after the build/setup steps in flix/README.md and julia/README.md
java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar hsm FILE
java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar hsm-conformance .
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl hsm FILE
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl hsm-conformance "$PWD"
```

Output is one JSON line. Exit codes and status words are those of
[INTERFACE.md](INTERFACE.md): 0 `VALID`; 1 `INVALID` or `INVALID_JSON`; 2 `UNSUPPORTED`
(unknown schema or version, which includes the recovery schema); 3 `ERROR`.
For a valid witness both checkers print **byte-identical** lines (same key order, numbers
and digests); compare them with `cmp`. For a rejected witness only `valid` and `status`
are compared; the `reason` text is free-form.

## Schemas

| `schema` | Version | Status |
| --- | --- | --- |
| `cubistry.hsm-seconds-first` | 1 | verified. Eight own periods (S, M 00–59; H 00–23, 00–11; both directions) are required, extra modes are allowed. |
| `cubistry.hsm-seconds-first-modes` | 1 | verified. All 18 own periods, plus `edgeLimitHTM` = 5 and 18 `appModes`. |
| `cubistry.hsm-seconds-first-recovery` | 1 | **not verifiable here**: `UNSUPPORTED`. Its recovery tables stay UNKNOWN until a native port exists. |

Both verified schemas are strict: the exact key sets below, JSON integer tokens only (no
floats, no exponents, no Booleans as numbers), no duplicate keys, no unknown keys. A UTF-8
byte order mark before the JSON text is `INVALID_JSON`. The fraction strings `optimalMeanHTM` and
`perLapHTM` use ASCII digits `0`–`9` only, with nothing before the first or after the last digit
(no newline, no other Unicode decimal digits).

Top level: `schema`, `version`, `label` (string, informational), `printCode`,
`universalArbitrarySourceHTM` (must be 6), `printing`, `modes`; the all-modes schema adds
`edgeLimitHTM` (must be 5) and `appModes`.

`printing`: 24 stickers `{id, cubie, p, n, slot, image, up}` in id order. `p` is a corner
position in `{-1,1}^3`, `n` the outward axis normal, `up` the tangent direction the glyph's up
points to. `cubie` 0–7 is the rigid corner; `image` is `""` (a real blank) or one of
`0–9`, `H`, `S`, `M`; `slot` is the upright slot class 0 upper-left (blank only), 1
upper-right (letters), 2 lower-left (tens digits 0–5), 3 lower-right (units digits).
`printCode` must equal the code derived from the stickers
(`T`/`U` + digit, the letter, or `_`, three stickers per corner in id order, corners
joined by ` | `).

`modes[i]`: `letter`, `maximum` (11, 23 or 59), `direction` (±1), `htmCap` (1–6; M at most 5;
5 or 6 in the all-modes schema), `graphNodes`, `graphEdges`, `certificatePasses`
(informational only), `optimalMeanHTM` (lowest-terms fraction `a/b` or `a`), `periodHTM`,
`periodEdges`, `maximumHTM`, `appPolicy13` (four integers, comparison only, **not
checked**), `setup`, `periodStart` (0), `periodStartFrames` (24 `{id,p,n,up}`), `steps`
(`{from,to,word}`). Words use `R L U D F B` with `''`, `2`, `'`, single-space separated,
at most 64 tokens in `setup` and each `word`. Up to 100,000 steps.

`appModes[i]` (all-modes schema): `letter`, `maximum`, `direction`, `sourceDirection`,
`traversal` (`forward` or `inverse`), `periodHTM`, `periodEdges`, `perLapHTM` (`num/den`),
`maximumHTM`.

## Model

Both checkers rebuild the physics themselves, with no import from production code, from the
research directory or from the other language.

- A 2x2x2 cube: 8 rigid corners, 24 outward facelets `(p, n)`, 24 stickers fixed on their
  corner. The print is immutable; only stickers move.
- 18 generators `R L U D F B` with `''`, `2`, `'`. Counting is HTM: a half turn is **one** move.
  `R` turns the `x = +1` layer clockwise seen from `+x` (a quarter turn of `-1` about `x`).
- The four display cells are the front (`n = +z`) positions `(-1,1)`, `(1,1)`, `(-1,-1)`,
  `(1,-1)` = blank, letter, tens, units. A display `(letter, value)` is shown when the real
  blank sits upper-left and the letter, tens and units glyph stickers sit in their cells with
  `up = +y`. A display is therefore reached through any choice of physical stickers
  (duplicate glyphs give several options) lying on four different corners.
- Legal poses: any assignment of the 8 corners to the 8 positions with total corner twist
  0 mod 3. Both checkers prove, for each of the 18 moves, that the twist change per position
  sums to 0 mod 3, so every reachable pose is legal. (Every legal pose being reachable is the
  classical group fact; it is only used to name the superset over which the bound and the
  certificate hold, which makes both claims stronger, never weaker.)
- Four-sticker distance table: breadth-first search over ordered facelets of four distinct
  corners (136,080 placements, diameter 7) to the four front cells. The shortest distance from
  a pose to a display is the minimum over display options of that table.

## Verified claims

Everything below is checked from the raw file by both checkers; a failure rejects the file.

1. **Print**: 24 stickers, complete facelet lattice, eight rigid corners at eight positions,
   exact upright slot classes (an upside-down glyph fails), real blank only upper-left, every
   blank, letter, tens 0–5 and units 0–9 glyph printed, `printCode` consistent.
2. **Universal six-HTM bound**: for each of the 180 displays `H/S/M 00–59` every legal pose is
   within 6 HTM. Pruned exhaustive backtracking over legal poses; a violating pose rejects.
   The 180 displays are also reachable from the print itself within 6.
3. **Physical replay** of every `setup` and every saved word on full `(p, n, up)` frames:
   the period start pose equals the saved `periodStartFrames` exactly; each step shows the next
   display with exact glyphs, blank and orientation; every edge applied and then inverted
   returns the identical 24 frames.
4. **Shortest edges**: each saved edge costs exactly the minimum HTM from its *actual full
   source pose* to the next display.
5. **Closed periods**: after the last step the 24 frames equal the period start frames and the
   value is 00; the number of steps is a whole number of laps; every display of the range is shown.
6. **Inverses**: each period run backward with every word inverted also closes the full pose
   and shows the displays in reverse. The result reports its HTM, maximum and how many of
   its edges are **not** shortest (these are legal but not shortest-edge schedules).
7. **Honest metrics**: `periodEdges`, `periodHTM`, `maximumHTM`, `optimalMeanHTM` equal the
   replayed values; `maximumHTM` is within `htmCap`; per-lap HTM is reported exactly
   (`perLapHTM`, e.g. S lap 159, M 204, H 82, H 00–11 40).
8. **Minimum mean**: the complete shortest-edge graph of the mode (every legal pose showing a
   display of the range; every edge to every endpoint of every shortest word) is rebuilt and
   must match `graphNodes` and `graphEdges` exactly; the saved period must be a cycle of it;
   Bellman-Ford potentials for weights `den*cost - num` over poses whose cost is at most
   `htmCap` converge with every edge dual-feasible. So **no recurrent schedule of shortest
   edges within the cap has a smaller mean than `optimalMeanHTM`**, and the saved period
   attains it. A predecessor cycle during relaxation is a cheaper schedule and rejects.
   (The certificate is relative to shortest edges and to the cap, as in the research text.)
9. **All-modes schema only**: all 18 own periods have edges at most 5 and cap 5 or 6; each
   application mode follows the period the selection rule names (the +1 period unless the −1
   period is strictly better in per-lap HTM, then in maximum edge), traversed forward or
   inverted, visits each full pose once, has every edge at most 5, and its metrics match.
10. **Coverage**: the union of the replays shows every S and M display 00–59 and H 00–23.

## Not verified (reported, never silently accepted)

The result's `claims` object says so explicitly:

| Claim | Reported | Why |
| --- | --- | --- |
| global print optimality | `UNKNOWN` | the witness carries no checkable evidence; only trivial floors exist |
| "any print with a single S sticker and tens/blank constraints needs ≥ 168 HTM per S lap" | `NOT_CHECKED` | a statement about other prints, not about this witness |
| wrap figures of the saved cycles | `NOT_CERTIFIED` | they describe one optimal cycle among possibly several |
| `appPolicy13` (the app's greedy policy 13 figures) | `NOT_CHECKED` | comparison data about application code |
| recovery tables / return onto the period (`…-recovery` schema) | `NOT_CHECKED`, schema `UNSUPPORTED` | no native port |
| `certificatePasses` | `INFORMATIONAL` | generator bookkeeping |
| schedules using non-shortest edges | `UNKNOWN` | outside the certificate (the research text says so too) |

A `VALID` line therefore means "all listed claims hold", never "the print is optimal".

## Result record

`valid`, `status`, `profile`, `profileVersion`, `schema`, `inputSHA256`, `printCode`,
`printSHA256` (digest of a canonical rendering of the 24 stickers, so two witnesses can be
shown to use the same print), `fourStickerPlacements`, `fourStickerDiameter`,
`universalBound`, `modes[]` (period metrics, rebuilt `graphNodes`/`graphEdges`,
`minimumMeanCertified`, `inverseTraversal`), for the all-modes schema `edgeLimitHTM` and
`applicationModes[]`, `displaysWitnessed`, `claims`.

## Algorithms in short (both checkers, written separately)

- Replay: integer quarter-turn rotation of `(p, n, up)` with the layer test on `p`.
- Distance: BFS over 4-facelet keys; pose to key by facelet lookup.
- Universal bound: seed with every 4-facelet key of one display option that is farther than 6,
  then place the remaining relevant corners depth first, pruning as soon as a fully placed
  option is within 6. A leaf with an unconstrained corner is a counterexample (it can absorb
  any twist); with all eight corners constrained the twist sum is checked.
- Graph: nodes by fixing the four display corners per option and permuting/twisting the other
  four; edges by enumerating every shortest word per live key set (memoised) and applying it to
  the full pose. Edges are distinct endpoints.
- Certificate: layered Bellman-Ford with parent-cycle detection every 8 passes.

Both implementations follow this scheme; they share no code. Julia stores poses as vectors
of tuples and iterates imperatively; Flix uses flat `Vector`/`Array` tables with
tail-recursive loops. The common weakness is the common algorithm: a mistake in the scheme
itself would appear in both. That is why the scheme is written down here for review.

## Conformance corpus `conformance-hsm/`

`conformance-hsm/manifest.json` pins every case input by SHA-256 and records the expected
verdict (`expectedValid`, `expectedStatus`) and, for accepted cases, `resultSHA256` of the
printed line. The manifest itself is pinned in the source of both checkers
(`HSM_MANIFEST_PIN` in `julia/Hsm.jl`, `hsmManifestPin()` in `flix/src/Hsm.flix`) and
`hsm-conformance` enforces the pin, every input hash, the exact file list, and that every
case produces its recorded verdict and digest.

The expected verdicts were **produced by the checkers**, not by Python:
`tools/build_hsm_corpus.jl generate` derives the files by plain JSON edits and
`tools/build_hsm_corpus.jl pin` runs `hsm FILE` in Flix and in Julia for every case and writes
the manifest only if both agree on accept/reject, status word and result digest (otherwise
it prints the dissent and writes nothing: `UNKNOWN`).

Positive cases are the real witnesses: `witness` (new print, 8 modes, research `4d9ef77`,
byte-identical to `data/hsm/seconds-first/witness.json` of PR 92), `baseline` (the current
app print) and `modes` (all 18 modes, research `30b6d02`). Negative controls: unknown
schema/version, float token, unknown or duplicate keys, truncated JSON, tampered sticker
(printCode mismatch, missing glyph, swapped glyphs), wrong `printCode`, upside-down glyph,
mislabeled blank, wrong frame, non-shortest edge, broken closure, skipped display, missing or
duplicate mode, wrong lap/maximum/mean/graph-size claim, a valid but non-minimum-mean cycle,
S −1 given as the inverse traversal (not shortest), universal claim 5, M with cap 6,
non-canonical whitespace, wrong selection rule/traversal/metrics in the all-modes schema,
edge limit 6, a cap-4 own period, the unsupported recovery schema, and the five controls of the
[review record](#review-record-pr-95): a byte order mark, and a trailing newline or
Arabic-Indic digits in `optimalMeanHTM` and in `perLapHTM`.

To add a witness (for example a later research branch): add the file to the generator, run
`generate` into a fresh directory, run `pin` with both checkers, then update both manifest pins
in the sources and re-pin the provenance (below). Do not edit `manifest.json` by hand.

## Pinned files touched by this profile

Only these existing files changed: `flix/src/Main.flix` (two dispatch lines),
`julia/check.jl` (one dispatch branch and one `include`). Because they are hashed, the
following records were re-pinned, and nothing else in them:

- `flix/evidence/provenance.json`: `Main.flix` hash, new `Hsm.flix` entry,
  `runtimeArtifactSHA256` of the rebuilt jar;
- `julia/evidence/provenance.json`: `check.jl` hash, new `Hsm.jl` entry;
- `evidence-manifest.json`: the hashes of those two provenance files.

The older lifecycle/build/conformance captures describe the earlier artifact and the 195-case
corpus; they were not regenerated. The Flix fat jar is not byte-reproducible (rebuilding the same
sources gives a different `runtimeArtifactSHA256`), so that field records the jar that was
actually run; the source hashes are the reproducible part of the pin.

Regression after the change (rebuilt jar, changed Julia sources): the 195-case `conformance`
command in Flix and in Julia still reports the pinned full-state aggregate
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`, the raw exports equal the
hashes already recorded in the two provenance files, and `tools/audit_corpus.py` reports
`PASS_DATA_PINS` for the unchanged 195-case corpus (it checks data hashes and counts only).
`hsm-conformance` gives the byte-identical result in both checkers (46 cases, 3 accepted,
43 rejected). On a shared 2-core box it took Julia 1.5 to 2 minutes (one process) and Flix 7 to
9 minutes; the 18-mode witness alone takes Flix about 3.5 minutes. CI must therefore give
`hsm-conformance` a generous timeout (at least 20 minutes); nothing is weakened to save time.

## Review record (PR 95)

The independent review of PR 95 probed both checkers with extra mutations. Four inputs gave a
**dissent** (different accept/reject), so their status was `UNKNOWN` until this root cause was
found. The published witnesses were not affected: both checkers accept all three positive cases
with byte-identical result lines.

| Input | Flix | Julia | Root cause |
| --- | --- | --- | --- |
| `optimalMeanHTM` = `"53/20\n"` | `INVALID` | `VALID` | Julia: PCRE `$` also matches before a final newline. Fix: anchor with `\z`. |
| `perLapHTM` = `"159/1\n"` (all-modes) | `INVALID` | `VALID` | Same regular expression flaw in Julia's `parse_ratio`. Same fix. |
| `optimalMeanHTM` in Arabic-Indic digits | `VALID` | `INVALID` | Flix: `Char.isDigit` accepts every Unicode decimal digit and `Int64.fromString` parses them. Fix: ASCII `0`–`9` only. |
| UTF-8 byte order mark before the witness | `INVALID_JSON` | `VALID` | Julia: the shared JSON reader skips a leading byte order mark. Fix: `hsm` rejects it before parsing (`INVALID_JSON`). |

Both checkers were fixed to the stricter reading, the five controls above were added to
`conformance-hsm/` through `build_hsm_corpus.jl generate` and `pin`, and both checkers were rerun.
The byte order mark leniency of the shared Julia reader also applies to the frozen issue-74
commands (`counter`, `state3`); that code is pinned and was not changed; it is left to the owner.

One class-only difference, not a dissent: a lone surrogate escape in `label` is `INVALID_JSON` in
Flix and `INVALID` in Julia (both reject, exit 1). It is listed here for the owner; `coverage.json`
was not edited.

Other probes gave the same accept/reject decision and status in both checkers: a root array,
minimal recovery schema, `version` `1e0`, `-0` and a `id` key escape (both accepted as `0`
and `id`), an upside-down digit, `59.0`, `0e0`, a 20-digit integer, direction 0, leading, trailing
or tab whitespace in a word, `"53/20/"`, edge limit 4, a per-lap claim off by one, a missing
application mode, a second H sticker replacing an S, and the compact re-serialization of the
witness (accepted, byte-identical lines).

## For agents (Codex, Claude Code)

1. Build/setup as in [flix/README.md](flix/README.md) and [julia/README.md](julia/README.md)
   (pinned Flix 0.79.0 jar, Jackson Core 2.22.4, OpenJDK 21; Julia 1.13.3 with JSON 1.13.0;
   verify every hash against the repository pins; never use other versions).
2. Run both `hsm FILE` commands on the exact raw file. CONFIRMED = both print `valid:true`.
   Then `cmp` the two lines; any difference is a dissent, hence `UNKNOWN`.
3. Report the remaining `claims` as they are (UNKNOWN / NOT_CHECKED); do not upgrade them.
4. On dissent follow AUTHORITY.md step 4 and do not edit a checker to make them agree.
5. Never use Python to confirm or to break a tie.
6. Run time on a shared two-core machine: Julia about 35 s (8 modes) to 50 s (18 modes);
   Flix with `-Xmx768m` about 2 to 4 minutes. Run long jobs in the background with a log.
