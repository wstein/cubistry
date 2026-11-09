// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow = readFileSync(new URL("../.github/workflows/docs-quality.yml", import.meta.url), "utf8");
test("docs-quality supersedes older PR and main-push validation only", () => {
  assert.match(workflow, /group: docs-\$\{\{ github.event.pull_request.number \|\| github.ref \}\}/);
  const condition = workflow.match(/^  cancel-in-progress: \$\{\{ (.*) \}\}$/m)[1];
  const cancel = github => Function("github", `return (${condition});`)(github);
  assert.equal(cancel({ event_name: "pull_request", ref: "refs/pull/7/merge" }), true);
  assert.equal(cancel({ event_name: "push", ref: "refs/heads/main" }), true);
  assert.equal(cancel({ event_name: "push", ref: "refs/heads/topic" }), false);
  assert.equal(cancel({ event_name: "workflow_dispatch", ref: "refs/heads/main" }), false);
  for (const check of ["US English spelling", "Markdown links (local)", "Markdown links (external, advisory)"])
    assert.ok(workflow.includes(`name: ${check}`), check);
});
