import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const sha = "a".repeat(40),
  repository = { id: 100, full_name: "wstein/cubistry" };
const pr = {
  state: "open",
  labels: [{ name: "preview" }],
  head: { sha, repo: repository },
};
const run = (number) => ({
  id: 99,
  head_sha: sha,
  event: "pull_request",
  path: ".github/workflows/pages.yml",
  repository,
  head_repository: repository,
  pull_requests: [
    { number, head: { sha, repo: repository }, base: { repo: repository } },
  ],
  status: "completed",
  conclusion: "success",
});
function stage(p, r, action = "deploy") {
  const dir = mkdtempSync(join(tmpdir(), "pages-stage-"));
  try {
    const responses = { "pulls/1": p, "actions/runs/99": r };
    writeFileSync(
      join(dir, "mock.mjs"),
      `const responses=${JSON.stringify(responses)};globalThis.fetch=async url=>{const path=String(url).split('/repos/wstein/cubistry/')[1];if(!(path in responses))throw Error('Unexpected API access: '+path);return new Response(JSON.stringify(responses[path]),{status:200,headers:{'Content-Type':'application/json'}});};`,
    );
    execFileSync(
      process.execPath,
      ["--import", join(dir, "mock.mjs"), resolve("scripts/pages/stage.mjs")],
      {
        env: {
          ...process.env,
          GH_TOKEN: "unit-test-only",
          ENTRY: JSON.stringify({ number: 1, sha, run: 99, action }),
          GITHUB_OUTPUT: join(dir, "output"),
        },
        stdio: "pipe",
      },
    );
    return readFileSync(join(dir, "output"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("stage independently rejects a newer other-PR artifact with the same SHA before download", () => {
  assert.equal(stage(pr, run(2)), "action=none\n");
  assert.equal(stage(pr, { ...run(1), pull_requests: [] }), "action=none\n");
  assert.equal(
    stage({ ...pr, head: { ...pr.head, sha: "b".repeat(40) } }, run(1)),
    "action=none\n",
  );
});
test("closed cleanup rechecks reopened PRs rather than deleting their preview", () => {
  assert.equal(stage(pr, null, "remove"), "action=none\n");
  assert.equal(
    stage({ ...pr, state: "closed" }, null, "remove"),
    "action=remove\n",
  );
});
test("stage removes a preview whose PR lost the label and never deploys an unlabeled PR", () => {
  const unlabeled = { ...pr, labels: [{ name: "e2e" }] };
  assert.equal(stage(unlabeled, null, "remove"), "action=remove\n");
  assert.equal(stage(unlabeled, run(1)), "action=none\n");
  assert.equal(stage(pr, null, "remove"), "action=none\n");
});
