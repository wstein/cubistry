// SPDX-License-Identifier: AGPL-3.0-or-later
// Static checks of .github/workflows/window-chain.yml (the workflow is manual and cannot run in CI).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const wf = readFileSync(new URL("../.github/workflows/window-chain.yml", import.meta.url), "utf8");
const jobs = wf.split(/^jobs:\n/m)[1];
const job = name => (jobs.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z-]+:\\n|(?![\\s\\S]))`, "m")) ?? [])[1] ?? "";

test("only a manual dispatch starts it and it has no write permission", () => {
  assert.match(wf, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(wf, /^  (push|pull_request|schedule|workflow_run):/m);
  assert.match(wf, /^permissions:\n  contents: read\n(  #.*\n)?  actions: read\n/m);
  assert.doesNotMatch(wf, /(contents|actions|pull-requests|issues|packages|id-token): write/);
});
test("every action is pinned to a full commit SHA", () => {
  const uses = [...wf.matchAll(/^\s+- uses: (\S+)/gm)].map(m => m[1]);
  assert.ok(uses.length >= 10, `found ${uses.length} actions`);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, u);
});
test("the run is serialized and every job stays within the 6 h limit", () => {
  assert.match(wf, /^concurrency:\n  group: window-chain\n  cancel-in-progress: false\n/m);
  for (const j of ["prepare", "produce", "verify"]) {
    const t = Number(job(j).match(/^    timeout-minutes: (\d+)$/m)?.[1]);
    assert.ok(t > 0 && t <= 345, `${j} timeout ${t}`);
  }
  assert.match(job("produce"), /timeout 285m julia/);
  assert.match(job("produce"), /GENERATE_DEADLINE_S: "14400"/);
});
test("inputs are validated before any research code runs", () => {
  assert.match(wf, /\^\[0-9a-f\]\{40\}\$.*research_ref must be a 40-digit/);
  assert.match(wf, /\^\[0-9a-f\]\{64\}\$.*print_sha256/);
  for (const name of ["research_ref", "start", "end", "print_path", "print_sha256", "print_window_end", "claims_path", "library", "width", "lambda", "prior_run_id", "smoke_mode"])
    assert.match(wf, new RegExp(`^      ${name}:\\n`, "m"), name);
  assert.match(wf, /print_path is not a plain repository path/);
  assert.match(wf, /sha256sum --check --strict/);
});
test("produce uses the beam chain producer and verify uses all three checkers with identical receipts", () => {
  assert.match(job("produce"), /window_chain\.jl/);
  assert.match(job("verify"), /run_checks\.sh/);
  assert.match(job("verify"), /cmp "\$out\/julia\.tsv" "\$out\/flix\.tsv"/);
  assert.match(job("verify"), /independent-verdict.*ACCEPT_CHAIN/);
  assert.match(job("verify"), /actions\/upload-artifact@[0-9a-f]{40}[\s\S]*name: wc-chain-/);
  assert.match(job("verify"), /needs: \[prepare, produce\]|^    needs: \[prepare, produce\]/m);
});
test("a prior run is continued only from a verified artifact of a manual run on main", () => {
  assert.match(wf, /REQUIRED_PRIOR_EVENT: workflow_dispatch/);
  assert.match(wf, /REQUIRED_PRIOR_BRANCH: main/);
  assert.match(wf, /pattern: wc-chain-\*/);
  assert.match(job("produce"), /sha256sum --check --strict/);
  assert.match(job("produce"), /VERIFIED\.txt/);
});
test("it never commits, pushes, tags, comments or dispatches", () => {
  assert.doesNotMatch(wf, /git (commit|push|tag)\b|gh (pr|issue|release|workflow)\b|submodule/);
});
