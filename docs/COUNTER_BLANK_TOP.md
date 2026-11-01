# Blank-top Counter print (variant)

The Counter application offers two permanent sticker prints. **COUNTER title**
is the default and is unchanged: two title fragments on top, at most 5 HTM per
edge, 339 HTM for 00→99 ([certified traversal](COUNTER_CERTIFIED_TRAVERSAL.md)).
**Blank top 00–99** is a second print for the same application: both top cells
always show a blank sticker, and the bottom row shows the number. It comes from
research PR [#134](https://github.com/wstein/cubistry/pull/134)
(`research/counter-99-blank-top`, pinned commit
`22fe5842c4c59e54789c865914e70abb7cfcb24c`). The variant shares the Counter
controller, renderer, PuzlWerk solver adapter and traversal code with the
titled print; only the print, its stored routes and its display targets differ.

## Physical reprint required

> **Owner decision.** The blank-top print is a different physical cube. **23 of
> its 24 sticker identities differ from the titled print**; only sticker 22
> (corner 7, normal (0, 1, 0), digit 8, up (0, 0, −1)) is the same. Do not mix
> titled and blank-top stickers on one cube. A cube assembled from titled
> stickers must stay on the COUNTER title print in the application, and a
> blank-top cube must use the Blank top print. The titled print stays the
> default, so cubes made from already printed titled sheets keep working.
> Whether to print blank-top stickers is the owner's decision.

Sticker IDs, corners (cubie IDs) and normals are the titled print's canonical
source geometry ([counter-design.v2.json](../public/counter-design.v2.json),
`prints.padded`). Up vectors are print-up vectors in the printed (source) state.

| Id | Corner | Normal | COUNTER title print | Blank-top print |
| ---: | ---: | --- | --- | --- |
| 0 | 0 | (−1, 0, 0) | title left, up (0, 0, −1) | 2, up (0, 1, 0) |
| 1 | 0 | (0, −1, 0) | 9, up (0, 0, 1) | 8, up (0, 0, 1) |
| 2 | 0 | (0, 0, −1) | 7, up (1, 0, 0) | 6, up (1, 0, 0) |
| 3 | 1 | (−1, 0, 0) | title left, up (0, −1, 0) | **blank** |
| 4 | 1 | (0, −1, 0) | 2, up (1, 0, 0) | 4, up (1, 0, 0) |
| 5 | 1 | (0, 0, 1) | 5, up (0, 1, 0) | 0, up (0, 1, 0) |
| 6 | 2 | (−1, 0, 0) | 0, up (0, 0, 1) | 1, up (0, −1, 0) |
| 7 | 2 | (0, 1, 0) | 8, up (1, 0, 0) | **blank** |
| 8 | 2 | (0, 0, −1) | 6, up (0, −1, 0) | 6, up (1, 0, 0) |
| 9 | 3 | (−1, 0, 0) | 3, up (0, −1, 0) | 9, up (0, −1, 0) |
| 10 | 3 | (0, 1, 0) | 4, up (0, 0, −1) | 5, up (0, 0, −1) |
| 11 | 3 | (0, 0, 1) | 1, up (1, 0, 0) | **blank** |
| 12 | 4 | (1, 0, 0) | title right, up (0, 0, −1) | 5, up (0, 1, 0) |
| 13 | 4 | (0, −1, 0) | 1, up (0, 0, 1) | 2, up (0, 0, 1) |
| 14 | 4 | (0, 0, −1) | 6, up (−1, 0, 0) | 9, up (−1, 0, 0) |
| 15 | 5 | (1, 0, 0) | title right, up (0, −1, 0) | 7, up (0, 0, −1) |
| 16 | 5 | (0, −1, 0) | 7, up (−1, 0, 0) | 4, up (−1, 0, 0) |
| 17 | 5 | (0, 0, 1) | 3, up (0, 1, 0) | 0, up (0, 1, 0) |
| 18 | 6 | (1, 0, 0) | 5, up (0, 0, 1) | 7, up (0, −1, 0) |
| 19 | 6 | (0, 1, 0) | 9, up (−1, 0, 0) | 1, up (0, 0, 1) |
| 20 | 6 | (0, 0, −1) | 2, up (0, −1, 0) | 3, up (−1, 0, 0) |
| 21 | 7 | (1, 0, 0) | 4, up (0, −1, 0) | 3, up (0, −1, 0) |
| 23 | 7 | (0, 0, 1) | 0, up (−1, 0, 0) | **blank** |

The blank-top print has 20 digit stickers (each digit once for tens, once for
units) and 4 blanks, and no title. Its printed state already shows 00 in LZ mode;
the titled print needs its 5-HTM setup `U2 F' L U' R'` to show 00.

## Two physical modes on one print

| Mode | Values | Edges | Max HTM | Edges at 1 / 2 / 3 / 4 | Lap total | Setup from the printed state |
| --- | --- | ---: | ---: | --- | ---: | --- |
| LZ (leading zero) | 00..99, wraps 99→00 | 100 | 4 | 8 / 9 / 80 / 3 | 278 HTM | none (shows 00) |
| NZ (no leading zero) | _0.._9, 10..99, wraps 99→_0 | 100 | 4 | 9 / 13 / 77 / 1 | 270 HTM | `L' U B' U L2 U` (6 HTM) |

In NZ, the tens cell shows a blank sticker for 0..9. Each mode is one closed
cycle of complete cube states: after 100 increments the cube is back in the exact
start state, so counting can continue forever. Decrements are the exact inverse
words, so decrement statistics equal the increment statistics. The 6-HTM NZ setup
is also the switch from LZ 00 to NZ _0; the way back is its inverse
`U' L2 U' B U' L`. That word is not claimed to be shortest.

**Provenance of the numbers.** The modes, edge counts, maxima, histograms, totals
and setup words are research results from PR #134. Both native checkers (Julia
and Flix) accept them, their receipts are byte-identical per mode, and an
independent review comment on PR #134 covers the pinned head. They remain
candidates in the sense of [the proof authority](../proof-checkers/AUTHORITY.md)
until the owner accepts the research PR. **Max 3 HTM is UNKNOWN**, for this print
and for all prints. The application tests below reproduce the numbers in the
app's own mechanics; they are regression tests, not proofs.

