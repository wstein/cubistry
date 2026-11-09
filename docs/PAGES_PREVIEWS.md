# PR previews: gated Ross integration

Issue [#51](https://github.com/wstein/cubistry/issues/51) requires the existing
[Ross PR preview action](https://github.com/rossjrw/pr-preview-action), not a
custom preview engine. Ross alone adds/removes preview directories. Trusted
repository helpers perform API provenance checks, bounded static archive
validation, reconciliation and stable status comments. They do not execute PR
code or replace Ross deployment behavior.

## Observed configuration and unchanged production

The audited site is `https://wstein.github.io/cubistry/`, HTTPS, Pages
`build_type: workflow`, no CNAME and no preexisting `gh-pages` branch. No Pages
setting is changed. Production remains at the same URL and uses the same
`/cubistry/` asset base. The selective Hugo/knowledge roadmap in
[issue #10](https://github.com/wstein/cubistry/issues/10) remains separate;
no documentation tree is copied into the demo.

`PAGES_PREVIEWS_ENABLED` is an **explicit maintainer activation gate**. Its
intended inactive value is absent/false. The current integration cannot read
repository variables (HTTP 403), so the present value is **not asserted**.
The maintainer must confirm absent/false **before merging this PR**: a preexisting
true value would activate the new default-branch workflow immediately on merge.
With the gate confirmed inactive, until separately approved activation, the existing main-only
Actions Pages deployment remains active and no preview storage write/comment
or deployment runs. Read-only PR/main builds may produce artifacts.

After activation, `gh-pages` is a static storage branch, not a second Pages
publishing source. Ross writes `pr-preview/pr-N/`; the pinned JamesIves action
updates production root with `force: false` and `clean-exclude: pr-preview/`.
An early Actions Pages deployment publishes a changed or not-yet-verified production
snapshot before preview reconciliation. After every nonempty preview matrix finishes,
a second deployment publishes changed combined storage. A live, nonce-bearing
publication receipt proves an unchanged snapshot before either phase can be skipped. Preview failures cannot block
the early production deployment; successful preview updates and cleanup can
still publish if another matrix entry fails. The old and
new deployers have mutually exclusive gate conditions and share the same global
publication concurrency group. There is no competing branch-source deployment,
Pages settings migration, force push or protected research change.

## Security boundary and event handling

- A PR gets a build and a preview only while it carries the `preview` label.
  Other labels start no build and do not cancel a running one. Removing the
  label removes the stored preview at the next reconciliation (a `main` push,
  a labeled PR build, a closed PR or a manual dispatch), not immediately.
- `pull_request` opened/reopened/synchronize builds check out the exact head,
  use contents-read only, do not persist credentials and have no publishing
  secrets or write permissions. Fork builds are excluded from this preview path.
- Trusted `workflow_run` completion and main-ref manual reconciliation check out
  **main only**. Closed/merged `pull_request_target` performs a metadata-only
  fixed `workflow_dispatch` to main: no checkout, build, artifact consumption or
  PR code. Its isolated signal job has only `actions: write` for that fixed
  dispatch, no content/Pages/OIDC write. Dispatch failure stops visibly.
  It cannot signal itself on workflow_dispatch, and uses a unique concurrency
  group so it never evicts a pending publisher. Actual publication accepts only
  main context: the existing github-pages environment permits main deployments,
  including cleanup for stacked PRs whose base was a feature branch.
  Privileged jobs run only trusted standard-library scripts and pinned actions;
  there is no npm installation or artifact script execution in those jobs.
- API data, not artifact metadata, determines repository, current open PR/head,
  workflow path, event, explicit PR-number/head/repository association,
  successful run and artifact identity. These are rechecked
  immediately before each Ross operation. Stale completions cannot publish over
  a newer head; failed latest builds do not reuse older artifacts as current.
- ZIP extraction rejects absolute/traversal/ambiguous paths, symlinks/special
  modes, Git metadata, reserved preview namespaces and bounded-size violations.
  It strips modes and never executes content. A standard-library HTML parser
  locates actual document tags, ignoring comments/script/style/title/textarea
  text and inert template/noscript fragments; ambiguous/self-closing document
  containers are rejected rather than rewritten. The accepted contract is the
  current Vite document structure (explicit HTML/body and optional implicit
  head); iframe/xmp/noembed/noframes/plaintext containers and malformed document
  nesting fail closed instead of attempting an HTML5 rewrite. Every preview HTML gets noindex
  and a visible non-production banner before Ross receives it. The banner shows
  `PR #N` as a link to that pull request (built only from the validated integer
  and the fixed repository constant, `rel="noopener noreferrer"`), the PR title
  and the short SHA. The title is untrusted free text: it is passed to
  `extract.py` as one argv element (never through a shell), reduced to a single
  line without control characters, capped at 80 characters with an ellipsis and
  HTML-escaped and wrapped in `<bdi>` so right-to-left text cannot reorder
  the rest of the banner; an empty title is omitted. A title edit only appears after the
  next build, because `pages.yml` does not trigger on `edited`.
- Same-repository previews share the site's origin and can execute client-side
  JS in visitors' browsers. This is not a hostile-code sandbox; only authorized
  same-repository contributors are automatically published. No fork publishing,
  deployment tokens or privileged runner execution is granted to PR code.

## Reconciliation, comments and failures

GitHub concurrency can replace pending events. Each trusted publisher therefore
reconciles **all** current open internal PR heads, current main and existing
preview directories, rather than replaying only its triggering event. Even a fork completion may
wake this trusted reconciliation: filtering that last event could discard a
coalesced internal update/cleanup. Fork artifacts remain ineligible. API
pagination and tree inventories fail closed if incomplete. Ross operations are
serialized, with supported explicit `pr-number` and `action: deploy/remove`
inputs; there are no event-context hacks. Reopened PRs are rechecked before
cleanup. An initial publish refuses a previews-only tree without a verified
production artifact/root. Subsequent main failures preserve the existing root.

Each eligible PR has one updated bot comment, including pending/failed/stale
states and build details. Successful links are posted only after the final post-preview
Actions Pages deployment succeeds and stored metadata matches the current PR
head. Success of the earlier production snapshot alone is insufficient: that
snapshot necessarily predates this run's preview updates. Closed/merged cleanup likewise requires the final deployment and verifies
directory absence before claiming removal. The Pages deploy action (JamesIves, pinned) runs
`rsync --delete` with unanchored excludes: `.nojekyll` and `CNAME` (when the
source folder lacks them) and always `.ssh`, `.git` and `.github`. Removing a
preview therefore leaves `pr-preview/pr-N/.nojekyll` behind. Inventory and
cleanup comments count a `pr-preview/pr-N/` directory only when it holds
something other than `.nojekyll`; otherwise every reconcile run would plan a
useless remove job for each closed PR. `extract.py` extracts dot-prefixed paths
never, and rejects any path component named `CNAME` (file or directory, rsync
protects both) in preview artifacts (production is unchanged), so no other protected name can pin a preview. The stage step turns
control characters in the PR title (including NUL) into spaces before calling
`extract.py`, so such a title cannot block a deployment.
Failures can retain a previously verified preview; its old SHA/banner and the
updated comment identify it as stale. Re-running the trusted publisher
reconciles state; no arbitrary input source paths or PR shell text are executed.

## Action source audit

Ross **v1.8.2**, immutable commit
`873417d2df72380da1f3978378fb58560bcde976`, supports the explicit PR/action inputs
and `wait-for-pages-deployment: false`. Its nested JamesIves publisher is pinned
at `4a3abc783e1a24aeb44c16e869ad83caf6b4cc23` (v4.7.4), with `force: false`.
Its optional sticky-comment action is pinned upstream; we disable Ross comments
and QR requests so status is written only after our actual Actions deployment,
using one stable bot marker. The final upload uses the distinct artifact name
`github-pages-previews`, passed to the deployment action through `artifact_name`;
the early upload retains `github-pages`. Both input contracts were checked in
the existing pinned action sources, avoiding duplicate immutable artifact names
within a run. No third-party QR service receives preview URLs.
All new workflow actions are pinned to reviewed commit SHAs; Ross is used as-is,
not vendored or modified.

## Activation and rollback — human approval required

This PR prepares a reviewable pipeline; it does not activate, dispatch, merge or
actually deploy it. The following are explicit maintainer operations:

1. **Before merge**, an authorized maintainer must inspect the repository Actions
   variable and confirm `PAGES_PREVIEWS_ENABLED` is absent/false. If this cannot be
   verified, do not merge or activate. Then review/approve and merge through the
   normal protected main workflow; leave that verified gate inactive. Confirm the ordinary production
   deployment succeeds and the new `pages-site` main artifact is retained.
2. Drain any in-flight legacy Pages writers. Verify current main's successful
   build artifact/root is available; never bootstrap from a PR-only snapshot.
3. Separately approve activation, set repository Actions variable
   `PAGES_PREVIEWS_ENABLED=true`, then dispatch the read-only Pages build on main
   or the trusted reconciliation workflow. No Pages source setting change is
   required; the reconciler refuses a changed Pages mode/domain.
4. Verify production HTTP/assets and two internal PR previews, update both PRs,
   then merge/close each independently and verify only its directory disappears.
   Confirm one comment per PR, latest-head labels, fork exclusion and failure
   status. These are **live checks pending approved activation**; local/CI tests
   are not evidence that live preview publication or cleanup already occurred.
5. Rollback: drain publishers, set the variable false, then manually dispatch the
   normal main build. Its mutually exclusive legacy deployment restores the
   trusted production artifact. Do not change Pages source/settings or delete
   research branches. Retained static storage can be inspected without publishing.

Local tests cover two previews/two updates/independent merge+close plans,
production/other-preview retention, unsafe archives, missing baseline and deep
asset bases. No actual branch publication or deployment is used by those tests.

## Publication-order regression

A production-first deployment followed by Ross storage updates is not enough to
publish the new previews. The observed failure had current `gh-pages` metadata
and a successful early deployment while the public URL still served the older
snapshot. The final `deploy-previews` job therefore waits for the entire matrix,
uses `always()` to permit partial preview failures, and still requires successful
production staging and the early deployment. `!cancelled()` prevents this
additional privileged publication after an operator cancels reconciliation;
ordinary preview failures still permit successful updates to publish.
Notification runs in a separate trusted-main workflow and consumes a bounded,
immutable receipt from the exact publisher run and attempt. Failure of this final deployment reports previews/cleanup as pending
while the already published production site remains available.

`node --test tests/pages-publication.test.mjs tests/pages-workflow.test.mjs tests/pages-policy.test.mjs tests/pages-stage.test.mjs`
replays the actual workflow dependency graph with the real snapshot helper and
executes the actual notification script against a mocked API. It covers fresh
and stale metadata, partial matrix failure, failed early/final deployments, cancellation after early publication,
cleanup, trusted checkouts, and distinct artifact identity. These are Node/static
pipeline regressions, not browser tests or evidence of a new live deployment.
This maintenance change preserves activation gates and does not activate,
dispatch or deploy the workflow; trusted-main behavior changes only after a
human merges the reviewed fix. The initial activation procedure above remains
historical setup guidance for inactive installations.


## Queue bounds and deployment receipts

Read-only build supersession does not cancel this publisher. Ross storage writes
and both publication phases remain under the existing global publication lock.
Exact production build metadata and preview metadata avoid restaging unchanged
artifacts. Empty preview matrices do not allocate a runner. An unchanged tree is
skipped only when the public `.cubistry-publication.json` receipt identifies that
exact Git storage tree and a verified trusted publisher run. A storage write
followed by a failed deployment therefore remains eligible for repair.

The trusted standard-library Node deployment helper keeps the existing official
Pages artifact upload and uses the same REST creation payload and default OIDC
audience as the pinned deploy action. It waits at most ten minutes, including
request time, and reattempts creation only after an explicit HTTP 400 response
that says another named deployment is in progress. It polls that deployment's
supported SHA identity. Network failures, other HTTP errors and ambiguous write
outcomes never replay creation. No deployment is automatically cancelled.

A successful API status alone is insufficient when both phases reuse the same
main SHA: the helper also waits for the public receipt's unique nonce, run,
attempt and storage tree to match the intended snapshot. Public reads use a fixed
HTTPS origin, no credentials or redirects, a cache-busting query, timeouts and a
32 KiB limit. CDN delay fails closed at the deadline. Receipts contain no secrets.
The observed busy-deployment failure and this protection are covered by mocked
API regressions; a new live deployment is not claimed by those tests.

The separate notification workflow validates the publisher repository, workflow
path, main context, event, run, attempt and bounded artifact identity before
reading data. It checks current publisher, live receipt, storage tree, PR head
and label immediately before each comment write. Old receipts cannot qualify a
newer snapshot. Notification has its own serialized group and does not hold the
publication lock. Normal runs inspect only active previews, inventoried storage
and prior receipt candidates. A first-run historical bot-comment scan preserves
old cleanup comments when migrating an installation without a receipt; later
receipts retain only currently relevant preview numbers. Browser code and PR
artifacts are never executed in these privileged jobs.
