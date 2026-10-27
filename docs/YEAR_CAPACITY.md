# Year capacity: 2000–2099 certified, fixed-center limit identified

The German zero-day wordmark design now has a separately certified extension
covering **all 36,525 dates in 2000–2099 and all 1,440 minutes per date**.
This includes the Gregorian leap day in 2000. Red date digits, blue time digits,
three upright full-color-capable image fragments, and outer logo blanks remain.
One immutable printing covers the entire range; no stickers change between years.

Run `npm run experiment:years` after the standard setup, or
`python3 scripts/extend-years.py --verify` to check the saved certificate.
`results/german-wordmark-2000-2099.json` contains every physical sticker identity,
ink, source position, and print-up vector, plus the freshly recomputed exact
legal-group certificate. The independent verifier now accepts an explicit
inclusive year range; old reports default to their original 2020–2049 range.
It independently re-enumerates all dates and all rigid-cubie target matchings.

## The four year positions have different physical resources

The year row is `·2026` (dot means blank):

| Year place | Front row/column | Physical orbit | Current consequence |
| --- | --- | --- | --- |
| Thousands | (3,2) | Axial centers, 24 | Gray 2 already printed; extra thousands need suitable extra printing |
| Hundreds | (3,3) | Single fixed front center | Permanently gray circular 0 |
| Tens | (3,4) | Same axial-center orbit | Expanded to all ten gray digits |
| Units | (3,5) | Paired middle edges | Already covers all ten gray digits; reverified with expanded range |

The 24 axial centers also carry eight distinct red month-middle letters
and the upright middle logo image. Before extension they carried one gray
thousands 2 and three gray tens digits (2,3,4), leaving 11 unprinted positions.
Adding tens digits 0,1,5,6,7,8,9 consumes seven such positions and leaves four.
These are physical-position counts, not globally optimized usable reserves.
Other blank stickers cannot be substituted freely across different orbits.
No blanket reserve claim from the previous space-day printing is transferred.

## Historical years and larger ranges

With fixed positions and the same front face, the hundreds digit must be 0.
This is a structural obstacle independent of extra sticker capacity:

* 1900–1999 requires a 9 on the fixed center and is impossible under the current
  fixed-front, fixed-printing layout. Supporting it together with 2000–2099
  requires changing a display/physical assumption.
* 1000–1099 has hundreds digit 0, so it avoids that obstruction. An additional
  gray thousands 1 is plausible from the remaining axial capacity. This is an
  assessment, **not a certified combined 1000/2000 witness**.
* Other `x000–x099` windows similarly avoid the fixed-center obstruction, but
  every extra thousands type competes with month letters, tens, and the logo.
  No maximum set of jointly supported windows has been established.
* Year 100 right-aligned as `0100` or ` 100` puts 1 on the fixed center, so it
  cannot use the current layout. Leading blanks or leading zeros do not fix
  that particular position. A changed alignment is a new layout requiring proof.

It is therefore misleading to describe capacity as a single maximum year.
The verified contiguous range is now 2000–2099. Broad historical coverage would
benefit from moving the year off the fixed center (or another explicitly revised
physical/display design), followed by a new joint-printing and reachability proof.

Historical dates here would use the proleptic Gregorian calendar. Actual local
historical calendars and their transition dates would require an explicit
calendar convention. Production logo artwork remains asset-agnostic as before.