**Application finding (not a research claim).** Replaying both modes in the app
shows that LZ and NZ store the identical complete cube state for every value from
31 to 99. The application uses this to allow a mode switch there without a turn
(see below). The unit tests pin this range.

## Controls and behavior

- **Sticker print** (Counter controls): *COUNTER title (default)* or *Blank top
  00–99*. Changing it is an explicit new-print operation, like an application
  change: the selected print is installed in its canonical state for the current
  value, without animating or counting a setup, and session moves restart at 0.
  It is disabled while turns play or Run is active. The choice persists on reload.
- **Leading Zero on the titled print** is unchanged: it masks only the leading 0
  on screen and never changes the print, state or moves
  ([cube-first UI](CUBE_FIRST_UI.md)).
- **Leading Zero on the blank-top print selects the physical mode** (checked: LZ,
  unchecked: NZ). On this print the checkbox is labeled **Leading zero mode
  (physical)**; the titled print keeps the label *Leading Zero*. The longer label
  sits on its own line below Wrap. It is enabled only while the cube is idle and
  Run is off, and only at:
  - **0**: the switch plays the 6-HTM word (LZ 00 → NZ _0) or its inverse. Every
    turn is animated and committed to the cube state.
  - **31–99**: both modes hold the same complete state, so the switch plays no
    turn and changes no hidden state; only the stored route changes.
  - Elsewhere (1–30) the checkbox is disabled and the note says where to switch.
  The controller refuses a switch unless the cube is in the active mode's
  canonical state for that value and the word reaches the other mode's canonical
  state for the same value.
- **Setup moves**: switch turns are shown in a separate *Setup moves* counter
  below the Leading Zero note. They are not added to session moves, do not start
  a new sequence number and do not count as a step. The counter restarts when a
  print is installed. The status line reads *Switching to … · n / 6 setup moves*.
- **Counting**: +1, −1, ±10, Set and Run behave as on the titled print. Adjacent
  steps on the canonical route use the stored research word or its exact inverse.
  On this print the stored route also includes the 99→00 edge, so 99→0 and 0→99
  (with Wrap, or Set from an adjacent value) use the stored 4-HTM (LZ) or 3-HTM
  (NZ) wrap word instead of the solver.
- **Wrap defaults to on for the blank-top print** (its stored routes are cyclic),
  so +1 at 99 and −1 at 0 use the stored wrap word by default. The titled print
  keeps Wrap off by default. Wrap is not saved: on load it starts at the active
  print's default. When the print changes, Wrap follows the new print's default
  unless the user has toggled Wrap since the page loaded; then that explicit
  choice is kept for the rest of the page session.
- **Arbitrary jumps and noncanonical states** use the existing shared PuzlWerk
  `exactPhysical` solver (24 virtual coordinate frames, both directions) from the
  authoritative state to the complete canonical state of the active mode. The
  completed display is checked against the blank-top target: blank top cells (any
  quarter turn), digit stickers upright. Solver turns are animated and counted
  as session moves; no state is changed silently.
- **Eligibility** for stored steps compares all eight cubie IDs, positions and
  body frames with the active route of the configured print. Visible digits are
  not enough: a back-face turn keeps the display but makes the next step use the
  solver. A titled state is never eligible on the blank-top routes (different
  print identity), and an LZ state below 31 is not eligible on the NZ route.
- **Reload** restores the saved value, print and mode directly in canonical
  state, like the titled print; it never resumes Run or replays a setup. If the
  blank-top runtime cannot be loaded, the page says so and shows the titled print.
  The URL parameter `?print=blank-top` selects the variant on load.

### Owner decisions on the UI questions

1. A print change keeps the current value (unchanged behavior).
2. The zero-move switch at 31–99 stays (unchanged behavior).
3. Wrap defaults to on for the blank-top print only; the titled print keeps Wrap
   off (see Controls and behavior for the exact default and persistence rules).
