# Cubistry unified view: interactive mock

One self-contained HTML file (`cubistry-mock.html`). Cubes are CSS 3D stand-ins with real quarter turns; no solver, no persistence. The dark bar at the top is mock-only: frame (Fit, 1440×900, 1024×768, phone 390×844, phone landscape 844×390), theme, reduced motion, 3D not available, and links to the states gallery and these notes.

## Structure

1. **Home** (`#home`): the live H-M-S clock turns at the top. Below it the section Apps (Stopwatch, Calendar, Playground) and a tile for the Cube collection. Thumbnails are rendered once and frozen; only the clock moves.
2. **Cubes** (`#cubes`, old `#more` redirects): the Cube collection, a flat gallery of the nine other cubes, all equal.
3. **App view** (`#app-<id>`): one layout for all 13 apps. The 3×3 Super Picture Cube is a cube choice inside the Playground. Switching swaps stage content, dock slots and readouts without a reload.

## Region names

Every region has a `data-region` attribute: `header`, `app-switcher`, `stage`, `reference-view`, `hints`, `dock`, `status-zone`, `primary-action`, `readout`, `presentation`, `nerd-drawer`, `view-controls`, `present-action`. Dock slots carry `data-slot="1…5"`.

## Slot map

| App | 1 Action | 2 Value | 3 Mode | 4 Motion | 5 Print & appearance |
|---|---|---|---|---|---|
| Live H-M-S Clock | Pause / Resume | Time zone (read-only) | 12 / 24-hour | Move time, per cube | Label style |
| H-M Wall Clock | Pause / Resume | Time zone | 12 / 24-hour | Move time, per cube | Label style |
| M/S Timer & Stopwatch | Start / Pause / Resume | Duration MM:SS.d, Set, Reset | Countdown / Stopwatch | Move time | Leading zero |
| 60-Minute Workshop Timer | Start / Pause | Minutes, Set, Reset | Countdown / Stopwatch | Move time | Leading zero |
| 5-Second Precision Timer | Start / Pause | Seconds, Set, Reset | Countdown / Stopwatch | Move time | — |
| Counter 0-99 | Run / Stop | Value, Set | Stop after, Wrap | Move time | Leading zero |
| 1/10-Second Counter | Run / Stop | Value, Set | Stop after, Wrap | Move time | — |
| H/M/S, M/S, H/M Counters | Run / Stop | Value, Set | Unit, Stop after, Wrap | Move time | Leading zero |
| Calendar | Today | Show date | Sticker language DE / EN | Move time | Display font |
| Picture Cube (2×2 to 7×7) | Scramble / Solve | 18 turn buttons | Cube size 2-7, Undo, Redo | Move time | Design, Your pictures |
| CI Quality Cube | Refresh status | Workflow list | — | — | — |

## Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f5f3eb | #14181f | Canvas |
| `--surface` | #fffdf6 | #1d2330 (needs border) | Panels, dock |
| `--ink` | #153b61 (10.3:1) | #eceae2 (14.8:1) | Text, lines |
| `--ink-2` | #51647a | #a9b1be | Secondary text |
| `--accent` | #9e0b5c (7.1:1) | #e0569d (5.1:1) | Primary action only |
| `--focus` | #c8257e | #ff7ab8 | Focus ring |
| `--s-ready` / `--s-moving` / `--s-sync` | #4f6176 / #245e9e / #0b6e68 | #a3afbd / #86b5ee / #5ccdc2 | Status chip |
| `--s-paused` / `--s-done` | #7d5900 / #2b6d36 | #e3b65c / #7ccf8a | Status chip |
| `--s-warn` / `--s-error` | #984a00 / #b0261d | #f2a65a / #ff8d84 | Warning and error rows |

Type: IBM Plex Sans 400/500/600 for the interface, IBM Plex Mono with tabular digits for readouts (proposal). Sticker print keeps Noto Sans.
Scale: 11, 13, 15, 20, 28, 40 px. Spacing: 4, 8, 12, 16, 24, 32 px. Radius: 6, 10, 16 px and pill.
Motion: chrome 150 ms, view return 260 ms. Cube turn time and easing are inputs from the app.

## Brand (decided 2026-11-06)

- **Brand color: berry #9e0b5c** (dark theme #e0569d). In the interface it marks only the primary action and the logo, always through the `--accent` token. Cube plastics and stickers keep their own colors.
- **Logo: direction A, the quarter-turn mark**: a 2×2 cube whose top layer is mid-turn, berry over ink navy and sticker white. Files in `brand/`: `cubistry-mark.svg`, `cubistry-mark-dark.svg`, PNGs at 512 px.
- **Favicon: direction B, the sticker grid**, because A turns into a smudge below 24 px. Files: `favicon.svg`, `favicon-16/32/48.png`, `apple-touch-icon.png` (A on canvas).
- Clear space: one sticker width on every side. Minimum size: A 24 px, B 16 px. No shading, gradients or 3D render on the mark.

## Deviations that need an owner decision

1. New Home page with two categories: **Apps** (Live Clock, Stopwatch, Calendar, Playground) and **Cubes** (everything else). New cubes go to Cubes by default; moving one to Apps is an owner decision. Today the Studio opens straight into an app.
2. The header sits above the stage, not over a full-window canvas. Matches the current e2e specs, reverses the 2026-11-02 floating HUD.
3. Controls are always visible; today the panels appear only on mouse hover.
4. Switcher: 13 entries in two sections, Apps and Cubes, with groups under Cubes with search, instead of 23 select entries with duplicates.
5. Calendar, Playground and CI Cube run inside the shared view. The 3×3 Super Picture Cube is no longer its own app; the Playground offers it as a cube choice (`#app-picture3` still opens it).
6. One Present button instead of Present and Presentation.
7. Readout under each cube; the committed-moves table moves into the hidden Nerd drawer.
8. The clock gets a primary action (Pause / Resume).
9. Label style options renamed to say what differs (title case or lower case).
10. Deep links: the mock uses `#app-clock`; production keeps `?application=` plus kiosk and autostart flags.

## Assumptions beyond the handover

- Late: last turn ended after the deadline beyond the 20 ms tolerance. Missed: a step deadline passed before its moves were committed. Infeasible: the planned moves cannot fit the step at the effective move time.
- The 215 ms software WebGL floor is shown as an example; the docs do not confirm it.
- On phones the stage shrinks as the sheet rises, so readout and controls never overlap. In peek the stage takes about 70 % of the height.
- The phone switcher takes the dock's place at 58 % height, so cubes and readouts stay visible.
- View controls: header View menu on desktop, end of the sheet on phones.
- Net view is a view control: it unfolds each cube under its readout (U above F, then L F R B, D below F) and shows the last committed state, so it never runs ahead of a turn.
- Cube stand-ins stage the next front state on the top layer and turn the changed columns. The real app walks solver moves.
- Status colors and the type pairing are proposals.
