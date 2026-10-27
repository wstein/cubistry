# German baseline, 1900–2099: frozen printing independently verified SAT

This is the scoped baseline review for [issue #5](https://github.com/wstein/cubistry/issues/5),
performed after the [English investigation](ENGLISH_BASELINE_1900.md).
No new printing was synthesized, no wider-century experiment was run, and the
bilingual issue remains deferred.

## Frozen witness and exact display model

The source is the existing **two-hundreds construction**, not either 24/24
alternative:

* [Immutable 150-sticker witness](../results/german-century-09.json)
* [Complete physical source-printing plan](../results/german-century-09-printing.csv)
* Input revision: `fbfb2f628b2c75936453b566d2a9a1b21ce65295`.

That prior witness has a wider supported domain. This review freezes its exact
printing, then independently checks **only 1900-01-01 through 2099-12-31**.
No prior SAT label or stored reachability certificate is accepted as proof.
Every sticker ID, source cubie, image, ink, and print-up vector remains unchanged.
The original evidence files are neither edited nor replaced.

The front rows are:

1. German weekday plus two blanks: MON, DIE, MIT, DON, FRE, SAM, SON.
2. Zero-padded day and month: JAN, FEB, MÄR, APR, MAI, JUN, JUL, AUG, SEP, OKT,
   NOV, DEZ. The leading day zero is an actual red numeral.
3. Split year `19 89` / `20 26`, with the fixed center permanently unprinted.
4. Blank, left logo image, middle logo image, right logo image, blank. Three
   fixed physical center stickers carry three distinct complete upright images.
5. Zero-padded 24-hour time, including `00:00` and `23:59`.

Inks are unchanged: weekday dark, day/month red, year gray, time digits blue,
colon red. Blank means no printing. Each wordmark fragment includes all internal
colors as part of its immutable image identity; no fragment swapping, reflection,
recoloring, or artwork symmetry is admitted. The source-plan logo IDs are
6, 32, 8, left/middle/right, with source print angles 270°, 180°, 90° CCW.

The target domain is **73,049 Gregorian dates × 1,440 minutes = 105,190,560
complete display targets**. Weekdays are generated without timezone conversion.
The Gregorian leap rule excludes 1900-02-29 and includes 2000-02-29.

## Independent review and physical completion

The [new scoped checker](../scripts/verify_german_baseline_1900.py) independently
constructs the exact calendar and time targets. It does not invoke the broad
century generator or reuse its date projection lists. It checks the 150-entry
CSV against the frozen physical images, inks, source identities, and canonical
print angles. Only projection-count metadata changes in a private in-memory
copy; the physical printing is asserted equal to the source witness.

The existing independent [physical group engine](../scripts/verify_german.py)
rebuilds its own lattice, proper rigid orientations, and twelve noncentral
single-layer quarter-turn generators. A new optional target-pattern argument
lets the scoped checker provide its independently enumerated patterns; the
engine requires all moving cubie classes and their complete physical front
positions. Default behavior for earlier callers is unchanged.

All printed nonfixed glyphs and logo images are checked **strictly upright**.
Only blanks use rotational equivalence. Every target projection must select
distinct whole physical cubies with matching immutable image, ink, and rigid
frame. There are 120 corner, 80 middle-edge, 9,360 wing, 160 axial-center, and
70 diagonal-center projections in this exact interval.

A fresh pinned SymPy 1.14.0 computation checks local group orders and even-subgroup
partial-placement transitivity, then proves the full labeled move group's
order equals the parity-compatible product. This supplies a complete legal
state for every compatible set of partial placements, including the unchanged
hidden printing. All six fixed-center stickers are blank, making their spins
optically irrelevant. Thus the result is **SAT with full legal completion**,
not merely a matching front face or a successful capacity count.

Three controls alter actual physical printing and must be rejected:

* Recolor the red leading-date-zero stickers blue: wing matching fails.
* Rotate the middle logo print by 90°: axial-center matching fails.
* Put a printed zero on the fixed front center: its required blank fails.

Boundary records include the first/last dates, 1900-02-28/03-01, the 1999/2000
transition, and 2000-02-29/03-01. All other valid dates and times are covered by
the full enumerated projections, not just these examples.

## Reproduction and evidence

After the existing setup, activate the environment containing the pinned
[verifier dependency](../requirements-verifier.txt):

```sh
. .venv/bin/activate
timeout 180 python3 scripts/verify_german_baseline_1900.py > /tmp/german-1900-verification.json 2> /tmp/german-1900-verifier.log
```

For both scoped baselines, in their requested order:

```sh
npm run verify:baselines
```

These commands do not run the broader-century synthesis scripts.

* [Saved independent verification output](../results/baseline-1900-2099/german-verification.json)
* [Exact group-engine execution log](../results/baseline-1900-2099/german-verifier.log)
* [Manifest: source/script hashes, versions, invocation, and limits](../results/baseline-1900-2099/german-manifest.json)

The model, physical printing, boundary records, negative-control outcomes, and
exact group certificate must reproduce. Runtime and memory measurements vary.
The preserved source witness's broader date counts are provenance, not the
new interval's counts; the scoped output states the new counts explicitly.

Limitations: the group calculation trusts pinned SymPy's exact finite-group
implementation. This is not a proof-assistant formalization or an independently
implemented second group-order library. The proof guarantees existence of a
legal completed state for every target; it does not export a move sequence for
every date/time. Artwork is validated as immutable upright full-image tokens,
not as final production SVG/bitmap pixels. Neither English feasibility nor a
shared bilingual printing follows from this German witness.