4. The checkbox is labeled *Leading zero mode (physical)* on the blank-top print;
   the titled print keeps *Leading Zero*.

5. (a) Shared links should carry the sticker print, so a shared link restores
   the blank-top print. **Open, not implemented:** the Counter generates no
   share link today (the only generated link, *Print stickers*, is hidden for the
   Counter, and value and mode are not encoded in any URL); `?print=blank-top`
   already selects the variant on load. How to carry the print (for example in
   the page address) is still to be decided.
   (b) **Deferred:** the blank-top net does not join the Print stickers page.
   Printing fixes the sticker identities, max 3 HTM for this print is UNKNOWN so
   a better print may follow, the independent review of PR
   [#144](https://github.com/wstein/cubistry/pull/144) is still open, and a
   reprint is the owner's call.

## Data, pins and verification

| File | Role |
| --- | --- |
| [counter-blank-top-source.json](../counter-blank-top-source.json) | Repository, branch, commit, SHA-256 of every pinned research file, app copy paths, canonical source, runtime path and hash, review status |
| [data/counter/blank-top/](../data/counter/blank-top/print.tsv) | Byte copies of `print.tsv`, `routes-{lz,nz}.tsv`, `setup-{lz,nz}.tsv` and the four native receipts |
| [public/counter-blank-top.v1.json](../public/counter-blank-top.v1.json) | Runtime derived from the copies (print mapped onto the canonical source IDs, increment words, setups, switch) |
| [public/print/counter-blank-top/net.svg](../public/print/counter-blank-top/net.svg) | Sticker net derived from the runtime |

```sh
npm run verify:counter-blank-top                 # pins, runtime and net are current
node scripts/counter-blank-top.mjs --copy        # recopy from the pinned commit (fetch it first)
node scripts/counter-blank-top.mjs               # rederive the runtime and its pin
node scripts/export-counter-blank-top-net.mjs    # rederive the sticker net
```

`--check` always verifies each app copy against its pinned research hash and the
runtime against its derivation. When the research commit is present locally
(`git fetch origin research/counter-99-blank-top`), it also checks every pinned
research file, including the README, receipts and both checkers. CI's shallow
clone usually lacks that commit, so only the copies are checked there. The
derivation checks that each decrement column is the literal inverse word, that
each HTM claim equals its word length, the row order and labels, 4 blanks and two
stickers per digit. Nothing under `research/` is changed, and no copy is edited
by hand.

At runtime the page fetches the runtime file, compares its SHA-256 with
`runtimeSHA256` from the pin, and then
[validates](../src/apps/counter/blank-top.ts) it: every sticker keeps the
canonical sticker ID, cubie, position and normal; then setups and all 100 edges
per mode are replayed with the shared mechanics (display, exact inverse, cycle
closure, totals 278/270, max 4, and the switch word).

## Artwork

The blank-top print uses the same licensed vector digit images as the titled
print (see [counter artwork](COUNTER_ARTWORK.md)) and the existing blank image;
it loads no title document or font. Blank stickers match a target in any quarter
turn; digits must be upright. The [sticker net](../public/print/counter-blank-top/net.svg)
shows each face from outside in the printed state (Up above Front), with each
glyph rotated by its print-up vector. It is an assembly reference only: no bleed,
kiss-cut channel, sheet layout or physical scale. Production sheets like the
calendar and HSM presets ([print stickers](PRINT_STICKERS.md)) are not generated
for this print.

## Tests (app regressions, not proofs)

- [tests/counter-blank-top.test.mjs](../tests/counter-blank-top.test.mjs): replays
  every LZ and NZ research edge in `@cubistry/cube-mechanics`, applying the
  research decrement words literally; checks every display, wraparound and cycle
  closure, HTM per edge (max 4), histograms, totals 278 and 270, the switch word,
  the 31–99 shared states, per-print/per-mode eligibility and ingress negative
  controls; drives the real controller through full laps up and down, mode
  switches and solver jumps.
- [tests/counter-print-options.test.mjs](../tests/counter-print-options.test.mjs):
  per-print Wrap default, explicit-choice precedence and checkbox labels.
- [tests/counter-blank-top-source.test.mjs](../tests/counter-blank-top-source.test.mjs):
  pins, runtime freshness, canonical identities, derivation negative controls, net.
- [tests/browser/counter-blank-top.spec.mjs](../tests/browser/counter-blank-top.spec.mjs):
  selects the variant, counts full LZ and NZ laps through the wrap edge in the
  real page against the research words with the default Wrap, checks rendered
  top blanks and upright digits, the per-print Wrap default and label, switches
  modes (6 setup moves outside the session count, zero-move
  switch at 45), reloads, returns to the titled print and jumps.

## Limitations

- Max 3 HTM is UNKNOWN; global optimality of the print, the routes and the
  6-HTM switch word is UNKNOWN.
- The 278/270 totals apply only to the stored adjacent routes, not to solver
  jumps, which have no stated bound.
- No physical build, print scaling, cutting or human timing has been checked.
- Production print sheets are not generated; the net is a reference.
- The application runtime and its tests are software-tested, not proven.
