import test from "node:test";
import assert from "node:assert/strict";
import {
  plan,
  validRun,
  selectBuild,
  previewPath,
  REPOSITORY,
  PREVIEW_LABEL,
} from "../scripts/pages/policy.mjs";
const sha = (n) => String(n).padStart(40, "a");
const pr = (n, s) => ({
  number: n,
  state: "open",
  labels: [{ name: PREVIEW_LABEL }],
  head: { sha: s, repo: { full_name: REPOSITORY } },
  base: { repo: { full_name: REPOSITORY } },
});
const run = (
  id,
  s,
  event = "pull_request",
  conclusion = "success",
  number = id,
) => ({
  id,
  head_sha: s,
  event,
  path: ".github/workflows/pages.yml",
  repository: { full_name: REPOSITORY, id: 100 },
  head_repository: { full_name: REPOSITORY },
  pull_requests: [
    {
      number,
      head: { sha: s, repo: { id: 100 } },
      base: { repo: { id: 100 } },
    },
  ],
  head_branch: "main",
  status: "completed",
  conclusion,
});
test("Ross reconciliation preserves two previews across two updates then independently merges/closes them", () => {
  const first = plan({
    pulls: [pr(1, sha(1)), pr(2, sha(2))],
    inventory: [],
    builds: { 1: [run(1, sha(1))], 2: [run(2, sha(2))] },
    main: { sha: sha(9), runs: [run(9, sha(9), "push")] },
  });
  assert.deepEqual(
    first.entries.map((x) => [x.number, x.action]),
    [
      [1, "deploy"],
      [2, "deploy"],
    ],
  );
  const updated = plan({
    pulls: [pr(1, sha(3)), pr(2, sha(4))],
    inventory: [1, 2],
    builds: {
      1: [run(3, sha(3), "pull_request", "success", 1), run(1, sha(1))],
      2: [run(4, sha(4), "pull_request", "success", 2), run(2, sha(2))],
    },
    main: { sha: sha(9), runs: [] },
  });
  assert.deepEqual(
    updated.entries.map((x) => x.sha),
    [sha(3), sha(4)],
  );
  const merged = plan({
    pulls: [pr(2, sha(4))],
    inventory: [1, 2],
    builds: { 2: [run(4, sha(4), "pull_request", "success", 2)] },
    main: { sha: sha(10), runs: [run(10, sha(10), "push")] },
  });
  assert.deepEqual(
    merged.entries.map((x) => [x.number, x.action]),
    [
      [2, "deploy"],
      [1, "remove"],
    ],
  );
  const closed = plan({
    pulls: [],
    inventory: [2],
    builds: {},
    main: { sha: sha(10), runs: [] },
  });
  assert.equal(closed.entries[0].action, "remove");
});
test("forks, stale completions and failed latest reruns never gain authority", () => {
  const fork = pr(1, sha(1));
  fork.head.repo.full_name = "other/fork";
  assert.equal(
    plan({
      pulls: [fork],
      inventory: [1],
      builds: { 1: [run(1, sha(1))] },
      main: { sha: sha(9), runs: [] },
    }).entries[0].action,
    "remove",
  );
  assert.equal(
    selectBuild([run(1, sha(1))], sha(2), "pull_request", 1).status,
    "pending",
  );
  assert.equal(
    selectBuild(
      [run(2, sha(1), "pull_request", "failure", 1), run(1, sha(1))],
      sha(1),
      "pull_request",
      1,
    ).status,
    "failed",
  );
  assert.equal(
    validRun(
      { ...run(1, sha(1)), path: ".github/workflows/evil.yml" },
      sha(1),
      "pull_request",
      1,
    ),
    false,
  );
  assert.equal(
    validRun(
      { ...run(1, sha(1)), head_repository: { full_name: "other/fork" } },
      sha(1),
      "pull_request",
      1,
    ),
    false,
  );
  assert.throws(() => previewPath("1"));
  assert.throws(() => previewPath(-1));
});
test("same SHA on different PRs cannot select or stage the other PR's deep-base artifact", () => {
  const intended = run(1, sha(1)),
    other = run(99, sha(1), "pull_request", "success", 2);
  assert.equal(
    selectBuild([other, intended], sha(1), "pull_request", 1).run,
    1,
  );
  assert.equal(validRun(other, sha(1), "pull_request", 1), false);
  assert.equal(
    validRun({ ...intended, pull_requests: [] }, sha(1), "pull_request", 1),
    false,
  );
  assert.equal(
    validRun(
      {
        ...intended,
        pull_requests: [
          {
            number: 1,
            head: { sha: sha(1), repo: { id: 200 } },
            base: { repo: { id: 100 } },
          },
        ],
      },
      sha(1),
      "pull_request",
      1,
    ),
    false,
  );
});

test("coalesced close followed by a fork completion still reconciles every internal preview", () => {
  const fork = pr(8, sha(8));
  fork.head.repo.full_name = "other/fork";
  const output = plan({
    pulls: [pr(2, sha(2)), fork],
    inventory: [1, 2],
    builds: {
      2: [run(2, sha(2))],
      8: [{ ...run(8, sha(8)), head_repository: { full_name: "other/fork" } }],
    },
    main: { sha: sha(9), runs: [] },
  });
  assert.deepEqual(
    output.entries.map((x) => [x.number, x.action]),
    [
      [2, "deploy"],
      [1, "remove"],
    ],
  );
});
test("only open internal PRs that carry the preview label get a preview; unlabeled ones are removed", () => {
  const unlabeled = { ...pr(1, sha(1)), labels: [{ name: "e2e" }] };
  const noLabels = { ...pr(3, sha(3)) };
  delete noLabels.labels;
  const output = plan({
    pulls: [unlabeled, pr(2, sha(2)), noLabels],
    inventory: [1, 2, 3],
    builds: { 1: [run(1, sha(1))], 2: [run(2, sha(2))], 3: [run(3, sha(3))] },
    main: { sha: sha(9), runs: [] },
  });
  assert.deepEqual(
    output.entries.map((x) => [x.number, x.action]),
    [
      [2, "deploy"],
      [1, "remove"],
      [3, "remove"],
    ],
  );
  assert.equal(PREVIEW_LABEL, "preview");
});
