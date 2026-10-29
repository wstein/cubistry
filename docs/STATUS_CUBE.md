# Declarative Status Cube reference

The [Status Cube](../status.html) is the focused prototype for
[issue #84](https://github.com/wstein/cubistry/issues/84). One immutable 2×2 print
shows six local workflow states. Manual selection and simulated events share
the same physical controller. There are no live agent, GitHub or WorkHarbor
integrations.

## Fixed physical definition

[`definition.json`](../src/apps/status/definition.json) separates the print and
asset manifest from the application state machine:

| Field                     | Responsibility                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| `schema`, `version`, `id` | Bounded, versioned app-local configuration                       |
| `initial`                 | Initial logical and physical status                              |
| `print`, `assets`         | Permanent cubie/sticker IDs, local frames and artwork            |
| `statuses`                | IDs, labels, four fixed glyph tiles and legal setup references   |
| `events`                  | Event IDs, allowed source states, destination and optional fault |
| `demonstration`           | Deterministic local event sequence                               |

The six faces read **IDLE**, **PLAN**, **CODE**, **TEST**, **REVW**, and **DONE**
in row-major order. Each face has its own color, but the letters and full UI
labels carry meaning independently of color. Text tiles use the existing pinned
Noto Sans 800 font, its SHA256, the shared asset loader and the accompanying
[SIL Open Font License](../public/fonts/OFL.txt). Images are created once at
initialization; status changes never replace sticker images or reconfigure the
print. This is not a printable-sheet export.

Each status has a short legal setup word. For example `U D'` turns the two
opposite layers of a physical 2×2; it is a physical whole-cube reorientation,
not a camera command. Every animated token remains an existing outer face turn.
The generator assigns source print-up vectors through those actual rigid frames.
The schema validator then replays every setup and checks the exact upright
front through the canonical mechanics contract. Unit tests replay all 36 target
pairs, including inverse restoration. These explicit witnesses establish
reachability for this fixed six-state design; they do not establish arbitrary
workflow capacity, globally shortest paths or support for other puzzle sizes.

Reproduce the definition after building the existing core:

```sh
npm run build:core
node scripts/generate-status-design.mjs
node --test --test-isolation=none tests/status-definition.test.mjs tests/status-controller.test.mjs
```

The generator is deterministic and contains no solver, search or alternative
physical engine. It is an application-data construction rather than a change
to the accepted mechanics model.

## Logical events and committed physical state

`StatusWorkflow` applies the declarative event table to the **requested** logical
state. For example a rapid queued → coding → testing → review → done sequence
can finish logically before the physical cube catches up. Invalid events leave
that state unchanged and produce a visible error. A simulated `agent.failed`
event requests Review and displays an explicit fault; it does not invent a
seventh physical face. A subsequent normal event or manual override clears the
workflow fault.

`StatusController` adapts string status IDs to the existing
[`PhysicalPlayback`](../src/apps/shared/playback.ts) contract. It records only
successfully completed turns. From any committed intermediate pose it verifies
a legal route back through its source reference and onward to the chosen
status. The latest request replaces obsolete queued moves after the active
legal turn finishes. A return to the last completed status still repairs any
intermediate physical pose. Routes are bounded for this small catalog and are
not advertised as optimal.

The UI distinguishes requested status, last completed status, current move
progress, synchronization and errors. **Finish active status** discards the
queued target and finishes the current full display. **Stop demo** cancels only
future simulated events; the already requested physical display still finishes.
The quarter-turn setting uses the viewer's existing angular timing, with a half
turn taking twice as long.

An asset-integrity or initialization failure never claims a configured physical
status. An animation failure stops further requests, retains the authoritative
last committed pose and move count, and exposes **Reload application**. Recovery
starts a new page session; there is no unverified runtime teleport or guessed
completion of a failed turn. A viewer that fails partway through a turn may be
visually out of sync until that explicit reload.

## Architecture learning report

- **Declarative part:** states, fixed artwork references, allowed event sources,
  destinations, initial state and demonstration sequence are data. Ingress
  checks unknown references, duplicates, bounds and physical target witnesses.
- **Imperative remainder:** DOM binding, local demo timing, physical source
  references, resource ownership and error presentation remain small app-local
  adapters. No general runtime or new framework package is extracted.
- **Physical boundary:** the app imports the existing `@cubistry/cube-core`
  and `@cubistry/cube-mechanics` contracts and reuses `CubeViewer` and
  `PhysicalPlayback`. These current private workspaces contain the ReScript
  physical implementation described in [the M1 contract](SHARED_CUBE_M1.md).
  PuzlWerk remains the intended foundation owner; this prototype neither
  migrates that boundary nor duplicates its state, mechanics or orientation
  rules. It needs no runtime solver because all targets have checked setup
  references. Existing pinned PuzlWerk dependencies remain unchanged.
- **Extensibility friction:** `PhysicalPlayback` uses numeric display values,
  while workflow IDs are strings. A thin index adapter is sufficient here;
  do not redesign that shared interface from one example. Likewise, the main
  chooser and Vite entry list require explicit registration. A future
  consolidation can compare these points with other reference apps first.
- **Error handling hotspot:** general resumable failures need a clearer viewer
  rollback/resynchronization contract. This MVP deliberately freezes and offers
  explicit fresh-load recovery rather than pretending a rejected animation
  committed.
- **Next consolidation evidence:** compare target IDs, event coalescing,
  committed-pose notifications and app registration with the other reference
  applications before deciding on a shared declarative runtime. This report
  does not accept a new architecture decision or start that consolidation.

## Validation and boundaries

Focused Node tests cover all six targets, all target pairs, strict definition
rejection controls, deterministic events, source-reference continuity, rapid
preemption, finish-active behavior, resource cleanup and failure freezing.
Browser tests exercise native keyboard selection, all rendered statuses,
physical viewer/controller agreement, real non-reduced animation interruption,
invalid events, simulated failure, corrupt font bytes and fresh-load recovery.
A built-Pages case checks all assets under `/cubistry/` and event playback.
Desktop and mobile DPR2 checks keep the canvas CSS bounds inside its host while
retaining the high-resolution drawing buffer, and verify that camera dragging
does not change physical state before another status transition.

```sh
npm run typecheck
npm run check
npx playwright test tests/browser/status-cube.spec.mjs
npx playwright test --config playwright.pages.config.mjs tests/pages/status-cube.spec.mjs
```

Existing Counter, Timer, HSM, Clock and Calendar keep their implementations and
physical designs. Their existing regression gates remain applicable. The only
existing application change is a chooser link to this separate page. External
agents, workflow persistence, arbitrary uploaded definitions, additional error
faces and larger puzzles are outside this prototype.
