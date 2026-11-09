import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const repository = { id: 100, full_name: "wstein/cubistry" };
const sha = (c) => c.repeat(40);
const pull = (number, c, labels) => ({
  number,
  state: "open",
  labels,
  head: { sha: sha(c), repo: repository },
  base: { repo: repository },
});
const build = (number, c) => ({
  id: 90 + number,
  head_sha: sha(c),
  event: "pull_request",
  path: ".github/workflows/pages.yml",
  repository,
  head_repository: repository,
  pull_requests: [
    {
      number,
      head: { sha: sha(c), repo: repository },
      base: { repo: repository },
    },
  ],
  status: "completed",
  conclusion: "success",
});
const blob = (path) => ({ path, type: "blob" });
const runs = (head) =>
  `actions/workflows/pages.yml/runs?${head}&per_page=100&page=1`;
// Runs the real plan.mjs against a mocked API; an unmocked path throws.
function planned() {
  const dir = mkdtempSync(join(tmpdir(), "pages-plan-"));
  try {
    const responses = {
      pages: {
        build_type: "workflow",
        html_url: "https://wstein.github.io/cubistry/",
        cname: null,
      },
      "pulls?state=open&per_page=100&page=1": [
        pull(1, "a", [{ name: "preview" }]),
        pull(2, "b", [{ name: "e2e" }]),
      ],
      "commits/main": { sha: sha("c") },
      "contents/.cubistry-production.json?ref=gh-pages": null,
      "contents/pr-preview/pr-1/preview-info.json?ref=gh-pages": null,
      "pulls?state=all&per_page=100&page=1": [],
      "git/trees/gh-pages?recursive=1": {
        truncated: false,
        tree: [
          blob("index.html"),
          blob("pr-preview/pr-5/index.html"),
          blob("pr-preview/pr-6/.nojekyll"),
        ],
      },
      [runs(`event=pull_request&head_sha=${sha("a")}`)]: {
        workflow_runs: [build(1, "a")],
      },
      [runs(`head_sha=${sha("c")}`)]: { workflow_runs: [] },
    };
    writeFileSync(
      join(dir, "mock.mjs"),
      `const responses=${JSON.stringify(responses)};globalThis.fetch=async url=>{if(String(url).startsWith('https://wstein.github.io/'))return new Response('',{status:404});const path=String(url).split('/repos/wstein/cubistry/')[1];if(!(path in responses))throw Error('Unexpected API access: '+path);return new Response(JSON.stringify(responses[path]),{status:200,headers:{'Content-Type':'application/json'}});};`,
    );
    execFileSync(
      process.execPath,
      ["--import", join(dir, "mock.mjs"), resolve("scripts/pages/plan.mjs")],
      {
        cwd: dir,
        env: {
          ...process.env,
          GH_TOKEN: "unit-test-only",
          GITHUB_OUTPUT: join(dir, "output"),
        },
        stdio: "pipe",
      },
    );
    return JSON.parse(readFileSync(join(dir, "pages-plan.json"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("plan.mjs removes inventoried previews, skips .nojekyll leftovers and fetches builds only for labeled PRs", () => {
  assert.deepEqual(
    planned().entries.map((x) => [x.number, x.action]),
    [
      [1, "deploy"],
      [5, "remove"],
    ],
  );
});
