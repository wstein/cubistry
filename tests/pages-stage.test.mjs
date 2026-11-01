import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const sha = "a".repeat(40),
  repository = { id: 100, full_name: "wstein/cubistry" };
const pr = { state: "open", head: { sha, repo: repository } };
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

// Runs the real deploy path (mocked API) with the real extract.py in a scratch cwd.
function deploy(title) {
  const dir = mkdtempSync(join(tmpdir(), "pages-deploy-"));
  try {
    mkdirSync(join(dir, "scripts/pages"), { recursive: true });
    copyFileSync(
      resolve("scripts/pages/extract.py"),
      join(dir, "scripts/pages/extract.py"),
    );
    execFileSync("python3", [
      "-c",
      "import zipfile,sys;zipfile.ZipFile(sys.argv[1],'w').writestr('index.html','<html><head></head><body>site</body></html>')",
      join(dir, "fixture.zip"),
    ]);
    const responses = {
      "pulls/1": { ...pr, title },
      "actions/runs/99": run(1),
      "actions/runs/99/artifacts?per_page=100&page=1": {
        artifacts: [
          {
            id: 5,
            name: "pages-site",
            expired: false,
            size_in_bytes: 100,
            workflow_run: { id: 99 },
          },
        ],
      },
    };
    writeFileSync(
      join(dir, "mock.mjs"),
      `import{readFileSync}from'node:fs';const responses=${JSON.stringify(responses)};globalThis.fetch=async url=>{const path=String(url).split('/repos/wstein/cubistry/')[1];if(path==='actions/artifacts/5/zip')return new Response(readFileSync(${JSON.stringify(join(dir, "fixture.zip"))}));if(!(path in responses))throw Error('Unexpected API access: '+path);return new Response(JSON.stringify(responses[path]),{status:200,headers:{'Content-Type':'application/json'}});};`,
    );
    execFileSync(
      process.execPath,
      ["--import", join(dir, "mock.mjs"), resolve("scripts/pages/stage.mjs")],
      {
        cwd: dir,
        env: {
          ...process.env,
          GH_TOKEN: "unit-test-only",
          ENTRY: JSON.stringify({ number: 1, sha, run: 99, action: "deploy" }),
          GITHUB_OUTPUT: join(dir, "output"),
        },
        stdio: "pipe",
      },
    );
    return {
      output: readFileSync(join(dir, "output"), "utf8"),
      banner: readFileSync(join(dir, "artifact-site/index.html"), "utf8").match(
        /<aside[^>]*>(.*)<\/aside>/s,
      )?.[1],
      files: ["PWNED", "PWNED2"].filter((f) => existsSync(join(dir, f))),
      dir,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("deploy hands a hostile PR title to extract.py as one inert argv element in the title slot", () => {
  const title = `x $(touch PWNED) \`touch PWNED2\` ; "q" </aside><script>\nnext`;
  const r = deploy(title);
  assert.equal(r.output, "action=deploy\n");
  assert.deepEqual(r.files, [], "title must never be shell-interpreted");
  assert.match(
    r.banner,
    / · x \$\(touch PWNED\) `touch PWNED2` ; &quot;q&quot; &lt;\/aside&gt;&lt;script&gt; next — non-production preview · a{12}$/,
  );
  assert.doesNotMatch(r.banner, /<script/);
});
test("deploy survives control characters such as NUL in the PR title", () => {
  const r = deploy("fix\u0000the\u0007thing\u001b[0m");
  assert.equal(r.output, "action=deploy\n");
  assert.match(r.banner, / · fix the thing \[0m — non-production/);
  assert.equal(deploy(null).output, "action=deploy\n");
  assert.match(deploy(null).banner, /<\/a> — non-production preview/);
});
