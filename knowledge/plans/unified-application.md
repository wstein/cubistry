---
id: PLAN-UNIFIED-APPLICATION
title: One application instead of single-page entry points
type: plan
status: draft
created: 2026-11-07
---
# One application instead of single-page entry points

## Purpose
Replace the single-page entry points (`clock.html`, `counter.html`, `timer.html`, ...) by ONE application with a landing page, a second page "Others" and one mode per application. This plan records the owner decisions of 2026-11-07, the verified current state, a staged plan with a safety gate per stage, the risks and the decisions that are still open. The front matter status stays `draft`: [CONVENTIONS](../CONVENTIONS.md) defines no status for owner-approved plans. Plans do not confer approval beyond the decisions recorded here.

Evidence level: the current-state facts below were re-read on `origin/main` at `7dae282` (code, workflow files, PR and issue texts). Nothing was run in a browser; every statement about how a mode behaves at runtime is `UNKNOWN` unless a test is cited. PR counts are estimates, not measurements.

## Decisions (owner, 2026-11-07)
1. **Approach A, "contract first, thin".** Define a mode contract, build the landing page and the Others page, port each application from its legacy page into a mode, switch specs and links, then delete the legacy pages.
2. **The old pages go completely, without crutches.** No redirect shims, no compatibility pages, no half-maintained doubles. At no step may an application or a cube become unusable.
3. **Landing page.** The Live Clock is on top. Below it are the main applications: Clock, M/S Timer, Calendar, Playground, Counter. A second page "Others" holds everything else.
4. **Studio page.** The rename to "Chronocube 2×2 Studio" was rejected. The current studio page is unacceptable because of its name and its error state.

Recommendations in this plan that go beyond these statements (print under Others, `chronocube.html` is not the final shell, mounting existing engines instead of rewriting them) are recommendations, not decisions; see "Open decisions".

