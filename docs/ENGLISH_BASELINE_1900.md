# English baseline, 1900–2099: independently verified UNSAT

This completes the scoped investigation in [issue #4](https://github.com/wstein/cubistry/issues/4).
The finding concerns the English colored split-century Chronocube model below.
It is **not** a general impossibility claim about English calendar cubes.
No additional century experiment or bilingual investigation was performed.

## Frozen model

* Physical 5×5 cube: 150 labeled sticker positions on 98 surface cubies.
  Sticker image, ink, cubie identity, and print frame are immutable. The search
  allows arbitrary assignments of those images to physical stickers; no existing
  German or English candidate printing is presumed mandatory.
* Legal generators: twelve noncentral single-layer quarter turns, their inverses,
  and compositions. The checker independently verifies the lattice action and
  the paired-wing chirality invariant for every generator.
* Every valid Gregorian date from 1900-01-01 through 2099-12-31: **73,049 dates**.
  Every date supports all 1,440 minutes: **105,190,560 display targets**. Dates
  are timezone-independent. Gregorian rules exclude 1900-02-29 and include
  2000-02-29.
* Weekdays: MON, TUE, WED, THU, FRI, SAT, SUN. Months: JAN, FEB, MAR, APR, MAY,
  JUN, JUL, AUG, SEP, OCT, NOV, DEC.
* Rows: weekday plus two blanks; zero-padded day plus month; split year
  `19 89` / `20 26`; blank + left/middle/right upright wordmark images + blank;
  zero-padded 24-hour time `00:00` through `23:59`.
* Ink: weekday dark, day/month red, year gray, time digits blue, colon red;
  blanks unprinted. Each logo fragment is a fixed full image including its
  internal colors, in its own rigid upright frame.
* Optical equality preserves image/character identity and ink. The **negative
  proof relaxes orientation completely**, admitting every glyph rotation. A
  proof for that superset also excludes the upright physical artwork model.
  It does not rely on font-specific symmetries or 6/9 substitution.

There is no feasible English print plan to provide under this model. Instead,
the certificate quantifies over all immutable printings on the labeled physical
wing stickers, including orientations more permissive than the requested ones.
The full legal-state requirement cannot rescue a target set already impossible
on these physical wing pieces.

## Audit of existing evidence

The baseline input revision is `fbfb2f628b2c75936453b566d2a9a1b21ce65295`.
[Original English monochrome evidence](../results/english-monochrome.json)
concerns the original year/separator model. The
[short-separator English certificate](../results/english-short-separator.json)
uses a leading day blank, not the newly required leading red zero. The
[German split-century witness](../results/german-century-09.json) establishes
neither English nor bilingual feasibility. These artifacts were inspected and
hashed, not overwritten or silently widened.

The new generator uses the existing ReScript calendar and split-year formatter.
The separate standard-library-only Python checker imports **none** of the
research generators, geometry modules, or earlier verifier code. It rebuilds
calendar targets, physical lattice, legal rotations, ink identities, required
multiplicities, and actual-calendar co-occurrence independently.

## Independently checked wing contradiction

There are **24 physical wing cubies**, each carrying one sticker in each of two
invariant chirality orbits, A and B. Front slots, with zero-based row-major
indices, are A=(1,9,15,23), B=(3,5,19,21).
Each immutable nonblank glyph/ink identity can serve only one required role on
its sign side. This follows from the actual ink distinctions and alphabet,
without restricting glyph rotations. Blank slots share an optical type, but
simultaneous blank multiplicities are retained.

The new calendar enumeration checks 234 date-wing projections, 60 time-wing
projections, and all **14,040 joint wing projections**. It finds:

* A requires total peak inventory 23, leaving one surplus sticker among 24.
  At most two A stickers can belong to types with a spare alternative.
* B requires total peak inventory 16, including two simultaneous blanks.
  Eight surplus stickers can loosen at most eight types, removing at most
  `2+7=9` required copies from tight types. At least **seven B stickers remain
  tight**, meaning every copy of that type is forced when its peak occurs.
* The only never-coexisting opposite-side peak pair is the final B of FEB and
  day tens 3. February has neither day 30 nor day 31. This supplies at most one
  exceptional physical pairing.

A tight B sticker cannot share its physical cubie with a tight A sticker when
their peaks coexist: that display would require both faces of the same cubie
on the front. Consequently the at least seven tight B stickers would have to
fit at most two loose A partners plus one exceptional partner:

```text
7 > 2 + 1
```

More generally, if type peaks are m and the surplus is s, at most s types can
have surplus copies. Their total loose sticker count is bounded by s plus the
sum of the s largest peaks. Removing those peaks also gives the tight-copy
lower bound on the opposite side. For every peak-incompatible type pair, at
most the smaller peak can supply exceptional pairings. These integer bounds
are necessary for **every** immutable coupled-wing print, not merely the
previous candidate. Their contradiction is the impossibility proof.

## Evidence, reproduction, and review

* [Candidate and complete required multiplicities](../results/baseline-1900-2099/english-candidate.json)
* [Independent verification output](../results/baseline-1900-2099/english-verification.json)
* [Manifest with input hashes, commands, and versions](../results/baseline-1900-2099/english-manifest.json)
* [Generator](../scripts/english-baseline-1900.mjs)
* [Independent checker](../scripts/verify_english_baseline_1900.py)

After the standard Node setup, reproduce without overwriting the frozen evidence:

```sh
npm run build
timeout 60 node scripts/english-baseline-1900.mjs > /tmp/english-1900-candidate.json
timeout 60 python3 scripts/verify_english_baseline_1900.py /tmp/english-1900-candidate.json > /tmp/english-1900-verification.json
cmp /tmp/english-1900-candidate.json results/baseline-1900-2099/english-candidate.json
```

Python 3.12.14 and Node 24.19.0 were used. No numerical/SAT solver, random seed,
or external Python dependency is needed for this UNSAT checker. Runtime and
resident-memory fields may vary; the model, hashes, required multiplicities,
co-occurrence exception, and contradiction must agree. The checker exits
nonzero on inconsistent scope, certificate data, or absent contradiction.

Proof review: the fixed print is quantified rather than changed per target;
physical wing coupling is established independently, not discarded as a pooled
sticker count; the changed layout/date padding is enumerated afresh; the only
exception is checked on actual calendar data; arbitrary rotations make the
negative result stronger than the requested upright-image model. No full
English state witness is claimed. Different colors, vocabulary, or layout
require a new analysis and are outside issue #4.
