# Cube-first counter UI

[Issue #53](https://github.com/wstein/cubistry/issues/53) defines this change.
It starts from `76415c48600c61c2cb41e0f839f138b404ce8f64` on `main`, independently
of [PR #52](https://github.com/wstein/cubistry/pull/52). During implementation,
#52 merged into main; the feature rebased cleanly onto `5ba6109e628ebd93825cd5a5bd8a0c9a92d42846`. No unmerged
#52 branch was used as a development base.

## Interaction contract

Set requests the complete target state through the existing controller. Run
captures a numeric target and requests only the next adjacent value, at most
once per second and only after physical completion. It does not reconcile a
slow or suspended tab by jumping over values. Animation duration is separate
from this cadence. Editing the target during Run leaves the captured target
unchanged; Set or manual steps interrupt Run. Stop discards queued goals and
finishes the active complete value, preserving every required legal move.
A reload restores the last completed value and physical format, never a running
operation. Former minute-timer/Auto persistence does not resume hidden work.
The old timer and Auto modules and their unit regressions remain in the repository.

Leading Zero explicitly reconfigures the permanent print and resets value and
session to zero. The checked format uses the existing certified states/route;
the unchecked blank-tens format uses the existing original print and solver.
There are no solver, physical print, certificate, or proof-artifact changes.

The default camera uses 10° yaw, 7° elevation, radius 10.5, and 18° vertical
field of view. Orbit and zoom affect the camera only. The transient hint is
hidden on a drag of at least four pixels, an actual zoom change, or ten seconds;
a click does not dismiss it. It remains hidden until the viewer is recreated.
Reduced motion retains immediate physical commits and requires no hint fade.

## Related issue disposition

| Issue | Result under #53 | Remaining / recommendation |
| --- | --- | --- |
| [#42](https://github.com/wstein/cubistry/issues/42) | Shared chooser in the header above both columns; certified counter default; no personalization/apply detour; exhaustive certified replay retained. | Timer and application switching remain deferred to #30. Do not close the full issue as delivered. |
| [#43](https://github.com/wstein/cubistry/issues/43) | One Leading Zero checkbox next to Wrap; explicit permanent-print reset; checked/blank-tens persistence and validation. | Counter portion fulfilled. Future timer-specific visibility/switching remains open. |
| [#45](https://github.com/wstein/cubistry/issues/45) | Six exact duration stops, default 250 ms, keyboard operation, persistence and adjustment during playback. | Continuous multiplier requirement superseded by #53. Recommend marking that design superseded after review. |
| [#46](https://github.com/wstein/cubistry/issues/46) | Target-based Set/Run/Stop replaces Auto, with adjacent progression and bounded physical work. | UI design superseded by #53; historical code/tests retained. Recommend recording supersession after review. |
| [#37](https://github.com/wstein/cubistry/issues/37) | Larger readable cube, distant narrow-FOV oblique camera, orbit/zoom and responsive screenshots. | Presets and broader camera controls remain outside #53. Do not close the partial issue. |

No related issues are automatically closed. Custom fonts/colors (#49/#50),
preview infrastructure (#51), and 60-minute functionality (#30) are excluded.

## Acceptance-feedback polish

The follow-up section of Issue #53 and the maintainer's PR #54 handoff supersede
the initial optional disclosure and 100-ms default. The same feature branch and
existing commits are retained; the follow-up adds focused commits without
rewriting the accepted implementation's history.

- One shared application selector sits next to Cubistry in the header, wrapping
  within the header on narrow screens. The viewer and Counter panel have the
  same top alignment on two-column layouts.
- Session moves and current-sequence progress use aligned label/value rows in
  one directly visible block below the canvas, together with Current/live action
  state and Reset session moves. No statistics overlap the cube. Move Details
  and everyday certification/print-route jargon are removed; physical checks and
  genuine errors remain intact.
- Rotation Speed is the bottom-most viewer control, defaults to 250 ms, and
  retains all six approved stops/labels. Saved speed choices are preserved;
  saved state without a speed uses the new default.
- Set remains adjacent to one stable-position Run/Stop button. Its text,
  accessible name and pressed state update in place, including keyboard use.
  While a Set/manual transition is active the same button can stop queued work.
  Stop retains the existing complete-value semantics, then returns to Run.
- The approved camera, Wrap/Leading Zero placement, removed Custom Step, and
  all physical controller/solver/print/certificate bytes are unchanged.

Polish screenshots use the same fresh 00 state, viewport sizes and Chromium
settings as the earlier implementation; the earlier screenshots remain below.

| View | Before acceptance polish | After acceptance polish |
| --- | --- | --- |
| Desktop | ![Before polish desktop](assets/issue-53/after-desktop.png) | ![Polished desktop](assets/issue-53/polished-desktop.png) |
| Mobile | ![Before polish mobile](assets/issue-53/after-mobile.png) | ![Polished mobile](assets/issue-53/polished-mobile.png) |

The follow-up retains the 54 Node and 35 Python regressions and adds eight
browser cases (42 total), covering the stable toggle's geometry/focus/accessible
state, header fit, visible/aligned statistics, paired checkboxes at widths
1440/768/390/320, speed defaults, and saved speed preferences. The animated
queue test still checks every committed count and queued target; its completion
budget now accounts for 21 remaining turns at 250 ms plus rendering overhead.
Static-path and deep-base suites run sequentially because both build `dist`.
Final test and independent-review results are recorded in
[PR #54](https://github.com/wstein/cubistry/pull/54).

## Initial before and after

Captured locally at counter value 00 with fresh storage and reduced motion,
using system Chromium with SwiftShader. Desktop viewport: 1440 × 1000;
mobile viewport: 390 × 844. Before is unchanged `76415c4`; after is the #53 UI.
These are browser screenshots, not physical print exports.

| View | Before | After |
| --- | --- | --- |
| Desktop | ![Before desktop](assets/issue-53/before-desktop.png) | ![After desktop](assets/issue-53/after-desktop.png) |
| Mobile | ![Before mobile](assets/issue-53/before-mobile.png) | ![After mobile](assets/issue-53/after-mobile.png) |

## Validation and boundaries

Baseline `main`: `npm run check` passes (42 Node tests, 26 Python tests, physical
validators, typecheck and build); the existing browser suite passes 36/36.
Local browser checks use the installed `/usr/bin/chromium` via an uncommitted
configuration override. CI retains the repository's pinned Playwright browser.

After that main update, `npm run check` passes with 54 Node tests and 35 Python
tests, plus typecheck, physical validators, and build. The UI browser suite
initially passed 34/34, static production-path checks pass 4/4, and the unchanged preview
browser suite now on main passes 4/4. The canonical browser traversal still
independently replays exactly 339 HTM with a maximum of five per adjacent edge.

The updated regression suite replaces removed timer/Auto/custom-step UI
expectations with Set/Run/Stop tests while retaining their core unit tests.
It preserves exhaustive 00–99 browser execution, independent Python replay,
actual projected digit/orientation samples, arbitrary jump cases, queue/stop
accounting, asset failure diagnostics, and production-path static smoke tests.

Run deliberately slows below one value per second when a physical transition
takes longer. Stop finishes the active value rather than freezing a partial
face. The blank-tens variant does not acquire the certified traversal guarantee.

PR #52 changed preview workflows, helpers, package scripts, and preview browser
tests while this work was in progress. Rebasing onto its merged main state had
no textual conflicts. Its existing preview browser suite passes unchanged,
including both deep preview bases and the interactive production root. The
feature diff changes no preview workflows, helpers, deployment configuration,
or CI infrastructure. Future assertions should target the Counter heading and
`#set` and use the default-camera projection for digit pixel samples.
No merge, deployment, preview activation, Pages settings, or production
configuration changes are part of this work.