## Current state (verified on `origin/main` at `7dae282`)
- `index.html` redirects to `clock.html` (meta refresh and `location.replace`; `?application=<id>` is mapped to `<id>.html`). `tests/mpa-routing.test.mjs:57` ("root index.html redirects to clock.html") enforces it. There is no landing page and no Others page.
- `chronocube.html` is the studio shell (PR #241, step a of the unified view rework: tokens and layout, [ADR-0001](../adr/ADR-0001-shell-tokens.md)). It is not linked from `index.html`; the legacy pages reach it through a chooser option. Its mode switcher reads `?mode=<id>`; the legacy single-cube pages use `?application=<id>` or the file name. Two parameter schemes exist.
- The studio has 10 modes. In 8 of them (`clock`, `hm-clock`, `counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`, `timer`, `five-second-timer`) `src/chronocube.mjs` constructs the controller with an options object instead of the real positional arguments; `ms-timer` and `tenth` call the constructors positionally. An earlier count of 7 omitted one mode; the table in PR #262 names 8. PR #262 (open, draft) fixes all 8 through factories under `src/apps/chronocube/`. Until it merges, the default studio mode `clock` fails in the headless browser run reported in PR #241.
- The studio modes are separate, smaller implementations (readouts and +1/-1/+10/-10/Reset buttons), not equivalents of the legacy pages. They read only `mode`, `presentation` and `kiosk`; parameters such as `val`, `unit`, `duration`, `lettering` are read only by `src/main.mjs` and the per-page scripts. Issue #263: in the studio timer modes the cube does not follow the countdown.
- `vite.config.mjs` builds 19 HTML inputs: chronocube, picture3, playground, status, print, calendar, clock, ms-timer, index, counter, timer, five-second-timer, tenth-counter, hsm-counter, ms-counter, hm-one-cube, solver-acceptance, library-example, licenses.
- Seven pages (`counter`, `timer`, `five-second-timer`, `tenth-counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`) are near-identical HTML files that load `src/main.mjs` and differ by `data-default-application`. `clock`, `ms-timer`, `calendar`, `playground`, `picture3`, `status`, `print` have their own scripts.
- The studio switcher lists 23 options (from a code reading, not a browser run): the 10 modes `clock`, `ms-timer`, `hm-clock`, `tenth`, `counter`, `timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube`, and 13 links to legacy pages. `hm-clock` exists only in the studio. `calendar`, `playground`, `picture3` and `status` have no mode and are reached only as links. `print.html` is linked from the studio header; `licenses.html` from every footer.
- Test coverage gaps. The single-cube pages are covered by E2E almost only through `/counter.html` plus the `?application=` selector (`workshop-timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube` specs). `five-second-timer.html`, `tenth-counter.html`, `hsm-counter.html`, `ms-counter.html` and `hm-one-cube.html` have no direct E2E, only the markup test in `tests/mpa-routing.test.mjs`; `timer.html` is reached only through the chooser of `counter.html` (`tests/pages/production.spec.mjs:208`). The live-clock spec `tests/browser/live-clock.spec.mjs:223-230` switches to `index.html?application=hsm-counter` through a hidden option (`clock.html:38`). `tenth-counter` has a unit test and no E2E. The studio modes have no functional test; `tests/browser/shell-layout.spec.mjs` checks layout only. Pages specs `tests/pages/production.spec.mjs` use `counter.html`, `timer.html` and `./`.
- Not specified anywhere in the repository: landing layout, Live Clock as flagship, the main/others split (before this plan), the "owner-approved design proposal" cited in ADR-0001, and steps b to g of the unified view. No issue or PR exists for the landing page. PR #262 refers to the landing page work ("handled by the landing page work"); issue #219 says to answer its questions "before step b of the unified view".

## Stages
PR counts are estimates (total about 22 to 30, 23 to 31 with PR #262). Limits: issue #198 records an owner decision of 2026-11-06 that raises the limits for the unified view work until it is complete, to 8 open units and 12 open ledger nits (afterwards 3 and 6); `e2e` label on the stack top only, drafts start with a named blocker. Every stage is a stack of small PRs that each keep `main` releasable.

| Stage | Content | PRs (est.) | Safety gate (nothing becomes unusable) | Deleted |
|---|---|---|---|---|
| 0 | Owner decisions of the section "Open decisions". | 0 | Decisions recorded in this plan. | nothing |
| 1 | Mode loader and smoke gate: merge PR #262 (all 8 call sites); one smoke spec over all 10 studio modes (no `#studio-error`, canvas rendered, no console error), split in two files for the time budget. | 1 to 2 beyond #262 | The smoke spec, written first and red, then green. Each new check is shown to fail on a mutation (CI only, per owner rule). | nothing |
| 2 | Mode contract and routing: `{ id, title, group (main or others), mount(root, params), dispose() }`, a registry, one URL scheme, parameter hand-over through `src/app-switch-url.mjs`; the studio switcher reads the registry. | 3 | Unit test: every registry id has mount, title, group and a help or spec link. Tests: an app parameter such as `?val=45` survives reload and is dropped on an app switch. | nothing |
| 3 | Landing and Others: a real `index.html` (Live Clock flagship, main applications), the Others page, shared header and footer on `src/shell/shell.css` and `tokens.css`, dark theme. Entries link to the legacy pages until their mode is ported (stage 4), so every card works at every step. | 3 to 4 | E2E: `/` shows the landing page without redirect; every card reaches a loading target. | the redirect in `index.html` with its `?application=` switch; replaced or removed with it: `mpa-routing.test.mjs:57`, the `./` check in `production.spec.mjs`, the hidden option `index.html?application=hsm-counter` in `clock.html:38` and the test that uses it (`live-clock.spec.mjs:223-230`) |
| 4 | Port each application into a mode, one parity PR per application (Clock 1, `hm-clock` 1, single-cube family 1 to 7, M/S Timer 1, Calendar, Playground, picture3, status and print 5; sum 9 to 15): Clock (three cubes), `hm-clock` (a mode without a legacy page; it must exist as a mode in the new structure unless the owner ends it, see Open decisions), the single-cube family over `src/main.mjs` (one engine-mount PR and up to six thin PRs), M/S Timer, Calendar, Playground, picture3, status, print. Mounts load lazily by dynamic import. | 9 to 15 | Per application, the existing spec is switched to the new URL and passes unchanged (not copied, not weakened); all parameters of the appendix keep working: the full parameter list is in the appendix, and an inventory test (every appendix parameter is read by the mode that read it before, checked against the code) is a gate of this stage. The legacy page stays until the stage-6 gate. | the thin studio modes in `src/chronocube.mjs` once a mode replaces them |
| 5 | Spec and link move: `goto("/counter.html...")`, `/clock.html`, `/calendar.html` ... in all specs, README, `docs/APPLICATIONS.md`, `scripts/readme-screenshot.mjs`, the chooser tests. | 3 | A search for legacy page names finds none except `licenses.html`, print and the dev pages the owner keeps. | chooser `<select>` options with `.html` targets, `externalMap` in `src/main.mjs` |
| 6 | Delete the legacy pages, one PR per group: (a) the seven single-cube pages and their vite inputs; (b) `clock`, `ms-timer`, `calendar`, `playground`, `picture3`, `status` and inputs; (c) `chronocube.html` and the rest of the old studio entry (only after the hosting document of the modes is fixed, see Open decisions, and `hm-clock` is ported or ended by the owner), `tests/chronocube-studio.test.mjs` adjusted. | 3 | Per page before deletion: the application is reachable as a mode, its ported spec is green, no reference remains in README, docs or tests. Stage 5 is merged first. | the listed pages and vite inputs; old URLs then return 404 (owner: no shims) |

Kept: new `index.html`, the Others page, `licenses.html`, all `public/*.json` and `*-source.json`. `print.html`, `solver-acceptance.html` and `library-example.html` depend on the open decision below.

## Risks
- Known red or flaky specs on `main` (owner list, not re-run for this plan): `ms-timer:33`, `presentation:38` (two), `smart-rotation:101`, intermittent `hsm-lettering:39` and `:113`, `presentation:160`. Layout specs stay red until the layout rework. The workflow "Counter checks" was reported failing on `7dae282` (fast groups 2 and 3, timing 1; issue #202 describes broad e2e failures, cause unknown). A port PR compares the red set before and after: the same set, no new entries, and no spec weakened "because of the move".
- Specs that load `/counter.html` are lost when the page is deleted; stage 5 must merge before stage 6.
- Two parameter schemes (`mode` and `application`, with `counter` vs `certified` and `tenth` vs `tenth-counter`) break deep links and the `urlAfterAppSwitch` tests unless unified in stage 2.
- GitHub Pages and previews: `tests/pages/*.spec.mjs` run against the production build with base `/cubistry/`; previews use `/cubistry/pr-preview/pr-N/`. Value of `PAGES_PREVIEWS_ENABLED`: `UNKNOWN` (not readable).
- `licenses.html` and the footer must stay reachable from every view (runtime-notices test).
- Bundle size: one application bundles the calendar solver, the 3x3 picture solver and the counter solver. Lazy mounts are required; startup cost is not measured (`UNKNOWN`).
- Conflicts with the Cubacle WASM replacement (issue #190), which touches the calendar and picture adapters.
- Test limits: local test runs are capped at 5 minutes each; E2E uses software GL at 30 s per test, so the smoke spec is split.
- M/S Timer port: issues #219 (plan vs built app) and #218 (countdown shows 1 s more on the cubes) are open and touch the port PR.

## Open decisions
Not decided. Each recommendation comes from the code reading behind this plan; the price is what it costs.

| Topic | Recommendation | Price |
|---|---|---|
| Application name | "Cubistry" (drops the studio names). | Titles, README and ADR-0001 wording change; "Chronocube" remains the reference application name only. |
| URL scheme | Query `?app=<id>` plus app parameters, for example `?app=hsm-counter&val=45`. | A query is a single document on GitHub Pages and works under previews. The alternative hash (`#/clock`) duplicates parameter handling and is not seen by the server. GitHub Pages has no SPA rewrites, so path-style URLs are excluded unless each path is a built file. |
| Dev and tool pages | `licenses.html` stays as the required page; `print.html` is linked under Others; `solver-acceptance.html` and `library-example.html` are the owner's call (keep as dev pages, or drop from the Pages build). | Both dev pages have E2E (`acceptance.spec`, `production.spec`); dropping them removes that coverage or moves it. |
| Unified mode ids | One list with one key; today `mode` and `application` differ (`counter` vs `certified`, `tenth` vs `tenth-counter`). | Tests using `application=` (hsm-lettering, print-sheets, target-interruption, ms-counter, ms-timer) change. |
| `hm-clock` | Keep it as a mode (it has no legacy page; deleting `chronocube.html` would otherwise end it, and a cube application would become unusable). | One more port PR in stage 4 and a spec; it is in the studio only and has no E2E. |
| Hosting document of the modes | Not decided. Candidate: the new `index.html` hosts the landing page and, with `?app=<id>`, the modes. After stage 6(c) `chronocube.html` no longer exists, so some document must host them. | Decides the shape of stage 2 and 3; with a single host document the landing page and the modes share one bundle (see Risks, bundle size). |
| Print under Others | `print.html` is linked under Others (not part of the owner's statements). | One link; it stays a separate page. |
| `chronocube.html` as shell | Treated as not final (an inference from the rejected rename, not an owner statement); the owner confirms or corrects. | If it were kept as the shell, stage 6(c) changes. |
| Transitional links | Landing cards in stage 3 link to existing pages until their mode is ported. These are ordinary links, not shims; judged consistent with decision 2 in review. | Owner confirms; otherwise stage 3 waits for stage 4. |
| Start behavior | No auto-redirect to the last used mode (the keys `cubistry_chronocube_mode` and `cubistry_app` stop driving the landing page). | Returning users do not resume automatically. |

## References
- PR #241 (merged): tokens and shell layout, step a. [ADR-0001](../adr/ADR-0001-shell-tokens.md).
- PR #262 (open, draft): studio controllers constructed with their real arguments.
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

`src/app-switch-url.mjs` drops `val`, `value` and `duration` when switching applications. `playground.html`, `picture3.html` and `status.html` read none by this search (not further verified).

Back to [Plans](index.md).
