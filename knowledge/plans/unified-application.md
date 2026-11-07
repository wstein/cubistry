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
1. **Approach A, "contract first, thin".** Define a mode contract, build the landing page and the Others page, port each application from its legacy page into a mode, switch specs and links, then delete the legacy pages. The existing, spec-covered engines are mounted as modes (moved, not rewritten).
2. **Legacy entry points are dropped completely.** No redirect shims, no compatibility pages, no half-maintained doubles. At no step may an application or a cube become unusable.
3. **Landing page.** The Live Clock is the flagship on top. Below it are the main applications: Clock, M/S Timer, Calendar, Playground, Counter. A second page "Others" holds everything else (the other single-cube applications, picture3, status, print, ...).
4. **Shell name.** The current page `https://wstein.github.io/cubistry/chronocube.html` and its name "Chronocube 2×2 Studio" are not the final shell. The rename to "Chronocube 2×2 Studio" was rejected.

## Current state (verified on `origin/main` at `7dae282`)
- `index.html` redirects to `clock.html` (meta refresh and `location.replace`; `?application=<id>` is mapped to `<id>.html`). `tests/mpa-routing.test.mjs:57` ("root index.html redirects to clock.html") enforces it. There is no landing page and no Others page.
- `chronocube.html` is the studio shell (PR #241, step a of the unified view rework: tokens and layout, [ADR-0001](../adr/ADR-0001-shell-tokens.md)). It is not linked from `index.html`; the legacy pages reach it through a chooser option. Its mode switcher reads `?mode=<id>`; the legacy single-cube pages use `?application=<id>` or the file name. Two parameter schemes exist.
- The studio has 10 modes. In 8 of them (`clock`, `hm-clock`, `counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`, `timer`, `five-second-timer`) `src/chronocube.mjs` constructs the controller with an options object instead of the real positional arguments; `ms-timer` and `tenth` call the constructors positionally. The investigator report counts 7; its own list and the table in PR #262 name 8. PR #262 (open, draft) fixes all 8 through factories under `src/apps/chronocube/`. Until it merges, the default studio mode `clock` fails in the headless browser run reported in PR #241.
- The studio modes are separate, smaller implementations (readouts and +1/-1/+10/-10/Reset buttons), not equivalents of the legacy pages. They read only `mode`, `presentation` and `kiosk`; parameters such as `val`, `unit`, `duration`, `lettering` are read only by `src/main.mjs` and the per-page scripts. Issue #263: in the studio timer modes the cube does not follow the countdown.
- `vite.config.mjs` builds 19 HTML inputs: chronocube, picture3, playground, status, print, calendar, clock, ms-timer, index, counter, timer, five-second-timer, tenth-counter, hsm-counter, ms-counter, hm-one-cube, solver-acceptance, library-example, licenses.
- Seven pages (`counter`, `timer`, `five-second-timer`, `tenth-counter`, `hsm-counter`, `ms-counter`, `hm-one-cube`) are near-identical HTML files that load `src/main.mjs` and differ by `data-default-application`. `clock`, `ms-timer`, `calendar`, `playground`, `picture3`, `status`, `print` have their own scripts.
- The studio switcher lists 23 options (per the investigator report): the 10 modes `clock`, `ms-timer`, `hm-clock`, `tenth`, `counter`, `timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube`, and 13 links to legacy pages. `hm-clock` exists only in the studio. `calendar`, `playground`, `picture3` and `status` have no mode and are reached only as links. `print.html` is linked from the studio header; `licenses.html` from every footer.
- Test coverage gaps. The single-cube pages are covered by E2E almost only through `/counter.html` plus the `?application=` selector (`workshop-timer`, `five-second-timer`, `hsm-counter`, `ms-counter`, `hm-one-cube` specs). `timer.html`, `five-second-timer.html`, `tenth-counter.html`, `hsm-counter.html`, `ms-counter.html` and `hm-one-cube.html` have no direct E2E, only the markup test in `tests/mpa-routing.test.mjs`. `tenth-counter` has a unit test and no E2E. The studio modes have no functional test; `tests/browser/shell-layout.spec.mjs` checks layout only. Pages specs `tests/pages/production.spec.mjs` use `counter.html`, `timer.html` and `./`.
- Not specified anywhere in the repository: landing layout, Live Clock as flagship, the main/others split (before this plan), the "owner-approved design proposal" cited in ADR-0001, and steps b to g of the unified view. No issue or PR exists for the landing page. PR #262 and issue #219 refer to it ("handled by the landing page work", "before step b").

## Stages
PR counts are estimates (total about 28 to 34). Limits: stacks of at most 8 open units, `e2e` label on the stack top only, drafts start with a named blocker. Every stage is a stack of small PRs that each keep `main` releasable.

| Stage | Content | PRs (est.) | Safety gate (nothing becomes unusable) | Deleted |
|---|---|---|---|---|
| 0 | Owner decisions of the section "Open decisions". | 0 | Decisions recorded in this plan. | nothing |
| 1 | Mode loader and smoke gate: merge PR #262 (all 8 call sites); one smoke spec over all 10 studio modes (no `#studio-error`, canvas rendered, no console error), split in two files for the time budget. | 1 to 2 beyond #262 | The smoke spec, written first and red, then green. Each new check is shown to fail on a mutation (CI only, per owner rule). | nothing |
| 2 | Mode contract and routing: `{ id, title, group (main or others), mount(root, params), dispose() }`, a registry, one URL scheme, parameter hand-over through `src/app-switch-url.mjs`; the studio switcher reads the registry. | 3 | Unit test: every registry id has mount, title, group and a help or spec link. Tests: an app parameter such as `?val=45` survives reload and is dropped on an app switch. | nothing |
| 3 | Landing and Others: a real `index.html` (Live Clock flagship, main applications), the Others page, shared header and footer on `src/shell/shell.css` and `tokens.css`, dark theme. Entries link to the legacy pages until their mode is ported (stage 4), so every card works at every step. | 3 to 4 | E2E: `/` shows the landing page without redirect; every card reaches a loading target. | the redirect in `index.html` with its `?application=` switch; `mpa-routing.test.mjs:57` and the `./` check in `production.spec.mjs` are replaced |
| 4 | Port each application into a mode, one parity PR per application: Clock (three cubes), the single-cube family over `src/main.mjs` (one engine-mount PR and up to six thin PRs), M/S Timer, Calendar, Playground, picture3, status, print. Mounts load lazily by dynamic import. | 10 to 13 | Per application, the existing spec is switched to the new URL and passes unchanged (not copied, not weakened); `?val=`, `?application=`-style parameters, presentation, `kiosk`, `nerd`, `dev` keep working. The legacy page stays until the stage-6 gate. | the thin studio modes in `src/chronocube.mjs` once a mode replaces them |
| 5 | Spec and link move: `goto("/counter.html...")`, `/clock.html`, `/calendar.html` ... in all specs, README, `docs/APPLICATIONS.md`, `scripts/readme-screenshot.mjs`, the chooser tests. | 3 | A search for legacy page names finds none except `licenses.html`, print and the dev pages the owner keeps. | chooser `<select>` options with `.html` targets, `externalMap` in `src/main.mjs` |
| 6 | Delete the legacy pages, one PR per group: (a) the seven single-cube pages and their vite inputs; (b) `clock`, `ms-timer`, `calendar`, `playground`, `picture3`, `status` and inputs; (c) `chronocube.html` and the rest of the old studio entry, `tests/chronocube-studio.test.mjs` adjusted. | 3 | Per page before deletion: the application is reachable as a mode, its ported spec is green, no reference remains in README, docs or tests. Stage 5 is merged first. | the listed pages and vite inputs; old URLs then return 404 (owner: no shims) |

Kept: new `index.html`, the Others page, `licenses.html`, all `public/*.json` and `*-source.json`. `print.html`, `solver-acceptance.html` and `library-example.html` depend on the open decision below.

## Risks
- Known red or flaky specs on `main` (owner list, not re-run for this plan): `ms-timer:33`, `presentation:38` (two), `smart-rotation:101`, intermittent `hsm-lettering:39` and `:113`, `presentation:160`. Layout specs stay red until the layout rework. The workflow "Counter checks" was reported failing on `7dae282` (fast groups 2 and 3, timing 1; issue #202 describes broad e2e failures, cause unknown). A port PR compares the red set before and after: the same set, no new entries, and no spec weakened "because of the move".
- Specs that load `/counter.html` are lost when the page is deleted; stage 5 must merge before stage 6.
- Two parameter schemes (`mode` and `application`, with `counter` vs `certified` and `tenth` vs `tenth-counter`) break deep links and the `urlAfterAppSwitch` tests unless unified in stage 2.
- GitHub Pages and previews: `tests/pages/*.spec.mjs` run against the production build with base `/cubistry/`; previews use `/cubistry/pr-preview/pr-N/`. Value of `PAGES_PREVIEWS_ENABLED`: `UNKNOWN` (not readable).
- `licenses.html` and the footer must stay reachable from every view (runtime-notices test).
- Bundle size: one application bundles the calendar solver, the 3x3 picture solver and the counter solver. Lazy mounts are required; startup cost is not measured (`UNKNOWN`).
- Conflicts with the Cubacle WASM replacement (issue #190), which touches the calendar and picture adapters.
- Unit limits: local test runs are capped at 5 minutes each; E2E uses software GL at 30 s per test, so the smoke spec is split.
- M/S Timer port: issues #219 (plan vs built app) and #218 (countdown shows 1 s more on the cubes) are open and touch the port PR.

## Open decisions
Not decided. The recommendation is the investigator's; the price is what it costs.

| Topic | Recommendation | Price |
|---|---|---|
| Application name | "Cubistry" (drops the studio names). | Titles, README and ADR-0001 wording change; "Chronocube" remains the reference application name only. |
| URL scheme | Query `?app=<id>` plus app parameters, for example `?app=hsm-counter&val=45`. | A query is a single document on GitHub Pages and works under previews. The alternative hash (`#/clock`) duplicates parameter handling and is not seen by the server. GitHub Pages has no SPA rewrites, so path-style URLs are excluded unless each path is a built file. |
| Dev and tool pages | `licenses.html` stays as the required page; `print.html` is linked under Others; `solver-acceptance.html` and `library-example.html` are the owner's call (keep as dev pages, or drop from the Pages build). | Both dev pages have E2E (`acceptance.spec`, `production.spec`); dropping them removes that coverage or moves it. |
| Unified mode ids | One list with one key; today `mode` and `application` differ (`counter` vs `certified`, `tenth` vs `tenth-counter`). | Tests using `application=` (hsm-lettering, print-sheets, target-interruption, ms-counter, ms-timer) change. |
| Start behavior | No auto-redirect to the last used mode (the keys `cubistry_chronocube_mode` and `cubistry_app` stop driving the landing page). | Returning users do not resume automatically. |

## References
- PR #241 (merged): tokens and shell layout, step a. [ADR-0001](../adr/ADR-0001-shell-tokens.md).
- PR #262 (open, draft): studio controllers constructed with their real arguments.
- Issue #263: studio timer modes do not move the cube.
- Issues #219 and #218: M/S Timer plan reconciliation and countdown offset; see [M/S Timer plan](ms-timer.md).
- Issue #190: Cubacle WASM replacement; see [plan](cubacle-wasm-replacement.md).

Back to [Plans](index.md).
