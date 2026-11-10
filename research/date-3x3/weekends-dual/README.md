# German A red-only weekend obstruction

The requested change keeps the deployed `calendar.html` German A print layout:
`MO, DI, MI, DO, FR, SA, SO` across two separate top-left cells, day across the
middle row, and individual month letters across the bottom row. Both letters of
SA and SO become permanently red; font weight stays 600. All other ink, position,
upright-print and fixed-sticker rules remain unchanged. This is the 3×3 `de-a`
application, not the separate 5×5 or 7×7 calendars.

## Frozen inputs and provenance

The original model and certificate are copied without changes from
`research/date-3x3/weekends/` at Research
`f76ea3117fa314e8742da088882dc8b2c6d7a41a`. The new requested model changes only
`weekend.weight` from 800 to 600 and the corresponding scope sentence. The new
certificate changes only its model hash. `controls.jl` checks these exact semantic
deltas before running either checker. No retained proof or production print is
modified.

The application at main `b8e161846f4e83e4ea7bbf0b449a0a035e190f69` pins
`research/date-3x3/witnesses/de-2.json` SHA-256
`f367e0ba9c5195801d1f10d2eb220bff329ee9de58452684abb201ce35e0c235`.
Its local and deployed `calendar/de-a.json` have identical SHA-256
`1f5ecf89f4127ac1dd27e662c51193ca7d24677ba49abbca2737e306dc9cef56`.
`calendar.html` defaults to German A; its only other choice is English 3.
`src/apps/calendar/model.ts` requires every nonblank print upright, without optical
aliases; blanks are orientation-neutral. The runtime contains 2,562 targets:
each weekday combined with each of 366 valid month/day patterns. Its civil-date
range is 0001–9999; the proof recomputes the complete 2000–2399 Gregorian cycle,
which is inside that range.

## Demand and physical capacity

| Physical pool | Mandatory nonblank images | Blank demand | Sticker capacity |
| --- | ---: | ---: | ---: |
| Corners | 22 | 1 | 24 |
| Edges | 22 | 1 | 24 |
| Centers | 4 | 1 | 6 |

These raw necessary counts fit. They do not prove physical feasibility. The
existing edge print uses four weekday images, eight month images (two brown O
copies), ten digits and two blank faces. A red O could replace a duplicated
brown O in a face-count calculation; the edge-body coupling still prevents a
solution under the retained rules.

The four front edge fields need dark O/I/R plus red A/O (5), brown month
A/E/Ä/P/U/K/O (7), green digits 0–9 (10), and one genuine blank. The checkers
independently enumerate 146,097 dates and verify all 350 = 5 × 7 × 10 active-field
combinations occur. All 22 mandatory images are distinct because their glyphs
and four fixed ink colors differ. The argument does not require heavier weekend
font weight. It permits arbitrary orientations, parity, centers, corners and
reachability, so none can repair a contradiction in this relaxed edge model.

There are twelve physical edges, each with two sticker faces. Let k be the
number of blank edge faces. With zero, the blank cannot be shown. With one, or
two on the same body, that blank-bearing body is reserved whenever displaying a
target. The remaining 22 faces must carry all 22 mandatory images exactly once;
any duplicated or unnecessary partner can only be on the removed body. Every
cross-field label pair occurs together, so the remaining bodies must pair within
fields. Sizes 5 and 7 are odd, which is impossible.

With two blank faces on different bodies, all 22 nonblank faces are exactly the
22 mandatory images, with no duplicates or unnecessary partners. The checkers
validate all 231 distinct partner pairs: 155 cross-field pairs would occupy both
blank-bearing bodies simultaneously, leaving no blank; 76 same-field pairs
leave an odd within-field pairing after removing two labels. Three or more
blanks require at least 25 faces, exceeding 24. This exhausts the blank cases.

Therefore the scoped finite edge obstruction is UNSAT when both native checkers
accept. This is not a theorem about changed layouts, shared role colors, word
fragments, movable fields, optical aliases or arbitrary German calendar cubes.
Recoloring only S would be a partial weekend marker and needs a separate design
decision. A whole-weekday sticker with separate month letters needs new evidence;
no alternative print is selected here.

## Native checks

The Julia checker uses `Dates` to enumerate the domain. The Flix checker computes
Gregorian weekdays by integer arithmetic. Both read the raw model and certificate,
check pinned model hashes, recompute coverage, validate each retained date and
exhaust all partner pairs. Neither imports or executes the historical Python
verifier. This additive research profile is separate from the frozen issue-74
checker corpus; its model and certificate have their own pins.

Author runs: Julia 1.11.5 with JSON 1.13.0; Flix 0.79.0 on Java 21.0.13.
Both accept both the historical 800 and requested 600 model with identical
results: 146,097 dates, 350 combinations, 22 images, 231 pairs, 155 cross-field
conflicts and 76 parity conflicts. Ten negative controls are rejected by both:
missing coverage, incorrect date, missing pair, duplicated pair, incorrect
remaining count, incorrect budget, floating-point version, incorrect model
binding, changed ink and duplicate JSON key. See `evidence/author-controls.tsv`.
Independent review is pending; this is not yet a confirmed delivery claim.

From this directory, with Java 21 and Julia 1.11.5 available:

```sh
julia --startup-file=no --project=. -e 'using Pkg; Pkg.instantiate()'
(cd flix && ./flixw build-fatjar --threads 2)
julia --startup-file=no --project=. check.jl requested-model.json requested-certificate.json
java -Xmx768m -jar flix/artifact/flix.jar requested-model.json requested-certificate.json
julia --startup-file=no --project=. controls.jl
```

Use a scratch `JULIA_DEPOT_PATH` and Flix caches. `JAVA` and `FLIX_JAR` optionally
select already installed binaries; the controls run native processes serially.
Build setup and the complete mutation sweep are not production tests; the full
mutation sweep was not run. No solver search, runtime change, publication, workflow
start or print export was performed.
