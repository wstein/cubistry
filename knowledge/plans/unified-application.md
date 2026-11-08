---
id: PLAN-UNIFIED-APPLICATION
title: One application instead of single-page entry points
type: plan
status: draft
created: 2026-11-07
---
# One application instead of single-page entry points

## Purpose
Replace the single-page entry points (`clock.html`, `counter.html`, `timer.html`, ...) by ONE application with a landing page, a Cubes section (the proposal's second page, decision 17) and one mode per application. This plan records the owner decisions of 2026-11-07, the verified current state, a staged plan with a safety gate per stage, the risks and the decisions that are still open. The front matter status stays `draft`: [CONVENTIONS](../CONVENTIONS.md) defines no status for owner-approved plans. Plans do not confer approval beyond the decisions recorded here.

Evidence level: the current-state facts below were re-read on `origin/main` at `7dae282` (code, workflow files, PR and issue texts); the studio facts and the print page facts were re-read at `eb1dcce3` (after PRs #262 and #266). Nothing was run in a browser; every statement about how a mode behaves at runtime is `UNKNOWN` unless a test is cited. PR counts are estimates, not measurements.

## Decisions (owner, 2026-11-07)
1. **Approach A, "contract first, thin".** Define a mode contract, build the landing page with its Cubes section, port each application from its legacy page into a mode, switch specs and links, then delete the legacy pages (the order per application is set by decision 8).
2. **The old pages go completely, without crutches.** No redirect shims, no compatibility pages, no half-maintained doubles. At no step may an application or a cube become unusable. *(Confirmed by the owner on 2026-11-07 for the old single-page URLs: "Komplett weg, keine Weiterleitung", the old pages are deleted and return 404. README:8 (the mock's old `#more` redirect) and the implementing brief's line 39 (redirect old per-app URLs) do not apply.)*
3. **Landing page.** The Live Clock is on top. Below it are the main applications: Clock, M/S Timer, Calendar, Playground, Counter. A second page "Others" holds everything else. *(Superseded by: proposal is master. Four apps, second page "Cubes"; see the section "Design proposal is master".)*
4. **Studio page.** The rename to "Chronocube 2×2 Studio" was rejected. The current studio page is unacceptable because of its name and its error state.

5. **Name.** The application name stays "Cubistry". The rename was rejected before and is now final.
6. **`hm-clock`.** It stays and must exist as a mode in the new structure.
7. **URL scheme.** `index.html?app=<id>`. The landing page is `index.html` without a parameter. *(Confirmed by the owner on 2026-11-07: `index.html?app=<id>`. The mock's hash routing (`#home`, `#cubes`, `#app-<id>`) is not adopted; kiosk and autostart parameters stay query parameters, see the appendix.)*
8. **No transitional links.** The landing page never links to the old pages. Applications are shown only in the unified view and are migrated quickly instead.
9. **Tool pages.** `licenses.html` stays. The fate of `solver-acceptance.html` and `library-example.html` is still open (`print.html`: decision 10).
10. **`print.html` (owner, 2026-11-07: "Ja, bitte so in den Plan übernehmen"; place, design source and set of applications chosen by the owner the same day: "Slot 5, Design der laufenden App").** `print.html` stays a separate page. It has no entry in the catalog of the landing page or of the Cubes page. It is called from the slot "Print & appearance" (slot 5) of every application that has a print design: a button "Print stickers for this app" opens `print.html?design=<design of the running application>` in a new tab. This deviates from the mock, which puts the button in the View menu (`viewControls()`, `docs/design/cubistry-mock.html:941-954`, section "Tools", lines 951-953; README:75) with a fixed `design=words-pascal`; the deviation is an owner decision. The slot-5 placement in the earlier proposal to the owner was not backed by the design proposal (the README slot map, `docs/design/README.md:17-28`, has no print button); the owner has now chosen it explicitly.

11. **Unified mode ids (owner, 2026-11-07, "So bestätigen").** One list with one key, `app`: `clock`, `ms-timer`, `hm-clock`, `counter`, `tenth`, `timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube` (the ids of the mock); later `calendar`, `playground`, `ci`. The legacy application key `certified` becomes `counter` and `tenth-counter` becomes `tenth`. The specs that use `application=` (hsm-lettering, print-sheets, target-interruption, ms-counter, ms-timer) change with the port of their application.
12. **Host in stage 2 (owner, 2026-11-07, "chronocube.html bis Stufe 3").** Until stage 3 the modes are hosted by `chronocube.html?app=<id>`; `index.html` stays the redirect. Stage 3 makes `index.html` the landing page and the host, and deletes `chronocube.html` (this moves the deletion from stage 5 to stage 3). To keep decisions 2 and 6, stage 3 must let `index.html?app=<id>` host all ten registered studio modes first; see the open decision "All ten modes through `index.html` in stage 3".
13. **Last mode (owner, 2026-11-07, "Nicht merken").** No auto-redirect to the last used mode: the keys `cubistry_chronocube_mode` and `cubistry_app` stop driving the host and the landing page. Returning users do not resume automatically.
14. **Hero (owner, 2026-11-07).** The hero of the landing page shows no time text: only the name, one sentence and the button "Open Live Clock" (`index.html?app=clock`). No H/M/S readout, and the studio bundle is not loaded on the landing page. This deviates from the mock, whose hero has a readout under each cube.
15. **Clock port (owner, 2026-11-07).** The port of `src/clock.mjs` with all its parameters is its own stage 3 PR after the stack of the host, the landing page and the deletion of `chronocube.html` (PRs #301 to #303) is reviewed and merged. `clock.html` stays until then. The port is not started earlier.
16. **Intermediate state (owner, 2026-11-07).** Until stage 4 the legacy pages have no link to the unified view (their "Integrated Studio" chooser entry is removed with `chronocube.html`).
17. **Cubes (owner, 2026-11-07).** The Cubes catalog is a section of the landing page. There is no second page and no `?page=cubes`. This deviates from the mock (`#cubes`).
18. **Slot API first (owner, 2026-11-07, "Erst Slot-API bauen").** Before the Clock port, the shell gets the typed API through which a mode fills the dock slots, the status chip, the primary action, the readout and the Nerd drawer (section "Dock slot API"). The Clock port (decision 15) is rebuilt on it afterwards. A small mode migrates first as the reference user (the 1/10-Second Counter).

Recommendations in this plan that go beyond these statements (mounting existing engines instead of rewriting them) are recommendations, not decisions; see "Open decisions".

## Current state (verified on `origin/main` at `7dae282`)
- `index.html` redirects to `clock.html` (meta refresh and `location.replace`; `?application=<id>` is mapped to `<id>.html`). `tests/mpa-routing.test.mjs:57` ("root index.html redirects to clock.html") enforces it. There is no landing page and no Others page.
- `chronocube.html` is the studio shell (PR #241, step a of the unified view rework: tokens and layout, [ADR-0001](../adr/ADR-0001-shell-tokens.md)). It is not linked from `index.html`; the legacy pages reach it through a chooser option. Its mode switcher reads `?mode=<id>`; the legacy single-cube pages use `?application=<id>` or the file name. Two parameter schemes exist.
- The studio has 10 modes. PR #262 (merged) constructs the controllers of 8 of them (`clock`, `hm-clock`, `counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`, `timer`, `five-second-timer`) with their real arguments through factories under `src/apps/chronocube/`; before, `src/chronocube.mjs` passed an options object. `ms-timer` and `tenth` call the constructors positionally. PR #266 (merged) adds `tests/browser/studio-modes-smoke.spec.mjs` over all ten modes. The `tenth` mode still throws on load on `origin/main`: `initTenthMode` uses `controlsContainer`, which is declared nowhere (`src/chronocube.mjs:855`); PR #269 (open, draft) fixes it. The smoke spec lists one known console error: `hm-clock` logs "Invalid live clock snapshot" (`KNOWN_ERRORS`, issue #265). The result of the smoke spec in CI is `UNKNOWN` (not run for this plan). Issue #267 (open): `switchMode` has no generation guard.
- The studio modes are separate, smaller implementations (readouts and +1/-1/+10/-10/Reset buttons), not equivalents of the legacy pages. They read only `mode`, `presentation` and `kiosk`; parameters such as `val`, `unit`, `duration`, `lettering` are read only by `src/main.mjs` and the per-page scripts. Issue #263: in the studio timer modes the cube does not follow the countdown.
- `vite.config.mjs` builds 19 HTML inputs: chronocube, picture3, playground, status, print, calendar, clock, ms-timer, index, counter, timer, five-second-timer, tenth-counter, hsm-counter, ms-counter, hm-one-cube, solver-acceptance, library-example, licenses.
- Seven pages (`counter`, `timer`, `five-second-timer`, `tenth-counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`) are near-identical HTML files that load `src/main.mjs` and differ by `data-default-application`. `clock`, `ms-timer`, `calendar`, `playground`, `picture3`, `status`, `print` have their own scripts.
- The studio switcher lists 23 options (from a code reading, not a browser run): the 10 modes `clock`, `ms-timer`, `hm-clock`, `tenth`, `counter`, `timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube`, and 13 links to legacy pages. `hm-clock` exists only in the studio (owner decision 6: it becomes a mode in the new structure). `calendar`, `playground`, `picture3` and `status` have no mode and are reached only as links. `print.html` is linked from the studio header; `licenses.html` from every footer. See "What `print.html` is" below.
- Test coverage gaps. The single-cube pages are covered by E2E almost only through `/counter.html` plus the `?application=` selector (`workshop-timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube` specs). `five-second-timer.html`, `tenth-counter.html`, `hsm-counter.html`, `ms-counter.html` and `hm-one-cube.html` have no direct E2E, only the markup test in `tests/mpa-routing.test.mjs`; `timer.html` is reached only through the chooser of `counter.html` (`tests/pages/production.spec.mjs:208`). The live-clock spec `tests/browser/live-clock.spec.mjs:223-230` switches to `index.html?application=hsm-counter` through a hidden option (`clock.html:38`). `tenth-counter` has a unit test and no E2E. The studio modes have the load smoke spec of PR #266 and no functional test beyond it (readouts and buttons are not checked); `tests/browser/shell-layout.spec.mjs` checks layout only. Pages specs `tests/pages/production.spec.mjs` use `counter.html`, `timer.html` and `./`.
- Not specified anywhere in the repository: landing layout, Live Clock as flagship, the main/others split (before this plan), and steps b to g of the unified view. The owner-approved design proposal is [docs/design/README.md](../../docs/design/README.md); see "Design proposal is master: where the plan must follow it". No issue or PR exists for the landing page. PR #262 refers to the landing page work ("handled by the landing page work"); issue #219 says to answer its questions "before step b of the unified view".

## Stages
Stage 2 is merged (PRs #285 to #287). The estimates of stages 3 to 5 predate the owner statement that the design proposal is master and are not recomputed; where the rows use "Others" or the main/others split they follow the owner answers of 2026-11-07 recorded in the section "Design proposal is master: where the plan must follow it" (rows a to c) and decisions 2, 7, 10 and 14 to 17.

PR counts are estimates (total about 16 to 22 with `print` as a mode, 15 to 21 without it; decision 10 keeps `print.html` a page, so the lower figure applies, the figures are not recomputed here; one more with PR #269). Limits: issue #198 records an owner decision of 2026-11-06 that raises the limits for the unified view work until it is complete, to 8 open units and 12 open ledger nits (afterwards 3 and 6); `e2e` label on the stack top only, drafts start with a named blocker. Every stage is a stack of small PRs that each keep `main` releasable.

Owner decision 8 (not contradicted by the proposal) says only this: the landing page never links to the old pages, applications are shown only in the unified view, and they are migrated quickly instead. The following order is a recommendation derived from it, not a statement of the owner: the landing page lists an application when its mode exists; each application is migrated in one step (its mode, its landing page entry, its specs switched to `index.html?app=<id>`, and the removal of its legacy page, vite input and links to it), in the same PR or an immediately following PR; The Clock port goes first (decision 15) and `counter.html` goes last of the family. No shims, redirects or compatibility pages are added (decision 2). A legacy page that is not yet migrated stays reachable by its own URL only.

| Stage | Content | PRs (est.) | Safety gate (nothing becomes unusable) | Deleted |
|---|---|---|---|---|
| 0 | Owner decisions of the section "Open decisions". | 0 | Decisions recorded in this plan. | nothing |
| 1 | Studio smoke gate: PRs #262 and #266 are merged; remaining is PR #269 (`tenth`). The smoke spec covers all 10 studio modes (no `#studio-error`, canvas rendered, no console error), split for the time budget. | 0 beyond #269 | The smoke spec is green on all 10 modes (`UNKNOWN` until CI shows it). No new check is added in this stage; the smoke spec (one file, one test per mode plus a switch test) already exists, so no mutation is required here. | nothing |
| 2 | Mode contract and routing: `{ id, title, group (main or others; proposal: apps or cubes), mount(root, params), dispose() }`, a registry, the URL scheme `index.html?app=<id>` with app parameters, parameter hand-over through `src/app-switch-url.mjs`; `index.html` is the host document of the landing page and of the modes from stage 3 on; in stage 2 the host is `chronocube.html?app=<id>` and `index.html` stays the redirect (decision 12). The studio switcher reads the registry through the router (`src/apps/router.ts`), which reads the key `app` and no longer the key `mode` or the remembered last mode (decision 13). | 3 | Unit test: every registry id has mount, title, group and a help or spec link. Tests: an app parameter such as `?val=45` survives reload and is dropped on an app switch. | nothing |
| 3 | Landing, host and Clock port, in three steps (decisions 14 to 17). (a) The real `index.html` without a parameter: hero (name, one sentence, button "Open Live Clock"), section Apps, section Cubes (a section of the landing page, no second page), shared header and footer on `src/shell/shell.css` and `tokens.css`, dark theme; `index.html` hosts the app view (the router of stage 2) for all ten registered studio modes through `?app=<id>`, so `chronocube.html` can go without making a mode, `hm-clock` included, unreachable; the thin studio modes stay until their port in stage 4 (decision 12). The redirect goes away in this step. (b) Delete `chronocube.html`. (c) The Clock port (`src/clock.mjs` with all its parameters) is its own PR after (a) and (b) are merged (decision 15) and deletes `clock.html`; `clock.html` stays until then. | 3 | E2E: `/` shows the landing page without redirect; each of the ten registered ids loads through `index.html?app=<id>`; every shown entry reaches a loading target; the landing page contains no link to a `*.html` application page. After (c): the Clock mode passes the ported clock spec. | (a) the redirect in `index.html` with its `?application=` switch; replaced or removed with it: `mpa-routing.test.mjs:57`, the root checks (`./`) in `production.spec.mjs`, `framework.spec.mjs` and `preview.spec.mjs`. The hidden option in `clock.html:38` now points to `index.html?app=hsm-counter` and stays, with its test (`live-clock.spec.mjs:223-230`), until the Clock port. (b) `chronocube.html` with its vite input and its `tests/chronocube-studio.test.mjs` markup checks. (c) `clock.html` with its vite input (17 files contain the string `clock.html`, `grep -l "clock.html" *.html`: the page itself, the `index.html` redirect, and 15 others, among them `licenses.html:26` and `print.html:20`, which stay; every such reference is edited in that PR) and the hidden option with its test (moved to the PR that ports `hsm-counter`, or retargeted to a mode that exists then). `git grep -l chronocube.html` finds 25 files: `chronocube.html` itself, this plan, and 23 others that are edited in the same stage: the 13 legacy pages (`calendar`, `clock`, `counter`, `five-second-timer`, `hm-one-cube`, `hsm-counter`, `ms-counter`, `ms-timer`, `picture3`, `playground`, `status`, `tenth-counter`, `timer`; `clock.html` is deleted instead), `licenses.html`, `src/main.mjs`, `src/shell/shell.css`, `vite.config.mjs` and six tests (`tests/app-registry.test.mjs`, `tests/chronocube-studio.test.mjs`, `tests/mpa-routing.test.mjs`, `tests/shell-markup.test.mjs`, `tests/browser/shell-layout.spec.mjs`, `tests/browser/studio-modes-smoke.spec.mjs`). |
| 4 | Migrate the remaining applications, one PR per application (the print call of decision 10 is part of the port of each application that gets it, not its own PR; the `print` wording and counts in this row and above predate decision 10, where `print.html` stays a page and is not a mode, and are not changed here), each with its legacy page removal: `hm-clock` (a mode without a legacy page; decision 6), M/S Timer, Calendar, Playground, picture3, status, print only if it were a mode (decision 10: it stays a page, so no port PR), and the single-cube family over `src/main.mjs` (one engine-mount PR and up to six thin PRs; `counter.html` goes last of the family because the family specs reach the other pages through its `?application=` selector). Entries appear on the landing page (Apps or Cubes) with the PR that ports the mode. Mounts load lazily by dynamic import. Sum 8 to 14 with `print` counted as a mode, 7 to 13 without it (decision 10: without). | 8 to 14 (7 to 13 without `print`) | Per application: the existing spec is switched to the new URL and passes unchanged (not copied, not weakened); all parameters of the appendix keep working: the full parameter list is in the appendix, and an inventory test (every appendix parameter is read by the mode that read it before, checked against the code) is a gate of this stage. A legacy page is deleted only when its mode is reachable, its ported spec is green and no remaining page, README, doc or test references it (the remaining legacy pages that linked to it, for example through the chooser, are edited in the same PR). | per application: its legacy page, vite input, chooser option and `externalMap` entry; the thin studio mode in `src/chronocube.mjs` once a mode replaces it |
| 5 | Sweep: remove what is left of the old studio entry (`chronocube.html` is gone since stage 3; `hm-clock` has been a mode since stage 2, owner decision 6); remove the chooser `<select>` and `externalMap` in `src/main.mjs` if still present; update README, `docs/APPLICATIONS.md`, `scripts/readme-screenshot.mjs`. | 2 | A search for legacy page names finds none except `licenses.html` and the tool pages the owner keeps (open decision). | the chooser, remaining dead code; old URLs return 404 (owner: no shims) |

Kept: new `index.html` (with the Cubes section), `licenses.html`, all `public/*.json` and `*-source.json`. `print.html` stays as its own page (decision 10); `solver-acceptance.html` and `library-example.html` depend on the open decision below.

### Stage 3 steps
Link scheme: `index.html` without a parameter is the landing page; `index.html?app=<id>` hosts one registered mode; kiosk and autostart stay query parameters. The landing page follows the landing page of `docs/design/cubistry-mock.html` (`renderHome`, lines 1008-1036), with `?app=<id>` links instead of `#app-<id>`:
1. Hero: the name, one sentence and a button "Open Live Clock" (`index.html?app=clock`); no time text (decision 14).
2. Section "Apps": one tile per registered mode of the group `apps`; a mode joins when it exists (decision 8). Section "Cubes": the catalog of the group `cubes` from `src/apps/mode-catalog.ts`. Every tile is `index.html?app=<id>`; no tile links to a `*.html` application page.
3. Shared header, footer (with `licenses.html`), tokens and dark theme from `src/shell/shell.css` and `tokens.css`.
4. Steps: (a) `index.html` becomes the landing page and the host: no `app` parameter shows the landing page, a registered id mounts through the router, an unknown id shows the landing page; the switcher lists the ten registered modes only; the browser specs move from `chronocube.html?app=<id>` to `index.html?app=<id>`; the node tests of the host and the catalog come first. (b) Delete `chronocube.html`, its vite input and its markup checks, and edit every file of the list above; the page checks (`tests/mpa-routing.test.mjs`, `tests/shell-markup.test.mjs`) stay green. (c) The Clock port and the deletion of `clock.html`, as the row above lists them: its own PR after (a) and (b) are merged (decision 15).

## Dock slot API
Status: built in the stack #324 (API, markup, styles, tests) and #325 (reference mode); `UNKNOWN` in a browser until the Playwright lane has run on them. Source: `src/apps/shell/slot-api.ts`; the region names and the slot map are those of the [design proposal](../../docs/design/README.md).

A mode receives a `ModeShell` in its mount context (`MountContext.shell`) and uses it instead of touching the regions of `index.html`:
- `setSlot(n, { label, element | render })`, `clearSlot(n)`, `clearSlots()`: slots 1 Action, 2 Value, 3 Mode, 4 Motion, 5 Print & appearance. A filled slot is a `role="group"` labeled by an `h2`; an empty slot keeps `hidden`. DOM order is tab order.
- `setPrimaryAction({ label, onClick, disabled? })`: the one berry button.
- `setStatus(state, text?)`: one chip in the existing `role="status"` zone, states `ready, moving, sync, paused, done, warn, error` (tokens `--s-*`). The same state and text writes nothing; callers set it on state transitions, never per frame. The readout (`setReadout`, `updateReadout`) is plain text without a live region.
- `setWarning({ title, text, onDismiss? })`, `setError({ text, onDismiss? })` (`null` clears): one dismissible `role="alert"` row per kind in the status zone beside the chip; no live region of their own.
- `setNerd({ title, render })`, `refreshNerd()`: the drawer is hidden until the Nerd button (`#nerd-toggle`, in the header between Appearance and Presentation) is pressed or the URL has `nerd=1`; `render` runs only while it is open, and a refresh keeps the focused control and the scroll position. `nerdTable` and `nerdFacts` build the content.
- `setHint(text | null)`, `setReferenceView(handler | null)`, `listen(...)`, `onDispose(fn)`.

Cleanup: the router creates the shell per mount and disposes it with the mode. Every write checks `isCurrent()`, so a mode that is superseded during an async init cannot put content into the next mode.

### Slot inventory
Slots the design fills per registered mode (`src/apps/shell/slot-map.ts`, compared with the design's slot map by `tests/shell-slot-map.test.mjs`) and whether the mode fills them through `ModeShell` (`migrated`) or still renders its HUD controls (`pending`). `calendar7` is not in the design's slot map.

| Mode | Slots | Status |
|---|---|---|
| `clock` | 1, 2, 3, 4, 5 | pending |
| `ms-timer` | 1, 2, 3, 4, 5 | pending |
| `hm-clock` | 1, 2, 3, 4, 5 | pending |
| `tenth` | 1, 2, 3, 4 | migrated |
| `counter` | 1, 2, 3, 4, 5 | pending |
| `timer` | 1, 2, 3, 4, 5 | pending |
| `five-second-timer` | 1, 2, 3, 4 | pending |
| `hsm-counter` | 1, 2, 3, 4, 5 | pending |
| `ms-counter` | 1, 2, 3, 4, 5 | pending |
| `hm-one-cube` | 1, 2, 3, 4, 5 | pending |
| `calendar7` | none | pending |

`tenth` fills slots 1 to 4 with Step, Value, Direction and Step speed; the design row lists Run / Stop, Stop after and Wrap, which this mode does not have. This deviation is accepted (owner decision 5, 2026-11-08) and recorded as `ACCEPTED_DEVIATIONS` in `src/apps/shell/slot-map.ts`.

Owner decisions of 2026-11-08 on the Nerd drawer:
1. Nerd drawer versus the Clock page's Nerd panel: the per-cube speed selects go to slot 4; the drawer shows the effective values only; `nerd=1` opens the drawer. Built: `nerd=1` (`nerdOpenFromSearch`). Open: the speed selects and the drawer content belong to the Clock port (`clock.html` is still the page that has them).
2. Stats and session moves of the Live Clock move into the drawer with a "Reset session moves" button. Built: the drawer keeps focus and scroll position on refresh. Open: the move itself, with the Clock port.
3. The Nerd button sits in the header like in the mock. Built: between Appearance and Presentation, same button build, label kept on a phone.

Open questions for the owner:
1. Warning and error rows. DECIDED (owner, 2026-11-08): rows are `role="alert"` and dismissible. Built with the Clock port: `setWarning` and `setError`.
2. The phone sheet (grab handle, snap states) is not built; the dock stays the stacked area of the current layout.

## Risks
- Known red or flaky specs on `main` (owner list, not re-run for this plan): `ms-timer:33`, `presentation:38` (two), `smart-rotation:101`, intermittent `hsm-lettering:39` and `:113`, `presentation:160`. Layout specs stay red until the layout rework. The workflow "Counter checks" was reported failing on `7dae282` (fast groups 2 and 3, timing 1; issue #202 describes broad e2e failures, cause unknown). A port PR compares the red set before and after: the same set, no new entries, and no spec weakened "because of the move".
- Specs that load `/counter.html` (most family specs) are lost when the page is deleted; they are switched in the PR that deletes it, and `counter.html` is deleted last of the family.
- While the migration runs, the landing page shows only migrated applications; a not yet migrated application is reachable only by its own URL. This follows from owner decision 8; the mitigation is a fast migration, not a link.
- Two parameter schemes (`mode` and `application`, with `counter` vs `certified` and `tenth` vs `tenth-counter`) break deep links and the `urlAfterAppSwitch` tests unless unified in stage 2 on the key `app`.
- GitHub Pages and previews: `tests/pages/*.spec.mjs` run against the production build with base `/cubistry/`; previews use `/cubistry/pr-preview/pr-N/`. Value of `PAGES_PREVIEWS_ENABLED`: `UNKNOWN` (not readable).
- `licenses.html` and the footer must stay reachable from every view (runtime-notices test).
- Bundle size: one application bundles the calendar solver, the 3x3 picture solver and the counter solver. Lazy mounts are required, and the single host document `index.html` makes this more important; startup cost is not measured (`UNKNOWN`).
- Conflicts with the Cubacle WASM replacement (issue #190), which touches the calendar and picture adapters.
- Test limits: local test runs are capped at 5 minutes each; E2E uses software GL at 30 s per test, so the smoke spec is split.
- M/S Timer port: issues #219 (plan vs built app) and #218 (countdown shows 1 s more on the cubes) are open and touch the port PR.

## Design proposal is master: where the plan must follow it
Owner statement (2026-11-07, quoted from the coordinator's relay): the design proposal is well worked out and is master; the earlier decisions of the same day were cited from memory and were probably phrased misleadingly. Source: [docs/design/README.md](../../docs/design/README.md) and `docs/design/cubistry-mock.html` (added verbatim; cited by [ADR-0001](../adr/ADR-0001-shell-tokens.md)). The stages and estimates in this plan are not changed here; a later PR adjusts the wording of "Others" and the main/others split. Decision 3 above carries the note "superseded by: proposal is master" where it contradicts the proposal. The owner answers of 2026-11-07 on routing, redirects, print and the ten deviations are recorded in rows c and d and in decisions 2, 7 and 10.

| # | Topic | Earlier plan text | Design proposal (master) | Status |
|---|---|---|---|---|
| a | Apps on the landing page | Five: Clock, M/S Timer, Calendar, Playground, Counter (decision 3) | Four: Live Clock, Stopwatch (M/S Timer & Stopwatch), Calendar, Playground (README:7, :58; mock `featured:true` at lines 657, 686, 749, 789). The Counter belongs to Cubes (mock line 732, no `featured`). | Follow the proposal for the list of four apps (README:7, mock). README:58 is deviation 1 (DECIDED, as proposed): new Home page with two categories, new cubes go to Cubes by default; moving a cube to Apps stays an owner decision case by case. |
| b | Second page | "Others" (decision 3) | "Cubes": the Cube collection, a flat gallery of the nine other cubes (README:8; mock line 1041). | Follow the proposal for the name; the owner decided the form (decision 17): a section of the landing page, not a second page. Deviation 1 (README:58, DECIDED, as proposed): new cubes go to Cubes by default. |
| c | Routing | `index.html?app=<id>` (decision 7), no redirects or shims (decision 2), no transitional links (decision 8) | The mock uses `#home`, `#cubes` (old `#more` redirects) and `#app-<id>` (README:7-9). README:67 says production keeps `?application=` plus kiosk and autostart flags. The implementing brief supplied with the proposal (not in the repository, line 39) says to redirect the existing per-app URLs into the unified view. | DECIDED (owner, 2026-11-07): `index.html?app=<id>`; old single-page URLs are gone without redirect ("Komplett weg, keine Weiterleitung"); hash routing and the brief's redirects are not adopted; kiosk and autostart stay query parameters. |
| e | Fonts | Self-hosted IBM Plex (ADR-0001 line 44, `src/shell/tokens.css`) | The mock loads IBM Plex and Noto Sans from `fonts.googleapis.com` (mock lines 8-10); README:45 and :78 call the type pairing a proposal. | Check item: the repository keeps self-hosting; the owner confirms |
| f | `hm-clock` | Stays and must exist as a mode (decision 6) | Listed as "H-M Wall Clock" (README:20; mock line 660, short name "Wall Clock"). | Follow the proposal (name); the mode requirement is unchanged |

Row d: the ten deviations that README:56-67 lists under "Deviations that need an owner decision" are DECIDED (owner, 2026-11-07, chosen option: all ten as proposed), except where the owner decided differently the same day: no redirects, URL `?app=<id>`, print in slot 5. The mock's 13-entry switcher (README:61) is part of item 4.

| No. | README line | Deviation | Status |
|---|---|---|---|
| 1 | 58 | New Home page with Apps and Cubes; new cubes go to Cubes by default | DECIDED, as proposed |
| 2 | 59 | Header above the stage instead of a floating HUD (reverses 2026-11-02) | DECIDED, as proposed |
| 3 | 60 | Controls always visible instead of on hover | DECIDED, as proposed |
| 4 | 61 | Switcher with 13 entries in two sections instead of 23 select entries | DECIDED, as proposed |
| 5 | 62 | Calendar, Playground and CI Cube run in the shared view; 3x3 Super Picture Cube becomes a Playground cube choice | DECIDED, as proposed |
| 6 | 63 | One Present button instead of Present and Presentation | DECIDED, as proposed |
| 7 | 64 | Readout under each cube; committed-moves table moves into the hidden Nerd drawer | DECIDED, as proposed |
| 8 | 65 | The clock gets a primary action (Pause / Resume) | DECIDED, as proposed |
| 9 | 66 | Label style options renamed (title case or lower case) | DECIDED, as proposed |
| 10 | 67 | Deep links: `#app-clock` in the mock; production keeps `?application=` | DECIDED, adjusted: `index.html?app=<id>`, no redirects (row c; decisions 2 and 7) |

## Open decisions
Not decided. Each recommendation comes from the code reading behind this plan; the price is what it costs. Decided items (name, `hm-clock`, `licenses.html`, `print.html`, transitional links, mode ids, host in stage 2, start behavior) are in the section "Decisions".

| Topic | Recommendation | Price |
|---|---|---|
| All ten modes through `index.html` in stage 3 | Derived from decision 12; confirmed by the owner on 2026-11-07 (see Price): stage 3 hosts the landing page and the app view of all ten registered studio modes in `index.html` through `?app=<id>`, so that `chronocube.html` can be deleted in stage 3 without making a mode unreachable (decisions 2 and 6). | DECIDED (owner, 2026-11-07, "Ja, Stufe 3 passt."): stage 3 hosts all ten registered modes through `index.html?app=<id>` and deletes `chronocube.html` with its vite input and its markup checks. The host work (mounting the ten thin modes into `index.html`) joins stage 3; the estimate of 3 PRs is not changed. |
| Dev pages `solver-acceptance.html`, `library-example.html` | Open. Options: keep as dev pages, or drop from the Pages build. (`print.html` is decided, decision 10; facts: "What `print.html` is" below.) | Both dev pages have E2E (`acceptance.spec`, `production.spec`); dropping them removes that coverage or moves it. |

### What `print.html` is
Facts read from the repository at `eb1dcce3`; the run-time behavior is `UNKNOWN` here.
- Title "Cubistry · Print stickers" (`print.html:11`); script `src/print.mjs` (94 lines).
- It generates vector print and cut sheets with rounded sticker cuts and an assembly guide (`docs/PRINT_STICKERS.md`: `print.pdf`, `artwork-N.svg`, `cuts-N.svg`, `assembly.pdf`, `manifest.json`).
- The query parameter `design` preselects the artwork (`src/print.mjs:75`), for example `print.html?design=de-a`.
- It is linked from 11 pages (`grep -l "print.html" *.html`, excluding `print.html` itself): `calendar.html:45` (`design=de-a`), `clock.html:47`, `chronocube.html:71`, `ms-timer.html:45`, `counter.html:58`, `timer.html:58`, `hm-one-cube.html:58`, `five-second-timer.html:58`, `hsm-counter.html:58`, `ms-counter.html:58` and `tenth-counter.html:58` (all `design=words-pascal`). All 11 are legacy pages or the old studio and leave in stages 3 to 5. After decision 10, `print.html` is callable from the cube applications (decision 10: slot 5 of every application with a print design, design of the running application) and has no entry on the landing page or the Cubes page; `print-sheets.spec.mjs` and the page itself stay.
- Spec: `tests/browser/print-sheets.spec.mjs`. Documentation: `docs/PRINT_STICKERS.md`.

## References
- PR #241 (merged): tokens and shell layout, step a. [ADR-0001](../adr/ADR-0001-shell-tokens.md).
- PR #262 (merged): studio controllers constructed with their real arguments.
- PR #266 (merged): smoke test of the ten studio modes.
- PR #269 (open, draft): the `tenth` studio mode binds its buttons to the studio controls.
- Issues #265 (`hm-clock` logs an invalid snapshot) and #267 (`switchMode` has no generation guard).
- Issue #263: studio timer modes do not move the cube.
- Issues #219 and #218: M/S Timer plan reconciliation and countdown offset; see [M/S Timer plan](ms-timer.md).
- Issue #190: Cubacle WASM replacement; see [plan](cubacle-wasm-replacement.md).

## Appendix: URL parameters read by the code (origin/main `7dae282`; the `mode` row and the `chronocube.html` line numbers re-read at the head of the stage 2 stack)
Source: search for `URLSearchParams`, `searchParams` and `params.get/has` in `src/` and the HTML entry points. Parameters read through helpers not matched by pattern may be missing; the inventory test of stage 4 closes that gap.

| Parameter | Read at | Page or script |
|---|---|---|
| `application` | `src/main.mjs:1262`, `:1717` | single-cube pages (the redirect in `index.html:14` is gone since stage 3) |
| `mode` | `src/main.mjs:1091` | single-cube pages (the studio reads `app` since the router, `src/apps/router.ts`) |
| `val`, `value` | `src/main.mjs:1176`, `:1184`, `:1196`, `:1752` | single-cube pages |
| `duration` | `src/main.mjs:1218` | single-cube pages |
| `unit`, `letter` | `src/main.mjs:1022` | single-cube pages |
| `dir`, `direction` | `src/main.mjs:1034` | single-cube pages |
| `range` | `src/main.mjs:1042` | single-cube pages |
| `speed` | `src/main.mjs:1049` | single-cube pages |
| `timer-speed`, `rate` | `src/main.mjs:1099` | single-cube pages |
| `lettering` | `src/main.mjs:63`, `:1059`, `src/apps/clock/params.ts` | single-cube pages, clock mode |
| `display`, `font` | `src/main.mjs:688`, `:1066` | single-cube pages |
| `pad`, `padding` | `src/main.mjs:1086`, `src/calendar.mjs:340` | single-cube pages, calendar |
| `marker` | `src/main.mjs:1078` | single-cube pages |
| `print` | `src/main.mjs:1757` | single-cube pages |
| `autoplay`, `run` | `src/main.mjs:1117`, `src/ms-timer.mjs:455` | single-cube pages, M/S Timer |
| `kiosk`, `presentation` | `src/main.mjs:1109`, `src/calendar.mjs:363`, `src/ms-timer.mjs:451`, `src/chronocube.mjs:1182` | all of these |
| `nerd`, `dev`, `expert` | `src/clock.mjs:345-347`, `src/apps/shell/slot-api.ts` (`nerdOpenFromSearch`, `nerd` only) | clock page, all modes |
| `hours-speed`, `minutes-speed`, `seconds-speed` | `src/apps/clock/params.ts` | clock mode |
| `date`, `lang`, `language`, `design` | `src/calendar.mjs:344`, `:331` | calendar |
| `design` | `src/print.mjs:75` | print |
| `year`, `month` | `src/apps/calendar7/month-view.ts` (`chooseMonth`) | 7x7 calendar mode (`calendar7`) |

Owner decision 7 sets `app` as the key of the application in `index.html?app=<id>`; it replaces `application` (and the application meaning of `mode`). The names of the other parameters are not changed by it. `src/app-switch-url.mjs` drops `val`, `value`, `duration`, `year` and `month` when switching applications. `playground.html`, `picture3.html` and `status.html` read none by this search (not further verified).

Back to [Plans](index.md).
