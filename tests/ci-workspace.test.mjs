// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, symlinkSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../scripts/ci/align-workspace.sh", import.meta.url));
test("all four container jobs align workspace ownership immediately after checkout", () => {
  let jobs = 0;
  for (const workflow of ["counter.yml", "counter-browser.yml", "pages.yml"]) {
    const source = readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    for (const job of source.split(/(?=^  [a-z][a-z0-9-]*:\n)/m).filter(x => x.includes("    container:\n"))) {
      jobs++;
      const checkout = job.indexOf("uses: actions/checkout@"), align = job.indexOf("uses: ./.github/actions/container-workspace");
      assert.ok(align > checkout, "ownership is aligned after checkout");
      assert.ok(align < job.indexOf("run: npm run prepare:solver"), "alignment precedes all repository Git work");
    }
  }
  assert.equal(jobs, 4);
});
test("workspace alignment preserves Git's guard and quotes the exact workspace path", () => {
  assert.ok(existsSync(script), "the workspace alignment script exists");
  const source = readFileSync(script, "utf8");
  assert.match(source, /chown -hR -- "\$job_owner" "\$workspace"/);
  assert.doesNotMatch(source, /git config|safe\.directory|GIT_CONFIG|GIT_TEST_/);
  const root = mkdtempSync(join(tmpdir(), "cubistry ownership "));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    assert.match(execFileSync("bash", [script], { env: { ...process.env, GITHUB_WORKSPACE: root }, encoding: "utf8" }), /true/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("empty, root, traversal and symlink workspaces fail before recursive ownership changes", () => {
  assert.ok(existsSync(script));
  const root = mkdtempSync(join(tmpdir(), "cubistry ownership invalid "));
  try {
    mkdirSync(join(root, "repo")); mkdirSync(join(root, "repo", ".git"));
    symlinkSync(join(root, "repo"), join(root, "link"));
    for (const workspace of ["", "/", `${root}/repo/../repo`, join(root, "link")]) {
      const result = spawnSync("bash", [script], { env: { ...process.env, GITHUB_WORKSPACE: workspace }, encoding: "utf8" });
      assert.notEqual(result.status, 0, workspace);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("the root workspace is rejected by its own guard, not by a missing .git", () => {
  const root = mkdtempSync(join(tmpdir(), "cubistry ownership root "));
  try {
    mkdirSync(join(root, "bin"));
    const marker = join(root, "chown-called");
    writeFileSync(join(root, "bin", "chown"), `#!/bin/sh\necho "$@" >> '${marker}'\n`, { mode: 0o755 });
    // Drop the .git checks so that only the root guard can stop the script; chown is a recording stub.
    const guarded = readFileSync(script, "utf8").split("\n").filter(line => !line.includes("/.git")).join("\n");
    writeFileSync(join(root, "align.sh"), guarded);
    const run = workspace => spawnSync("bash", [join(root, "align.sh")], { env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, GITHUB_WORKSPACE: workspace }, encoding: "utf8" });
    assert.notEqual(run("/").status, 0);
    assert.equal(existsSync(marker), false, "chown never ran for the root workspace");
    const ok = join(root, "ok"); mkdirSync(ok);
    run(ok);
    assert.equal(existsSync(marker), true, "the stubbed script reaches chown for a valid workspace");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
