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

`PAGES_PREVIEWS_ENABLED` is an **explicit maintainer activation gate**, initially
absent/false. Until separately approved activation, the existing main-only
Actions Pages deployment remains active and no preview storage write/comment
or deployment runs. Read-only PR/main builds may produce artifacts.

After activation, `gh-pages` is a static storage branch, not a second Pages
publishing source. Ross writes `pr-preview/pr-N/`; the pinned JamesIves action
updates production root with `force: false` and `clean-exclude: pr-preview/`.
One Actions Pages deployment publishes the complete validated tree. The old and
new deployers have mutually exclusive gate conditions and share the same global
publication concurrency group. There is no competing branch-source deployment,
Pages settings migration, force push or protected research change.

## Security boundary and event handling

- `pull_request` opened/reopened/synchronize builds check out the exact head,
  use contents-read only, do not persist credentials and have no publishing
  secrets or write permissions. Fork builds are excluded from this preview path.
- Trusted `workflow_run` completion and closed/merged `pull_request_target`
  cleanup check out **main only**. The latter never builds/checks out PR code.
  Privileged jobs run only trusted standard-library scripts and pinned actions;
  there is no npm installation or artifact script execution in those jobs.
- API data, not artifact metadata, determines repository, current open PR/head,
  workflow path, event, explicit PR-number/head/repository association,
  successful run and artifact identity. These are rechecked
  immediately before each Ross operation. Stale completions cannot publish over
  a newer head; failed latest builds do not reuse older artifacts as current.
- ZIP extraction rejects absolute/traversal/ambiguous paths, symlinks/special
  modes, Git metadata, reserved preview namespaces and bounded-size violations.
  It strips modes and never executes content. Every preview HTML gets noindex
  and a visible non-production PR/SHA banner before Ross receives it.
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
states and build details. Successful links are posted only after the single
Actions Pages deployment succeeds and stored metadata matches the current PR
head. Closed/merged cleanup verifies directory absence before claiming removal.
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
using one stable bot marker. No third-party QR service receives preview URLs.
All new workflow actions are pinned to reviewed commit SHAs; Ross is used as-is,
not vendored or modified.

## Activation and rollback — human approval required

This PR prepares a reviewable pipeline; it does not activate, dispatch, merge or
actually deploy it. The following are explicit maintainer operations:

1. Review/approve the PR and merge through the normal protected main workflow.
   Leave `PAGES_PREVIEWS_ENABLED` absent/false. Confirm the ordinary production
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
