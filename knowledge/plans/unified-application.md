---
id: PLAN-UNIFIED-APPLICATION
title: One application instead of single-page entry points
type: plan
status: draft
created: 2026-11-07
---
# One application instead of single-page entry points

## Purpose
Replace the single-page entry points (`clock.html`, `counter.html`, `timer.html`, ...) by ONE application with a landing page, a second page "Others" (proposal: Cubes) and one mode per application. This plan records the owner decisions of 2026-11-07, the verified current state, a staged plan with a safety gate per stage, the risks and the decisions that are still open. The front matter status stays `draft`: [CONVENTIONS](../CONVENTIONS.md) defines no status for owner-approved plans. Plans do not confer approval beyond the decisions recorded here.

Evidence level: the current-state facts below were re-read on `origin/main` at `7dae282` (code, workflow files, PR and issue texts); the studio facts and the print page facts were re-read at `eb1dcce3` (after PRs #262 and #266). Nothing was run in a browser; every statement about how a mode behaves at runtime is `UNKNOWN` unless a test is cited. PR counts are estimates, not measurements.

## Decisions (owner, 2026-11-07)
1. **Approach A, "contract first, thin".** Define a mode contract, build the landing page and the Others page (proposal: Cubes), port each application from its legacy page into a mode, switch specs and links, then delete the legacy pages (the order per application is set by decision 8).
2. **The old pages go completely, without crutches.** No redirect shims, no compatibility pages, no half-maintained doubles. At no step may an application or a cube become unusable. *(Redirect part OPEN, see row c of "Design proposal is master: where the plan must follow it"; README:8 (old `#more` redirects, mock) and the brief at its line 39 (per-app URLs) mention redirects.)*
3. **Landing page.** The Live Clock is on top. Below it are the main applications: Clock, M/S Timer, Calendar, Playground, Counter. A second page "Others" holds everything else. *(Superseded by: proposal is master. Four apps, second page "Cubes"; see the section "Design proposal is master".)*
4. **Studio page.** The rename to "Chronocube 2×2 Studio" was rejected. The current studio page is unacceptable because of its name and its error state.

5. **Name.** The application name stays "Cubistry". The rename was rejected before and is now final.
6. **`hm-clock`.** It stays and must exist as a mode in the new structure.
7. **URL scheme.** `index.html?app=<id>`. The landing page is `index.html` without a parameter. *(Superseded by: proposal is master where it differs; routing is OPEN.)*
8. **No transitional links.** The landing page never links to the old pages. Applications are shown only in the unified view and are migrated quickly instead.
9. **Tool pages.** `licenses.html` stays. The fate of `solver-acceptance.html` and `library-example.html` is still open (`print.html`: decision 10).
10. **`print.html` (owner, 2026-11-07: "Ja, bitte so in den Plan übernehmen").** `print.html` stays a separate page. It is opened directly from the cube applications: the slot "Print & appearance" (slot 5) of each application that has a print design (Calendar, Live Clock, H-M Wall Clock, the H/M/S counters) gets a button "Print stickers for this app" that opens `print.html?design=...` in a new tab (mock `docs/design/cubistry-mock.html:952-953`, which places it in a slot captioned "Tools"; the README slot map, `docs/design/README.md:17-28`, lists no print button). There is no entry for it in the catalog of the landing page or of the Cubes page.

Recommendations in this plan that go beyond these statements (`chronocube.html` is not the final shell, mounting existing engines instead of rewriting them) are recommendations, not decisions; see "Open decisions".

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
Stages 2 to 5 and their estimates are unchanged and predate the owner statement that the design proposal is master; where they use `?app=`, "Others", the main/others split, or no-redirect and no-shim statements (stage 3 text, stage 5 "old URLs return 404") they are subject to the section "Design proposal is master: where the plan must follow it" (rows a to c).

PR counts are estimates (total about 16 to 22 with `print` as a mode, 15 to 21 without it; one more with PR #269). Limits: issue #198 records an owner decision of 2026-11-06 that raises the limits for the unified view work until it is complete, to 8 open units and 12 open ledger nits (afterwards 3 and 6); `e2e` label on the stack top only, drafts start with a named blocker. Every stage is a stack of small PRs that each keep `main` releasable.

Owner decision 8 (not contradicted by the proposal) says only this: the landing page never links to the old pages, applications are shown only in the unified view, and they are migrated quickly instead. The following order is a recommendation derived from it, not a statement of the owner: the landing page lists an application when its mode exists; each application is migrated in one step (its mode, its landing or Others entry, its specs switched to `index.html?app=<id>`, and the removal of its legacy page, vite input and links to it), in the same PR or an immediately following PR; Clock goes first and `counter.html` goes last of the family. No shims, redirects or compatibility pages are added (decision 2; its redirect part is OPEN, row c of "Design proposal is master: where the plan must follow it"). A legacy page that is not yet migrated stays reachable by its own URL only.

| Stage | Content | PRs (est.) | Safety gate (nothing becomes unusable) | Deleted |
|---|---|---|---|---|
| 0 | Owner decisions of the section "Open decisions". | 0 | Decisions recorded in this plan. | nothing |
| 1 | Studio smoke gate: PRs #262 and #266 are merged; remaining is PR #269 (`tenth`). The smoke spec covers all 10 studio modes (no `#studio-error`, canvas rendered, no console error), split for the time budget. | 0 beyond #269 | The smoke spec is green on all 10 modes (`UNKNOWN` until CI shows it). No new check is added in this stage; the smoke spec (one file, one test per mode plus a switch test) already exists, so no mutation is required here. | nothing |
| 2 | Mode contract and routing: `{ id, title, group (main or others; proposal: apps or cubes), mount(root, params), dispose() }`, a registry, the URL scheme `index.html?app=<id>` with app parameters, parameter hand-over through `src/app-switch-url.mjs`; `index.html` is the host document of the landing page and of the modes. The studio switcher reads the registry. | 3 | Unit test: every registry id has mount, title, group and a help or spec link. Tests: an app parameter such as `?val=45` survives reload and is dropped on an app switch. | nothing |
| 3 | Landing and first migration: the real `index.html` without a parameter (Live Clock on top, then the entries of the migrated main applications), the Others page (proposal: Cubes), shared header and footer on `src/shell/shell.css` and `tokens.css`, dark theme; Clock (three cubes) is the first mode, so the landing page is not empty. The redirect in `index.html` goes away in the same PR that makes the landing page real, which is the PR that ports Clock. | 3 | E2E: `/` shows the landing page without redirect; `?app=clock` loads the Clock mode; every shown entry reaches a loading target; the landing page contains no link to a `*.html` application page. | the redirect in `index.html` with its `?application=` switch; `clock.html` with its vite input (17 files contain the string `clock.html`, `grep -l "clock.html" *.html`: the page itself, the `index.html` redirect, and 15 others, among them `licenses.html:26` and `print.html:20`, which stay; every such reference is edited in this PR, so `licenses.html` and `print.html` are touched); replaced or removed with it: `mpa-routing.test.mjs:57`, the `./` check in `production.spec.mjs`, the hidden option `index.html?application=hsm-counter` in `clock.html:38` (leaves with the page) and its test (`live-clock.spec.mjs:223-230`, retargeted to a mode that exists at that time or moved to the PR that ports `hsm-counter`; not kept alive by a redirect) |
| 4 | Migrate the remaining applications, one PR per application (the slot-5 print link of decision 10 is part of the port of each application with a print design, not its own PR; the `print` wording and counts in this row and above predate decision 10 and are not changed here), each with its legacy page removal: `hm-clock` (a mode without a legacy page; decision 6), M/S Timer, Calendar, Playground, picture3, status, print if it stays a mode of the app (open), and the single-cube family over `src/main.mjs` (one engine-mount PR and up to six thin PRs; `counter.html` goes last of the family because the family specs reach the other pages through its `?application=` selector). Entries appear on the landing or Others page with the PR that ports the mode. Mounts load lazily by dynamic import. Sum 8 to 14 with `print` counted as a mode, 7 to 13 without it (`print` is an open decision). | 8 to 14 (7 to 13 without `print`) | Per application: the existing spec is switched to the new URL and passes unchanged (not copied, not weakened); all parameters of the appendix keep working: the full parameter list is in the appendix, and an inventory test (every appendix parameter is read by the mode that read it before, checked against the code) is a gate of this stage. A legacy page is deleted only when its mode is reachable, its ported spec is green and no remaining page, README, doc or test references it (the remaining legacy pages that linked to it, for example through the chooser, are edited in the same PR). | per application: its legacy page, vite input, chooser option and `externalMap` entry; the thin studio mode in `src/chronocube.mjs` once a mode replaces it |
| 5 | Remove the old studio and sweep: delete `chronocube.html` and the rest of the old studio entry (only after `hm-clock` is a mode, owner decision 6), `tests/chronocube-studio.test.mjs` adjusted; remove the chooser `<select>` and `externalMap` in `src/main.mjs` if still present; update README, `docs/APPLICATIONS.md`, `scripts/readme-screenshot.mjs`. | 2 | A search for legacy page names finds none except `licenses.html` and the tool pages the owner keeps (open decision). | `chronocube.html`, the chooser, remaining dead code; old URLs return 404 (owner: no shims; redirect part OPEN, row c of "Design proposal is master: where the plan must follow it") |

Kept: new `index.html`, the Others page (proposal: Cubes), `licenses.html`, all `public/*.json` and `*-source.json`. `print.html` stays as its own page (decision 10); `solver-acceptance.html` and `library-example.html` depend on the open decision below.

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
Owner statement (2026-11-07, quoted from the coordinator's relay): the design proposal is well worked out and is master; the earlier decisions of the same day were cited from memory and were probably phrased misleadingly. Source: [docs/design/README.md](../../docs/design/README.md) and `docs/design/cubistry-mock.html` (added verbatim; cited by [ADR-0001](../adr/ADR-0001-shell-tokens.md)). The stages and estimates in this plan are not changed here; a later PR adjusts them after the owner answers the OPEN items. Decisions 3, 7 and 8 above carry the note "superseded by: proposal is master" where they contradict the proposal.

| # | Topic | Earlier plan text | Design proposal (master) | Status |
|---|---|---|---|---|
| a | Apps on the landing page | Five: Clock, M/S Timer, Calendar, Playground, Counter (decision 3) | Four: Live Clock, Stopwatch (M/S Timer & Stopwatch), Calendar, Playground (README:7, :58; mock `featured:true` at lines 657, 686, 749, 789). The Counter belongs to Cubes (mock line 732, no `featured`). | Follow the proposal for the list of four apps (README:7, mock). README:58 belongs to deviation 1 (OPEN); what stays OPEN in it is the Home page as a new page with two categories, that new cubes go to Cubes by default, and that moving a cube to Apps is an owner decision. |
| b | Second page | "Others" (decision 3) | "Cubes": the Cube collection, a flat gallery of the nine other cubes (README:8; mock line 1041). | Follow the proposal for the name and form of the second page (README:8, mock). The OPEN part of deviation 1 (README:58) applies here too: which cubes sit on it by default. |
| c | Routing | `index.html?app=<id>` (decision 7), no redirects or shims (decision 2), no transitional links (decision 8) | The mock uses `#home`, `#cubes` (old `#more` redirects) and `#app-<id>` (README:7-9). README:67 says production keeps `?application=` plus kiosk and autostart flags. The implementing brief supplied with the proposal (not in the repository, line 39) says to redirect the existing per-app URLs into the unified view. | OPEN: the owner has not given a concrete answer; both sources stand side by side |
| e | Fonts | Self-hosted IBM Plex (ADR-0001 line 44, `src/shell/tokens.css`) | The mock loads IBM Plex and Noto Sans from `fonts.googleapis.com` (mock lines 8-10); README:45 and :78 call the type pairing a proposal. | Check item: the repository keeps self-hosting; the owner confirms |
| f | `hm-clock` | Stays and must exist as a mode (decision 6) | Listed as "H-M Wall Clock" (README:20; mock line 660, short name "Wall Clock"). | Follow the proposal (name); the mode requirement is unchanged |

Row d: the ten deviations that README:56-67 lists under "Deviations that need an owner decision" are OPEN. The owner has said nothing concrete about them. Items 1, 4, 5 and 10 touch rows a to c; items 2, 3 and 6 to 9 touch only shell behavior. The mock's 13-entry switcher (README:61) is part of item 4.

| No. | README line | Deviation | Status |
|---|---|---|---|
| 1 | 58 | New Home page with Apps and Cubes; new cubes go to Cubes by default | OPEN |
| 2 | 59 | Header above the stage instead of a floating HUD (reverses 2026-11-02) | OPEN |
| 3 | 60 | Controls always visible instead of on hover | OPEN |
| 4 | 61 | Switcher with 13 entries in two sections instead of 23 select entries | OPEN |
| 5 | 62 | Calendar, Playground and CI Cube run in the shared view; 3x3 Super Picture Cube becomes a Playground cube choice | OPEN |
| 6 | 63 | One Present button instead of Present and Presentation | OPEN |
| 7 | 64 | Readout under each cube; committed-moves table moves into the hidden Nerd drawer | OPEN |
| 8 | 65 | The clock gets a primary action (Pause / Resume) | OPEN |
| 9 | 66 | Label style options renamed (title case or lower case) | OPEN |
| 10 | 67 | Deep links: `#app-clock` in the mock; production keeps `?application=` | OPEN |

## Open decisions
Not decided. Each recommendation comes from the code reading behind this plan; the price is what it costs. Decided items (name, `hm-clock`, `licenses.html`, `print.html`, transitional links) are in the section "Decisions". The URL scheme and redirects are OPEN (decision 7 is superseded by the proposal; row c of "Design proposal is master: where the plan must follow it").

| Topic | Recommendation | Price |
|---|---|---|
| Dev pages `solver-acceptance.html`, `library-example.html` | Open. Options: keep as dev pages, or drop from the Pages build. (`print.html` is decided, decision 10; facts: "What `print.html` is" below.) | Both dev pages have E2E (`acceptance.spec`, `production.spec`); dropping them removes that coverage or moves it. |
| Unified mode ids | One list with one key, `app` (decision 7, superseded by: proposal is master; routing OPEN, row c); today `mode` and `application` differ (`counter` vs `certified`, `tenth` vs `tenth-counter`). The ids of the list are not decided. | Tests using `application=` (hsm-lettering, print-sheets, target-interruption, ms-counter, ms-timer) change. |
| `chronocube.html` as shell | Treated as not final (an inference from the rejected rename and from `index.html` hosting the modes, not an owner statement); the owner confirms or corrects. | If it were kept as the shell, stage 5 changes. |
| Start behavior | No auto-redirect to the last used mode (the keys `cubistry_chronocube_mode` and `cubistry_app` stop driving the landing page). | Returning users do not resume automatically. |

### What `print.html` is
Facts read from the repository at `eb1dcce3`; the run-time behavior is `UNKNOWN` here.
- Title "Cubistry · Print stickers" (`print.html:11`); script `src/print.mjs` (94 lines).
- It generates vector print and cut sheets with rounded sticker cuts and an assembly guide (`docs/PRINT_STICKERS.md`: `print.pdf`, `artwork-N.svg`, `cuts-N.svg`, `assembly.pdf`, `manifest.json`).
- The query parameter `design` preselects the artwork (`src/print.mjs:75`), for example `print.html?design=de-a`.
- It is linked from 11 pages (`grep -l "print.html" *.html`, excluding `print.html` itself): `calendar.html:45` (`design=de-a`), `clock.html:47`, `chronocube.html:71`, `ms-timer.html:45`, `counter.html:58`, `timer.html:58`, `hm-one-cube.html:58`, `five-second-timer.html:58`, `hsm-counter.html:58`, `ms-counter.html:58` and `tenth-counter.html:58` (all `design=words-pascal`). All 11 are legacy pages or the old studio and leave in stages 3 to 5. After decision 10, `print.html` is linked from slot 5 of the applications that have a print design (the link is added by each port) and not from the landing page or the Cubes page; `print-sheets.spec.mjs` and the page itself stay.
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

## Appendix: URL parameters read by the code (origin/main `7dae282`)
Source: search for `URLSearchParams`, `searchParams` and `params.get/has` in `src/` and the HTML entry points. Parameters read through helpers not matched by pattern may be missing; the inventory test of stage 4 closes that gap.

| Parameter | Read at | Page or script |
|---|---|---|
| `application` | `index.html:14`, `src/main.mjs:1262`, `:1717` | redirect, single-cube pages |
| `mode` | `src/main.mjs:1091`, `src/chronocube.mjs:1180`, `:1195` | single-cube pages (`mode`), studio |
| `val`, `value` | `src/main.mjs:1176`, `:1184`, `:1196`, `:1752` | single-cube pages |
| `duration` | `src/main.mjs:1218` | single-cube pages |
| `unit`, `letter` | `src/main.mjs:1022` | single-cube pages |
| `dir`, `direction` | `src/main.mjs:1034` | single-cube pages |
| `range` | `src/main.mjs:1042` | single-cube pages |
| `speed` | `src/main.mjs:1049` | single-cube pages |
| `timer-speed`, `rate` | `src/main.mjs:1099` | single-cube pages |
| `lettering` | `src/main.mjs:63`, `:1059`, `src/clock.mjs:37` | single-cube pages, clock |
| `display`, `font` | `src/main.mjs:688`, `:1066` | single-cube pages |
| `pad`, `padding` | `src/main.mjs:1086`, `src/calendar.mjs:340` | single-cube pages, calendar |
| `marker` | `src/main.mjs:1078` | single-cube pages |
| `print` | `src/main.mjs:1757` | single-cube pages |
| `autoplay`, `run` | `src/main.mjs:1117`, `src/ms-timer.mjs:455` | single-cube pages, M/S Timer |
| `kiosk`, `presentation` | `src/main.mjs:1109`, `src/clock.mjs:418`, `src/calendar.mjs:363`, `src/ms-timer.mjs:451`, `src/chronocube.mjs:1200` | all of these |
| `nerd`, `dev`, `expert` | `src/clock.mjs:345-347` | clock |
| `hours-speed`, `minutes-speed`, `seconds-speed` | `src/clock.mjs:42`, `:314` | clock |
| `date`, `lang`, `language`, `design` | `src/calendar.mjs:344`, `:331` | calendar |
| `design` | `src/print.mjs:75` | print |

Owner decision 7 (superseded by: proposal is master; routing is OPEN, see row c of "Design proposal is master: where the plan must follow it") set `app` as the key of the application in `index.html?app=<id>`; it replaces `application` (and the application meaning of `mode`). The names of the other parameters are not changed by it. `src/app-switch-url.mjs` drops `val`, `value` and `duration` when switching applications. `playground.html`, `picture3.html` and `status.html` read none by this search (not further verified).

Back to [Plans](index.md).
