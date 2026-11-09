# Actions validation lanes and browser environment

The quick Counter check and browser matrix have independent workflow concurrency.
A slow browser tail cannot hold the quick workflow's group. Runner availability
and image initialization can still delay either lane.

| Event | Quick `counter` | Browser jobs |
| --- | --- | --- |
| Ordinary pull request | Full validation | None |
| Pull request with `e2e` | Full validation | Three fast shards and `e2e-pages` |
| Main push | Full validation | Three fast, three timing, and `e2e-pages` |
| Nightly at 01:00 UTC | Skipped | Three fast, three timing, and `e2e-pages` |
| Manual Counter dispatch | Full validation | Three fast, three timing, and `e2e-pages` |

`Counter checks` retains the `counter` job and its complete `npm run check`,
pinned-research verification and committed-print checks. `Counter browser checks`
retains the existing `e2e fast (1)` through `e2e timing (3)` names and `e2e-pages`.
A manual Counter dispatch calls the reusable browser workflow and retains all
eight jobs. Direct browser-workflow dispatch runs its seven browser jobs only.
The pages/preview tests and Pastel Garden tile check remain in the browser lane.
No timeout, retry, assertion, worker count or low-effects setting is relaxed.

PR updates and newer main pushes supersede older read-only validation in their
own groups. Event names isolate scheduled and manual runs from main pushes.
Unrelated PR label runs use their own run-ID group: they neither start/cancel
the browser matrix nor evict a newer head still pending while cancellation
finishes.
Documentation validation follows the newest PR/main-push head as well.

Pages concurrency applies only to the read-only **build job**. Its legacy deploy
job keeps `counter-pages-publish` with cancellation disabled. The trusted publisher,
notification and cleanup contract is documented in [Pages previews](PAGES_PREVIEWS.md).
Stateful publication and research writers do not inherit CI cancellation policy.

## Pinned Chromium setup

Every browser-consuming Counter job and the Pages build use the official
Playwright Noble image, selected by immutable manifest digest:

```text
mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f
```

The [official Docker guide](https://playwright.dev/docs/docker) describes the image's
preinstalled browsers/system dependencies and the requirement to match the npm
Playwright version. The digest was read from the Microsoft registry's
[version manifest](https://mcr.microsoft.com/v2/playwright/manifests/v1.64.1-noble).
Its Linux amd64 child is
`sha256:ee15712262f017b8157421b212b12099146645f44b1bc5c0514cbbe6a229b1d0`.
The multi-platform manifest fixes both that selection and its arm64 counterpart.

The [environment pin](../scripts/ci/browser-environment.json) matches the locked
Playwright 1.64.1 package, Chromium revision 1248/version 156.0.8078.4, Ubuntu
24.04 and the committed Counter Sans font bytes. The image also fixes installed
system fonts. The image supplies Node 26, so `setup-node` explicitly selects
Node 24 before any repository command. Jobs set `TZ=UTC` to preserve the runner's
previous time-zone behavior. Python 3.12 setup remains explicit where needed.

After checkout, the disposable bind-mounted workspace is assigned to the job
container user with `chown -hR`, without following symlinks. Empty, root,
noncanonical and symlink workspace paths fail closed. Git ownership checks
remain enabled; no trust-list or global Git configuration workaround is added.
This precedes all repository Git work and records ownership before/after.

There is no per-job `playwright install --with-deps` or apt installation. Container
options retain shared memory through `--ipc=host` and use `--init`, as recommended
by Playwright. The existing SwiftShader launch flags remain unchanged.

The [environment action](../.github/actions/browser-environment/action.yml) runs a
[probe](../scripts/ci/browser-environment.mjs) after dependency installation. It
checks the image marker, Node/package/OS/architecture, preinstalled executable,
revision and font hashes before launching a browser. The launch verifies the
actual version, SwiftShader/WebGL2, exact navy clear pixel, loaded bundled font,
UTC and existing launch flags. A mismatch fails validation; it never installs a
fallback browser or changes a test setting.

Each job/shard retains a `browser-environment-*` JSON artifact, including failure
receipts, for seven days. It records browser/font/rendering identity and probe
startup timings. These timings exclude container pulling and initialization.
Use Actions job/step timestamps to compare the full setup cost; an image pull is
not free and a warm-cache result is not a cold-start measurement.

In sampled run [42644636335](https://github.com/wstein/cubistry/actions/runs/42644636335),
Chromium installation steps took 15–173 seconds while npm installation took
2–3 seconds. That is the motivating observation, not a promised improvement.
The pinned image and full browser matrix need runtime qualification on the exact
PR head before a latency or rendering-equivalence claim is made. Local unit or
native-browser probes do not qualify the amd64 image.

Browser or font updates require updating the explicit pin and repeating that
qualification. Existing developer commands remain in [Evidence and checks](EVIDENCE_AND_CHECKS.md).

The immutable amd64 image's default headless-shell binary reports
`156.0.8078.80`, although both Playwright 1.64.1 npm descriptors report
`156.0.8078.4` (revision 1248). The qualification profile pins these identities
separately: both descriptors, the selected registry executable and its
`--version`, and the launched browser version must match exactly. The mismatch
was observed in Counter run 42653650504; the official [v1.64.1 browser descriptors](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright-core/browsers.json)
retains `.4`. There is no channel override or version-prefix fallback.
The earlier native arm64 `.4` probe does not qualify this amd64 `.80` runtime.
