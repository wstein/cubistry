# German and English calendar cubes

The [calendar page](../calendar.html) implements #63 with two separate fixed 3×3
prints. They are not a bilingual print and do not replace the existing counters,
timers, or live clock.

| Print     | Top row                                        | Middle row                 | Bottom row                 |
| --------- | ---------------------------------------------- | -------------------------- | -------------------------- |
| Deutsch A | Two-letter weekday, left-aligned               | Blank, day tens, day units | Three month letters        |
| English 3 | Whole three-letter weekday on the left sticker | Three month letters        | Blank, day tens, day units |

English supports a leading zero or a real unprinted tens sticker for single-digit
days. Both modes use exactly the same physical print. German retains its leading
zero. Changing language explicitly installs a different print during setup.
There is no year printed on the cube and no special weekend color.

## Provenance and physical playback

[calendar-source.json](../calendar-source.json) pins the protected Research commit,
three complete source witnesses, and SHA-256 hashes of the derived runtime files.
The export is reproducible with `research/date-3x3/export-runtime.mjs` at that
commit. All three runtime files contain 2,562 weekday/month/day combinations,
including February 29 for every weekday. These cover the complete Gregorian
400-year cycle. The Research independent checkers validate the original routes;
the application regression additionally replays all 7,686 runtime targets and
their inverse routes, including upright centers and every nonblank glyph.

The scoped calendar engine models all 26 bodies and 54 immutable sticker frames.
It supports only legal outer face turns and whole-cube rotations. The existing
size-2 core/viewer contracts remain unchanged. The initial date is installed by
replaying its source route during setup. Subsequent changes follow the inverse
of the actual committed source route and the new date's route, canceling adjacent
turns of the same face. Full endpoint equality is checked before committing.
Identical visible dates may retain their existing full pose and source route.

These are validated feasible paths, not shortest date transitions. A date change
can require dozens of turns; the UI explicitly says Updating during motion. No
five-move bound from the HSM counter is claimed for a 3×3. A busy controller keeps
one active route and only the latest pending date. A failed route stops with an
error rather than installing an unverified pose.

## Live date and inspection

Live mode follows the browser's current local date. A visibility change or return
from suspension checks today's date directly, without replaying missed days.
The control display shows the requested date and time zone. The physical face
commits after its legal route finishes. Date inspection accepts Gregorian dates
from 0001-01-01 through 9999-12-31, rejects invalid days, and does not interpret an
ISO civil date as a local UTC timestamp. Live returns to the current local date.

## Original artwork

The immutable [vector sticker sources](../assets/calendar/manifest.json) use the
locally distributed Noto Sans 600 font, package version and SHA-256 recorded in
that manifest. The SIL Open Font License is retained in
[OFL.txt](../public/fonts/OFL.txt). Each SVG embeds the licensed font, uses a
256-unit viewBox and 14 mm square dimensions, and maps back to exact sticker IDs.
Digit, weekday, and month colors and font sizes share the same artwork function
as the WebGL previews. The web preview rasterizes the local font to 256×256 texture
canvases; it never replaces a sticker during motion. Reproduce the SVGs with
`node scripts/export-calendar-art.mjs`. These original glyph designs do not copy
the referenced commercial calendar cube artwork.

## Checks and limits

```sh
npm run check
npm run test:e2e -- tests/browser/calendar.spec.mjs
node scripts/export-calendar-art.mjs
```

Tests cover all targets and inverse routes, the complete Gregorian cycle,
physical blank padding, exact full-state continuity, bounded request coalescing,
error propagation, leap-day midnight, date inspection, responsive rendering,
real browser animation, and runtime integrity rejection. Independent review is
required before clearance. General bilingual feasibility and shortest-path
optimization remain UNKNOWN; neither is required by the selected two prints.
