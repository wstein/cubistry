# Applications and demos

Preview status, the Status Cube, acceptance examples, sticker sheets and the playground. Back to the [README](../README.md).

## Application overview

The application chooser in the page header lists the first eight applications
below. The remaining pages are opened directly or by link. Entry points are
relative to the site root, for example `http://localhost:5173/` locally.

| Application | What it shows | Entry point | Documentation |
| --- | --- | --- | --- |
| Live H-M-S Clock | Current local time on three 2x2 cubes (hours, minutes, seconds) | `clock.html` | [Live clock](LIVE_CLOCK.md) |
| Counter 0-99 | A fixed-print 2x2 counter, 00 to 99 | `index.html` (default) | [Counter usage](COUNTER_USAGE.md), [cube-first controls](CUBE_FIRST_UI.md) |
| H/M/S Counter 00-59 | One cube counting seconds, minutes or hours | `index.html`, chooser | [H/M/S counter](HSM_COUNTER.md) |
| 60-Minute Timer | Countdown or stopwatch, 00:00-59:50 | `index.html`, chooser | [Workshop timer](WORKSHOP_TIMER.md) |
| 5-Second Timer | Countdown or stopwatch, 00:00-39:55 | `index.html`, chooser | [Five-second timer](FIVE_SECOND_TIMER.md) |
| Calendar | German and English calendar cubes (3x3) | `calendar.html` | [Calendar cubes](CALENDAR_CUBES.md) |
| CI Quality Cube | Six-face workflow status prototype | `status.html` | [Status Cube](STATUS_CUBE.md) |
| Picture Puzzle Playground | Free-play 2x2 with picture stickers | `playground.html` | [Playground](PICTURE_PLAYGROUND.md) |
| 3x3 Super Picture Cube | Picture cube on a 3x3 | `picture3.html` | [Super Picture Cube](SUPER_PICTURE_CUBE.md) |
| Print stickers | Vector print/cut sheets | `print.html` | [Print stickers](PRINT_STICKERS.md) |
| Library example, solver acceptance | Development-only M1 demos | `library-example.html`, `solver-acceptance.html` | [M1 acceptance](M1_ACCEPTANCE.md) |

## Development preview

The [Status Cube reference](STATUS_CUBE.md) is a small declarative workflow
prototype with six fixed physical faces and local simulated events. Open
`status.html` directly or select it from the counter's application chooser.

Pages URL: https://wstein.github.io/cubistry/. As of 2026-11-01 the site
answers with HTTP 200 and serves the counter (`index.html`) and the live clock
(`clock.html`), published by the main-only Pages workflow. (Earlier revisions of
this text said publication still awaited the first human-approved merge and
the first successful run; that is no longer accurate.) The static counter needs no
dev server. The existing solver acceptance page remains development-only.

This MVP preview is separate from the selective Hugo/documentation roadmap in
[issue #10](https://github.com/wstein/cubistry/issues/10); it does not publish the
knowledge tree. Reproduce the project-path build with
`VITE_BASE_PATH=/cubistry/ npm run build` and `npm run test:pages`.

## Preview

![Counter with a physical two-sticker title and two digits](assets/counter-desktop.png)

[Mobile preview](assets/counter-mobile.png). These are browser screenshots,
not print exports; their pixel dimensions and hashes are
[recorded separately](assets/counter-previews.json).

## Focused M1 acceptance examples

[Live existing-solver acceptance and independent library use](M1_ACCEPTANCE.md)
cover issue #21's five-point DoD. With `npm run dev`, open
`/solver-acceptance.html` to compute fresh paths for fixed representative goals,
or `/library-example.html` for a standalone consumer with its own image/text
print and no counter modules. The live solver harness is development-only;
the regular counter uses the shared direct solver. The witness catalog still
defines complete targets and initial states, not transition detours.

The counter reports committed / planned HTM moves during playback.
[Move progress and Stop after this value](COUNTER_MOVE_PROGRESS.md) document
queue/reset behavior and the existing non-optimal reference-state route.

## Physical sticker sheets

The separate Print stickers page provides compact vector print/cut PDFs for the
selected calendars and HSM lettering variants. Example dimensions must be
checked on the actual cube before ordering. See the
[print/export contract](PRINT_STICKERS.md) for source-face assembly maps,
cut contours, licenses and reproducible custom-size exports.

## Picture Puzzle Playground

Open `playground.html` or choose Picture Puzzle Playground in the application
chooser. Explore a physical 2×2 with original landscape stickers or classic
colors, legal face turns, seeded scrambles, undo/redo and verified exact Solve.
See [behavior, supported capabilities and architecture lessons](PICTURE_PLAYGROUND.md).
