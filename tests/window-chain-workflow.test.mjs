// SPDX-License-Identifier: AGPL-3.0-or-later
// Static checks of .github/workflows/window-chain.yml (the workflow is manual and cannot run in CI).
// The workflow is parsed into jobs and steps (no YAML library in the repo); the security gates are pinned line by line,
// because a gate that is weakened to `true` must fail a test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const text = readFileSync(new URL("../.github/workflows/window-chain.yml", import.meta.url), "utf8");
const lines = text.split("\n");

// Minimal parser for the subset this workflow uses: jobs -> keys, env maps, steps (name, uses, if, env, with, run).
function parseJobs() {
  const start = lines.indexOf("jobs:");
  assert.ok(start > 0, "jobs section");
  const jobs = {};
  let job = null, step = null, block = null, map = null;
  for (const line of lines.slice(start + 1)) {
    let m;
    if ((m = line.match(/^  ([a-z-]+):$/))) { job = jobs[m[1]] = { env: {}, steps: [], needs: "" }; step = block = map = null; continue; }
    if (!job) continue;
    if (block && (line === "" || line.startsWith(" ".repeat(block.indent)))) { block.step.run += line.slice(block.indent) + "\n"; continue; }
    block = null;
    if ((m = line.match(/^    ([a-z-]+): (.*)$/))) { job[m[1]] = m[2]; map = null; step = null; continue; }
    if (line === "    env:") { map = job.env; continue; }
    if ((m = line.match(/^      - (name|uses): (.*)$/))) { step = { env: {}, with: {}, run: "", index: job.steps.length }; step[m[1]] = m[2]; job.steps.push(step); map = null; continue; }
    if (!step) { if (map && (m = line.match(/^      ([A-Za-z_]+): (.*)$/))) map[m[1]] = m[2]; continue; }
    if ((m = line.match(/^        (env|with):$/))) { map = step[m[1]]; continue; }
    if ((m = line.match(/^        run: \|$/))) { block = { step, indent: 10 }; map = null; continue; }
    if ((m = line.match(/^        (name|uses|if): (.*)$/))) { step[m[1]] = m[2]; map = null; continue; }
    if (map && (m = line.match(/^          ([A-Za-z_]+): (.*)$/))) map[m[1]] = m[2];
  }
  return jobs;
}
const jobs = parseJobs();
const step = (j, name) => { const s = jobs[j].steps.find(x => x.name === name); assert.ok(s, `${j}: step ${name}`); return s; };
const runLines = s => s.run.split("\n").map(l => l.trim());
const GATES = {
 "validate": [
  "[[ \"$IN_REF\" =~ ^[0-9a-f]{40}$ ]] || fail \"research_ref must be a 40-digit lowercase hex commit SHA\"",
  "[[ \"$IN_START\" =~ $ym && \"$IN_END\" =~ $ym && \"$IN_WINDOW_END\" =~ $ym ]] || fail \"start, end and print_window_end must be YYYY-MM (2000-2099)\"",
  "[[ \"$IN_START\" < \"2026-06\" ]] || fail \"start must be 2026-05 or earlier: the chain root is May 2026\"",
  "[[ \"$IN_END\" > \"2026-05\" ]] || fail \"end must be after 2026-05\"",
  "[[ \"$IN_PRINT_PATH\" =~ $path ]] && [[ \"$IN_PRINT_PATH\" != *..* ]] || fail \"print_path is not a plain repository path\"",
  "[ -z \"$IN_CLAIMS\" ] || { [[ \"$IN_CLAIMS\" =~ $path ]] && [[ \"$IN_CLAIMS\" != *..* ]]; } || fail \"claims_path is not a plain repository path\"",
  "[[ \"$IN_PRINT_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"print_sha256 must be 64 lowercase hex digits\"",
  "[[ \"$IN_LIBRARY\" =~ ^L[145]$ ]] || fail \"library must be L1, L4 or L5\"",
  "[[ \"$IN_WIDTH\" =~ ^[1-9][0-9]{0,2}$ ]] && [ \"$IN_WIDTH\" -le 200 ] || fail \"width must be 1-200\"",
  "[[ \"$IN_LAMBDA\" =~ ^([1-9]|10)$ ]] || fail \"lambda must be 1-10\"",
  "[ -z \"$IN_PRIOR\" ] || [[ \"$IN_PRIOR\" =~ ^[0-9]{1,20}$ ]] || fail \"prior_run_id must be digits\"",
  "[ \"$IN_END\" != 2028-01 ] && [ \"$IN_WINDOW_END\" != 2028-01 ] || fail \"end and print_window_end must not be 2028-01 (new immutable print pin needed)\"",
  "ym='^20[0-9]{2}-(0[1-9]|1[0-2])$'",
  "path='^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$'",
  "if [ \"$IN_SMOKE\" = \"true\" ]; then max=3; prior=\"\"; fi",
  "max=100000; prior=$IN_PRIOR"
 ],
 "prior": [
  "IFS=$'\\t' read -r path conclusion event branch < <(gh api \"repos/$GITHUB_REPOSITORY/actions/runs/$PRIOR\" --jq '[.path, .conclusion, .event, .head_branch] | @tsv')",
  "[ \"${path%%@*}\" = \"$WORKFLOW_PATH\" ] || fail \"run $PRIOR is not a run of $WORKFLOW_PATH ($path)\"",
  "[ \"$event\" = \"$REQUIRED_PRIOR_EVENT\" ] || fail \"run $PRIOR was started by '$event', not '$REQUIRED_PRIOR_EVENT'\"",
  "[ \"$branch\" = \"$REQUIRED_PRIOR_BRANCH\" ] || fail \"run $PRIOR ran from branch '$branch', not '$REQUIRED_PRIOR_BRANCH'\"",
  "[ \"$n\" -ge 1 ] || fail \"run $PRIOR ($conclusion) has no unexpired verified chain artifact\""
 ],
 "research": [
  "git fetch --no-tags --depth=1 origin \"$SHA\" || fail \"commit $SHA is not fetchable from $GITHUB_REPOSITORY\"",
  "[ \"$(git rev-parse --verify \"$SHA^{commit}\")\" = \"$SHA\" ] || fail \"research_ref does not resolve to itself\"",
  "[ \"$missing\" = 0 ] || fail \"research commit lacks required files\""
 ],
 "produce": [
  "echo \"$PRINT_SHA  src/$PRINT_PATH\" | sha256sum --check --strict",
  "(cd \"$d\" && sha256sum --check --strict SHA256SUMS >/dev/null) || { echo \"::error::checksum failure in $d\"; exit 1; }",
  "[ -n \"$best\" ] || { echo \"::error::no verified chain artifact found to continue\"; exit 1; }",
  "grep -qx \"print_sha256=$PRINT_SHA\" \"$best/VERIFIED.txt\" || { echo \"::error::the prior chain was produced with another print\"; exit 1; }",
  "timeout 285m julia --startup-file=no --threads=4 \"src/$WC/window_chain.jl\" \"$out\" \"src/$PRINT_PATH\" \"${args[@]}\" 2>&1 | tee \"$GITHUB_WORKSPACE/out/run.log\"",
  "if [ \"$rc\" = 3 ]; then echo \"::error::no new edge: the deadline passed or the search stalled before the first edge of this run (exit 3); nothing to verify or continue from\"; exit 3; fi",
  "[ \"$rc\" = 0 ] || { echo \"::error::producer exited with $rc (124 = timeout)\"; exit \"$rc\"; }"
 ],
 "verify": [
  "[ -n \"$chain_end\" ] && [ -n \"$edges_total\" ] && [ -n \"$complete\" ] || { echo \"::error::PROGRESS.txt is incomplete\"; exit 1; }",
  "[ \"$edges_total\" -ge 1 ] || { echo \"::error::no edge to verify\"; exit 1; }",
  "[ \"$chain_end\" != 2028-01 ] || { echo \"::error::a chain ending at 2028-01 is checked without the print digest; the producer must not stop there\"; exit 1; }",
  "export WINDOW_END=$chain_end CAL7_WINDOW_PRINT_SHA=$PRINT_SHA",
  "cmp \"$out/julia.tsv\" \"$out/flix.tsv\" || { echo \"::error::Julia and Flix receipts differ\"; exit 1; }",
  "grep -qx $'verdict\\tSAT\\tlegal-retained-state-window-chain\\t'\"$((edges_total + 1))\"$'\\t'\"$edges_total\" \"$out/julia.tsv\" || { echo \"::error::Julia verdict line is not the exact SAT line for $edges_total edges\"; exit 1; }",
  "grep -q $'^independent-verdict\\tACCEPT_CHAIN\\t'\"$((edges_total + 1))\"$'\\t'\"$edges_total\"$'\\t' \"$out/independent.tsv\" || { echo \"::error::independent verdict differs ($edges_total edges)\"; exit 1; }",
  "[ \"$lines\" = \"$edges_total\" ] || { echo \"::error::chain has $lines edges, PROGRESS.txt says $edges_total\"; exit 1; }",
  "[ \"$greedy\" = \"$(sed -n 's/^greedy_edges=\\([0-9]\\{1,\\}\\)$/\\1/p' \"$c/PROGRESS.txt\")\" ] || { echo \"::error::greedy edge count of PROGRESS.txt differs from edges.tsv\"; exit 1; }",
  "[ \"$(awk 'NR>1' \"$c/edges.tsv\" | wc -l)\" = \"$edges_total\" ] || { echo \"::error::edges.tsv does not list $edges_total edges\"; exit 1; }",
  "[ \"$greedy\" = 0 ] || echo \"::warning::$greedy of $edges_total edges used the greedy fallback (300-400 HTM per edge)\"",
  "greedy=$(awk -F'\\t' 'NR>1 && $4==\"greedy\"' \"$c/edges.tsv\" | wc -l)",
  "echo \"$PRINT_SHA  src/$PRINT_PATH\" | sha256sum --check --strict",
  "lines=$(grep -c $'^edge\\t' \"$c/chain.moves.tsv\")"
 ]
};
const jobLines = j => new Set(jobs[j].steps.flatMap(s => runLines(s)));
const requireJobLines = (j, list) => { const have = jobLines(j); for (const l of list) assert.ok(have.has(l), `${j}: missing gate line: ${l}`); };
const requireLines = (s, list) => { const have = new Set(runLines(s)); for (const l of list) assert.ok(have.has(l), `missing gate line: ${l}`); };

