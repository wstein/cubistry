# German whole-label weekend candidates

These new fixed-print candidates support complete two- or three-letter weekdays on
one sticker. They do not replace the existing German A print. The three-letter
vocabulary is MON, DIE, MIT, DON, FRE, SAM, SON. Saturday and Sunday stickers are
permanently red (`#ba302c`) and extra bold (weight 800); appearance is carried by
physical sticker identity, never changed when the date changes.

| Candidate | Rows, top to bottom | Weekday | Month | Verified targets |
| --- | --- | --- | --- | --- |
| C1-2 | Weekday / day / month | One two-letter sticker | One whole-label sticker | 2,562 |
| C1-3 | Weekday / day / month | One three-letter sticker | One whole-label sticker | 2,562 |
| C2-2 | Weekday / month / day | One two-letter sticker | One whole-label sticker | 2,562 |
| C2-3 | Weekday / month / day | One three-letter sticker | One whole-label sticker | 2,562 |

C1 preserves the requested German row order. C2 is an alternative, not an approved
replacement. Both intentionally move the entire month abbreviation onto one
sticker, unlike the existing German A print. The day retains adjacent digits and
a leading zero. All remaining front cells are genuine blank stickers.

## Evidence and scope

**SAT:** all four saved witnesses pass the separately implemented Rodrigues
geometry validator. Each covers all 2,562 distinct weekday/day/month patterns in
the 146,097-day Gregorian 400-year cycle. Verification replays legal face turns
and explicit whole-cube rotations, checks all upright nonblank front frames,
fixed source-sticker styles, and full inverse restoration of every sticker.

An independent review separately reran the three-letter candidates and inspected
the checker and image; see [review](INDEPENDENT_REVIEW.md). The source generator's
baseline and solver version are retained in
[generator provenance](generator-provenance.json). Two-letter witnesses derive
from a bijective relabeling of whole weekdays, preserving every move and frame.

**UNKNOWN:** shortest routes and optimized day-to-day move counts for these new
prints. The verification JSON's `sourceToTargetHTM` describes initialization from
the fixed source pose, not adjacent calendar changes. C1 may need visible-center
orientation correction; C2 uses blank centers. These are distinct print layouts,
not a bilingual-print result.

## Reproduce

From this directory, with Python 3:

```bash
python verify-layout.py witnesses/de-weekend-c1-3.json candidates/de-weekend-c1-3.json
python verify-layout.py witnesses/de-weekend-c2-3.json candidates/de-weekend-c2-3.json
python verify-layout.py witnesses/de-weekend-c1-2.json candidates/de-weekend-c1-2.json
python verify-layout.py witnesses/de-weekend-c2-2.json candidates/de-weekend-c2-2.json
```

The validator imports the existing independent geometry engine from the parent
research directory, not solver geometry. Witness generation uses the pinned
`cubing@0.66.1` dependency described in the parent research recipe; do not overwrite
saved witnesses with randomized solver output.

## Artwork

[Comparison PNG](images/four-german-weekend-proposals.png) and
[embedded-font SVG](images/four-german-weekend-proposals.svg) show November 7 and 8,
2026. These original front-view concepts derive from checked witness cells;
they are not manufacturing cut plans. Font files and the OFL license are retained
under `images/fonts/`; hashes and preview provenance are in
[concept metadata](images/concepts.json). Reproduce the previews with
`python render-concepts.py` after installing `requirements-art.txt` in an isolated
environment. The existing English artwork is unchanged.

## Rejected presentation scope (October 29, 2026)

The user rejected whole-month abbreviations on one sticker. All C1/C2 candidates
above use that presentation and therefore are **not accepted product proposals**,
even though their physical feasibility evidence remains valid. Keep the existing
German A front: weekday / day / month, with the month spread across three cells.
A future whole-weekday sticker may be considered only if it retains that month
presentation. No new layout or red-weekend feasibility claim follows from the
rejection; the saved candidates and witnesses remain unchanged as historical
research.
