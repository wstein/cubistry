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
There is no year printed on the cube. English SAT and both SUN stickers carry
permanent red, extra-bold (800) artwork; regular weekday stickers retain 600.
This is source artwork, not a date-driven rendering override. German A retains
its original artwork: its O sticker is shared by MO, DO and SO, and the exact
fixed-layout fully red/bold requirement has a separate conditional impossibility
proof under Research `055b38f`. A different German treatment requires an explicit
layout or styling decision; a partial red S is not silently substituted.

Use **Present** for the [presentation layout](PRESENTATION_MODE.md), with native
fullscreen when supported. **Reference view** restores the camera without
changing the displayed value, print, date or active motion.

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
replaying its source route during setup. Subsequent changes use a bounded, worker-based direct relative solver from the
actual physical pose. The inverse actual source route followed by the new setup
route remains a checked fallback, not the default optimization strategy. Every
selected move is replayed and the full endpoint is checked before committing.
Identical visible dates may retain their existing full pose and source route.

These are validated feasible paths, not shortest date transitions. The earlier
unconnected optimizer caused 40–85-turn setup detours. The connected solver
reduces the October 28 → 29, 2026 examples from 79 to 19 HTM for German A and
77 to 17 HTM for English 3, preserving both prints. Some transitions can still
require more than 20 moves, particularly visible-center orientation repairs.
The UI identifies optimized routes and verified fallback routes honestly. No
five-move bound from the HSM counter is claimed for a 3×3. A busy controller keeps
one active turn and only the latest pending date. Changing the date during
motion finishes the current legal turn, abandons the remaining obsolete route,
and replans from the exact committed 54-sticker pose. The source reference is
updated after every turn, so partial routes never reset hidden states. A date
selected during planning supersedes that plan before its first turn. A failed route stops with an
error rather than installing an unverified pose.

## Live date and inspection

Live mode follows the browser's current local date. A visibility change or return
from suspension checks today's date directly, without replaying missed days.
The control display shows the requested date and time zone. Choosing a date
starts its legal route immediately; Enter applies the date from the keyboard.
The Today button returns directly to live local-date tracking. The −1 day and +1 day controls operate on the latest
selected date, so rapid presses retain the latest civil-date intent while only
one active physical turn and one pending request exist. The physical face
commits after its legal route finishes. Date inspection accepts Gregorian dates
from 0001-01-01 through 9999-12-31, rejects invalid days, and does not interpret an
ISO civil date as a local UTC timestamp.

The drawing buffer follows the display pixel ratio, while the canvas retains the
CSS dimensions of its viewport. The camera fits the complete cube turn/orbit
envelope to both viewport axes after resizing, keeping the cube clear of the
adjacent controls on desktop and within the narrow mobile viewport.

## Transition counts

The move display reports completed/total outer-face HTM and completed/total
whole-cube rotations separately. A half turn counts as one HTM; x/y/z rotations
never count as HTM. Initial setup is excluded. Counts use the actual committed
physical pose, including hidden orientations. Neighbor routes are calculated
when selected; the page does not start competing background solver jobs merely
to populate idle estimates. These are exact counts for the selected playback
route, not shortest-path claims.

The controller also accepts an optional asynchronous route provider. Prepared
plans and estimates are bound to the exact source pose and retained reference
word. Only strictly shorter routes that replay to the required upright face are
accepted; invalid or failed solver output uses the checked baseline route. A
noncanonical endpoint retains its actual source-to-pose path rather than being
replaced by a canonical setup. Optimized endpoints usually keep noncanonical
hidden center orientations, so this retained reference, and with it the inverse
reference plus setup fallback, grows by roughly each executed route's length per
committed date change. In a local 40-day chain of +1 days, the fallback grew from
79 to 1,012 turns for German A and from 77 to 759 for English 3 while the
optimized routes stayed at 11–41 turns. The fallback remains legal and checked,
but after a long session it can be hundreds of turns; bounding it is open work.
The default application connects this provider to the pinned Research
[transition optimizer](../src/apps/calendar/transition/provenance.json). It has
a soft 500 ms search budget between at most six solver attempts and a hard
8-second worker deadline including cold startup. Timeout, worker errors, invalid
results, or a candidate that is not strictly shorter preserve the checked
fallback. A single worker handles one solve and one replaceable pending request;
no unbounded queue of solver jobs is retained. Browser restoration from the
back/forward cache preserves the provider. The solver is `cubing@0.66.1`;
production builds use ES worker chunks with module-relative asset paths. Shared
solver code is isolated in a vendor chunk, while nested search entry points stay
separate from the calendar worker message handler. The bundler-aware search entry
URL is used directly. Production browser regressions exercise both prints from
a static build under the deployment base path.

## Original artwork

The immutable [vector sticker sources](../assets/calendar/manifest.json) use the
locally distributed Noto Sans 600/800 fonts, package version and SHA-256 hashes recorded in
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
npm run test:e2e -- tests/browser/calendar.spec.mjs tests/browser/calendar-optimizer.spec.mjs
node scripts/export-calendar-art.mjs
```

Tests cover all targets and inverse routes, the complete Gregorian cycle,
physical blank padding, exact full-state continuity, bounded request coalescing,
error propagation, leap-day midnight, date inspection, responsive rendering,
real browser animation, and runtime integrity rejection. Independent review is
required before clearance. General bilingual feasibility and shortest-path
optimization remain UNKNOWN; neither is required by the selected two prints.