test("workflow shape: three jobs, manual trigger only, read-only permissions", () => {
  assert.deepEqual(Object.keys(jobs), ["prepare", "produce", "verify"]);
  const head = text.split("\njobs:")[0];
  assert.match(head, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(head, /^  (push|pull_request|pull_request_target|schedule|workflow_run|workflow_call):/m);
  assert.match(head, /^permissions:\n  contents: read\n(  #.*\n)*  actions: read\n\n/m);
  assert.doesNotMatch(text, /(contents|actions|pull-requests|issues|packages|id-token|checks|statuses|deployments): write/);
  assert.equal(jobs.produce.needs, "[prepare]");
  assert.equal(jobs.verify.needs, "[prepare, produce]");
});
test("every action is pinned to a full commit SHA", () => {
  const uses = Object.values(jobs).flatMap(j => j.steps).map(s => s.uses).filter(Boolean);
  assert.ok(uses.length >= 10, `found ${uses.length} actions`);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}( #.*)?$/, u);
});
test("serialized, and every job stays within the 6 h limit", () => {
  assert.match(text, /^concurrency:\n  group: window-chain\n  cancel-in-progress: false\n/m);
  for (const [name, j] of Object.entries(jobs)) { const t = Number(j["timeout-minutes"]); assert.ok(t > 0 && t <= 345, `${name} timeout ${t}`); }
  assert.equal(jobs.produce.env.GENERATE_DEADLINE_S, '"14400"');
  assert.ok(runLines(step("produce", "Produce edges")).some(l => l.startsWith("timeout 285m julia")));
});
test("no workflow expression inside any run block (script injection)", () => {
  for (const [name, j] of Object.entries(jobs)) for (const s of j.steps) assert.doesNotMatch(s.run, /\$\{\{/, `${name}/${s.name ?? s.uses}: expression in run`);
  assert.doesNotMatch(text, /^\s+run: [^|]/m, "run blocks use the | form only");
});
test("every input reaches the scripts through env, with the exact mapping", () => {
  const v = step("prepare", "Validate inputs").env;
  const want = { IN_REF: "research_ref", IN_START: "start", IN_END: "end", IN_PRINT_PATH: "print_path", IN_PRINT_SHA: "print_sha256", IN_WINDOW_END: "print_window_end", IN_CLAIMS: "claims_path", IN_LIBRARY: "library", IN_WIDTH: "width", IN_LAMBDA: "lambda", IN_PRIOR: "prior_run_id", IN_SMOKE: "smoke_mode" };
  assert.deepEqual(Object.keys(v).sort(), Object.keys(want).sort());
  for (const [k, input] of Object.entries(want)) assert.equal(v[k], `\${{ inputs.${input} }}`, k);
  const inputsDeclared = [...text.matchAll(/^      ([a-z_0-9]+):\n        description:/gm)].map(m => m[1]).sort();
  assert.deepEqual(inputsDeclared, [...Object.values(want), "fail_on_greedy"].sort());
  assert.equal(jobs.verify.env.FAIL_ON_GREEDY, "${{ inputs.fail_on_greedy }}");
  assert.equal(jobs.produce.env.SHA, "${{ inputs.research_ref }}");
  assert.equal(jobs.verify.env.SHA, "${{ inputs.research_ref }}");
  assert.equal(jobs.verify.env.PRINT_SHA, "${{ inputs.print_sha256 }}");
  assert.equal(jobs.produce.env.PRINT_SHA, "${{ inputs.print_sha256 }}");
});
test("prepare validates every input before any research code runs", () => {
  requireLines(step("prepare", "Validate inputs"), GATES.validate);
  const checkout = jobs.prepare.steps[0];
  assert.match(checkout.uses, /^actions\/checkout@/);
  assert.equal(checkout.with.ref, undefined, "prepare checks out the default branch, never the research code");
  requireLines(step("prepare", "Check research commit"), GATES.research);
});
test("a prior run is continued only from a verified artifact of a manual run on main", () => {
  const s = step("prepare", "Check prior run");
  assert.equal(s.if, "steps.validate.outputs.prior_run_id != ''");
  requireLines(s, GATES.prior);
  assert.match(text, /^  WORKFLOW_PATH: \.github\/workflows\/window-chain\.yml$/m);
  assert.match(text, /^  REQUIRED_PRIOR_EVENT: workflow_dispatch$/m);
  assert.match(text, /^  REQUIRED_PRIOR_BRANCH: main$/m);
  const d = step("produce", "Download prior run artifact");
  assert.equal(d.if, "needs.prepare.outputs.prior_run_id != ''");
  assert.equal(d.with.pattern, "wc-chain-*");
  requireJobLines("produce", GATES.produce);
  requireJobLines("produce", ['cp "$best/chain.moves.tsv" "$best/edges.tsv" "$GITHUB_WORKSPACE/prior/"; cp -R "$best/states" "$GITHUB_WORKSPACE/prior/states"']);   // the solver record travels with the chain
});
test("produce stops cleanly and uploads the candidate", () => {
  const up = jobs.produce.steps.at(-1);
  assert.match(up.uses, /^actions\/upload-artifact@/);
  assert.equal(up.with.name, "wc-candidate-${{ github.run_id }}");
});
test("verify gates: three checkers, exact verdicts, edge counts, greedy record", () => {
  const v = step("verify", "Verify chain (Julia, Flix, independent replay)");
  requireJobLines("verify", GATES.verify);
  assert.ok(v.run.includes("run_checks.sh"));
  assert.equal(v.if, undefined);
});
test("the verified artifact is uploaded only after every verify step passed, then the greedy gate runs", () => {
  const names = jobs.verify.steps.map(s => s.name ?? s.uses.split("@")[0]);
  const idx = n => names.findIndex(x => x === n);
  const up = jobs.verify.steps.find(s => s.with.name === "wc-chain-${{ github.run_id }}");
  assert.ok(up, "wc-chain upload");
  assert.equal(up.if, undefined, "no `if` (an `if: always()` would upload after a failed gate)");
  assert.ok(up.index > idx("Package artifact") && idx("Package artifact") > idx("Verify chain (Julia, Flix, independent replay)") && idx("Verify chain (Julia, Flix, independent replay)") > idx("Build Flix verifier jar"));
  const gate = step("verify", "Greedy gate");
  assert.ok(gate.index > up.index);
  assert.equal(gate.if, "env.FAIL_ON_GREEDY == 'true' && env.GREEDY != '0'");
  assert.ok(gate.run.includes("exit 1"));
  // only the failure-log steps run after a failure
  for (const s of jobs.verify.steps.filter(s => s.if)) assert.ok(["Greedy gate", "Collect failure logs"].includes(s.name) || s.with.name?.startsWith("wc-failure-"), `unexpected condition on ${s.name ?? s.uses}`);
  const failUp = jobs.verify.steps.find(s => s.with.name?.startsWith("wc-failure-"));
  assert.equal(failUp.if, "failure() || cancelled()");
});
test("it never commits, pushes, tags, comments or dispatches", () => {
  assert.doesNotMatch(text, /git (commit|push|tag)\b|gh (pr|issue|release|workflow)\b|submodule/);
});
