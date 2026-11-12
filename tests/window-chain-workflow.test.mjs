// SPDX-License-Identifier: AGPL-3.0-or-later
// Static checks of .github/workflows/window-chain.yml (the workflow is manual and cannot run in CI).
// The workflow is parsed into jobs and steps (no YAML library in the repo); the security gates are pinned line by line,
// because a gate that is weakened to `true` must fail a test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
  "[ -z \"$IN_ROOT\" ] || ymok \"$IN_ROOT\" || fail \"root_month must be YYYY-MM between 1900-01 and 2100-01\"",
  "[ -z \"$IN_START\" ] || ymok \"$IN_START\" || fail \"start must be YYYY-MM between 1900-01 and 2100-01\"",
  "[ -z \"$IN_END\" ] || ymok \"$IN_END\" || fail \"end must be YYYY-MM between 1900-01 and 2100-01\"",
  "[[ \"$IN_MONTHS_PATH\" =~ $path ]] && [[ \"$IN_MONTHS_PATH\" != *..* ]] || fail \"months_path is not a plain repository path\"",
  "[[ \"$IN_MONTHS_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"months_sha256 must be 64 lowercase hex digits\"",
  "[ -z \"$IN_BEST\" ] || { [[ \"$IN_BEST\" =~ $path ]] && [[ \"$IN_BEST\" != *..* ]]; } || fail \"best_effort_path is not a plain repository path\"",
  "ymok() { [[ \"$1\" =~ $ym ]] && [[ ! \"$1\" > 2100-01 ]]; }",
  "[[ \"$IN_PRINT_PATH\" =~ $path ]] && [[ \"$IN_PRINT_PATH\" != *..* ]] || fail \"print_path is not a plain repository path\"",
  "[ -z \"$IN_CLAIMS\" ] || { [[ \"$IN_CLAIMS\" =~ $path ]] && [[ \"$IN_CLAIMS\" != *..* ]]; } || fail \"claims_path is not a plain repository path\"",
  "[[ \"$IN_PRINT_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"print_sha256 must be 64 lowercase hex digits\"",
  "[ -z \"$IN_LAYOUT_PATH\" ] || { [[ \"$IN_LAYOUT_PATH\" =~ $path ]] && [[ \"$IN_LAYOUT_PATH\" != *..* ]]; } || fail \"layout_path is not a plain repository path\"",
  "[ -z \"$IN_LAYOUT_PATH\" ] || [[ \"$IN_LAYOUT_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"layout_path needs layout_sha256 (64 lowercase hex digits)\"",
  "[ -n \"$IN_LAYOUT_PATH\" ] || [ -z \"$IN_LAYOUT_SHA\" ] || fail \"layout_sha256 needs layout_path\"",
  "[[ \"$IN_LIBRARY\" =~ ^L[145]$ ]] || fail \"library must be L1, L4 or L5\"",
  "[[ \"$IN_WIDTH\" =~ ^[1-9][0-9]{0,2}$ ]] && [ \"$IN_WIDTH\" -le 200 ] || fail \"width must be 1-200\"",
  "[[ \"$IN_LAMBDA\" =~ ^([1-9]|10)$ ]] || fail \"lambda must be 1-10\"",
  "[ -z \"$IN_PRIOR\" ] || [[ \"$IN_PRIOR\" =~ ^[0-9]{1,20}$ ]] || fail \"prior_run_id must be digits\"",
  "ym='^(19[0-9]{2}|20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'",
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
  "git fetch --no-tags origin \"+refs/heads/$RESEARCH_BRANCH:refs/remotes/origin/$RESEARCH_BRANCH\" || fail \"cannot fetch $RESEARCH_BRANCH\"",
  "git fetch --no-tags origin \"$SHA\" || fail \"commit $SHA is not fetchable from $GITHUB_REPOSITORY\"",
  "[ \"$(git rev-parse --verify \"$SHA^{commit}\")\" = \"$SHA\" ] || fail \"research_ref does not resolve to itself\"",
  "git merge-base --is-ancestor \"$SHA\" \"refs/remotes/origin/$RESEARCH_BRANCH\" || fail \"research_ref is not an ancestor of $RESEARCH_BRANCH\"",
  "[ \"$(git show \"$SHA:$MONTHS_PATH\" | sha256sum | cut -d' ' -f1)\" = \"$MONTHS_SHA\" ] || fail \"month list differs from months_sha256\"",
  "[ \"$missing\" = 0 ] || fail \"research commit lacks required files\""
 ],
 "produce": [
  "echo \"$PRINT_SHA  src/$PRINT_PATH\" | sha256sum --check --strict",
  "(cd \"$d\" && sha256sum --check --strict SHA256SUMS >/dev/null) || { echo \"::error::checksum failure in $d\"; exit 1; }",
  "[ -n \"$best\" ] || { echo \"::error::no verified chain artifact found to continue\"; exit 1; }",
  "grep -qx \"print_sha256=$PRINT_SHA\" \"$best/VERIFIED.txt\" || { echo \"::error::the prior chain was produced with another print\"; exit 1; }",
  "echo \"$MONTHS_SHA  src/$MONTHS_PATH\" | sha256sum --check --strict",
  "grep -qx \"months_sha256=$MONTHS_SHA\" \"$best/VERIFIED.txt\" || { echo \"::error::the prior chain was produced with another month list\"; exit 1; }",
  "grep -qx \"root_month=${ROOT_MONTH:--}\" \"$best/VERIFIED.txt\" || { echo \"::error::the prior chain was produced with another root month\"; exit 1; }",
  "export CAL7_WINDOW_MONTHS=\"$GITHUB_WORKSPACE/src/$MONTHS_PATH\" CAL7_WINDOW_MONTHS_SHA256=\"$MONTHS_SHA\" CAL7_WINDOW_PRINT_SHA=\"$PRINT_SHA\"",
  "[ -z \"$ROOT_MONTH\" ] || export CAL7_ROOT_MONTH=\"$ROOT_MONTH\"",
  "timeout 65m julia --startup-file=no --threads=4 \"src/$WC/window_chain.jl\" \"$out\" \"src/$PRINT_PATH\" \"${args[@]}\" 2>&1 | tee \"$GITHUB_WORKSPACE/out/run.log\"",
  "if [ \"$rc\" = 3 ]; then echo \"::error::no new edge: the deadline passed or the search stalled before the first edge of this run (exit 3); nothing to verify or continue from\"; exit 3; fi",
  "[ \"$rc\" = 0 ] || { echo \"::error::producer exited with $rc (124 = timeout)\"; exit \"$rc\"; }"
 ],
 "verify": [
  "[ -n \"$chain_end\" ] && [ -n \"$edges_total\" ] && [ -n \"$complete\" ] || { echo \"::error::PROGRESS.txt is incomplete\"; exit 1; }",
  "[ \"$edges_total\" -ge 1 ] || { echo \"::error::no edge to verify\"; exit 1; }",
  "echo \"$MONTHS_SHA  src/$MONTHS_PATH\" | sha256sum --check --strict",
  "[ -n \"$best_effort\" ] || { echo \"::error::PROGRESS.txt has no best_effort_edges\"; exit 1; }",
  "mkdir -p \"$GITHUB_WORKSPACE/out\"; awk -v end=\"$chain_end\" '$0 <= end' \"src/$MONTHS_PATH\" > \"$cut\"",
  "export CAL7_WINDOW_MONTHS=$cut CAL7_WINDOW_MONTHS_SHA256=$cut_sha CAL7_WINDOW_PRINT_SHA=$PRINT_SHA",
  "[ -z \"$ROOT_MONTH\" ] || export CAL7_ROOT_MONTH=$ROOT_MONTH",
  "if [ \"$best_effort\" = 0 ]; then jv=SAT; iv=ACCEPT_CHAIN; else jv=BEST_EFFORT; iv=ACCEPT_BEST_EFFORT_CHAIN; fi",
  "cmp \"$out/julia.tsv\" \"$out/flix.tsv\" || { echo \"::error::Julia and Flix receipts differ\"; exit 1; }",
  "grep -qx $'verdict\\t'\"$jv\"$'\\tlegal-retained-state-window-chain\\t'\"$((edges_total + 1))\"$'\\t'\"$edges_total\" \"$out/julia.tsv\" || { echo \"::error::Julia verdict line is not the exact $jv line for $edges_total edges\"; exit 1; }",
  "grep -q $'^independent-verdict\\t'\"$iv\"$'\\t'\"$((edges_total + 1))\"$'\\t'\"$edges_total\"$'\\t' \"$out/independent.tsv\" || { echo \"::error::independent verdict differs ($edges_total edges)\"; exit 1; }",
  "[ \"$best_effort\" = 0 ] || grep -qx $'status\\texact\\t'\"$((edges_total - best_effort))\"$'\\tbest_effort\\t'\"$best_effort\" \"$out/julia.tsv\" || { echo \"::error::Julia status line differs from $best_effort best-effort edges\"; exit 1; }",
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
test("serialized; segments of about one hour: 3000 s edge loop, 65 min timeout, 70 min job limit", () => {
  assert.match(text, /^concurrency:\n  group: window-chain\n  cancel-in-progress: false\n/m);
  for (const [name, j] of Object.entries(jobs)) { const t = Number(j["timeout-minutes"]); assert.ok(t > 0 && t <= 345, `${name} timeout ${t}`); }
  assert.equal(jobs.produce["timeout-minutes"], "70");
  assert.equal(jobs.produce.env.GENERATE_DEADLINE_S, '"3000"');
  const t = runLines(step("produce", "Produce edges")).find(l => l.startsWith("timeout "));
  assert.ok(t && t.startsWith("timeout 65m julia"), t);
  // the job limit covers the timeout plus checkout, Julia setup and the artifact download
  assert.ok(Number(jobs.produce["timeout-minutes"]) > 65 && 3000 / 60 < 65);
});
test("run contract: month list, root month and print are inputs, nothing is hard-wired to one print, root or century", () => {
  const head = text.split("\njobs:")[0];
  for (const i of ["months_path", "months_sha256", "root_month", "best_effort_path", "print_path", "print_sha256"]) assert.match(head, new RegExp(`^      ${i}:\n`, "m"), i);
  assert.doesNotMatch(head, /print_window_end/);
  // print_path has no default (the print of a stage is an input, not window-2037-01)
  assert.match(head, /^      print_path:\n        description: [^\n]*\n        type: string\n        required: true\n/m);
  assert.match(head, /^      months_path:\n        description: [^\n]*\n        type: string\n        required: true\n/m);
  assert.doesNotMatch(text, /window-2037-01|2037-01|WINDOW_END|window_end|2028-01|20\[0-9\]{2}-|May 2026|2026-05/);
  // the checkers get the contract through their environment: list, pin, print pin, root month
  const p = step("produce", "Produce edges"), v = step("verify", "Verify chain (Julia, Flix, independent replay)");
  assert.ok(p.run.includes("CAL7_WINDOW_MONTHS=") && p.run.includes("CAL7_WINDOW_MONTHS_SHA256=") && p.run.includes("CAL7_WINDOW_PRINT_SHA=") && p.run.includes("CAL7_ROOT_MONTH="));
  assert.ok(v.run.includes("CAL7_WINDOW_MONTHS=") && v.run.includes("CAL7_WINDOW_MONTHS_SHA256=") && v.run.includes("CAL7_WINDOW_PRINT_SHA=") && v.run.includes("CAL7_ROOT_MONTH="));
  // the root month is never replaced by a default in the verify step: it is exported only when the input is set
  assert.ok(runLines(v).includes("[ -z \"$ROOT_MONTH\" ] || export CAL7_ROOT_MONTH=$ROOT_MONTH"));
  assert.equal(jobs.verify.env.ROOT_MONTH, "${{ inputs.root_month }}");
  assert.equal(jobs.produce.env.ROOT_MONTH, "${{ inputs.root_month }}");
  assert.equal(jobs.verify.env.MONTHS_SHA, "${{ inputs.months_sha256 }}");
  assert.equal(jobs.produce.env.MONTHS_SHA, "${{ inputs.months_sha256 }}");
});
test("optional layout input: validated, checked against its SHA-256, handed to run_checks.sh only when set", () => {
  const head = text.split("\njobs:")[0];
  for (const i of ["layout_path", "layout_sha256"]) assert.match(head, new RegExp(`^      ${i}:\n        description: [^\n]*\n        type: string\n        default: ""\n`, "m"), i);
  assert.equal(jobs.verify.env.LAYOUT_PATH, "${{ inputs.layout_path }}");
  assert.equal(jobs.verify.env.LAYOUT_SHA, "${{ inputs.layout_sha256 }}");
  assert.equal(jobs.prepare.steps.find(s => s.name === "Check research commit").env.LAYOUT_PATH, "${{ inputs.layout_path }}");
  const v = step("verify", "Verify chain (Julia, Flix, independent replay)"), l = runLines(v);
  // without the inputs nothing is exported: the checkers keep their built-in layout and pin
  assert.ok(l.includes('[ -z "$LAYOUT_PATH" ] || { echo "$LAYOUT_SHA  src/$LAYOUT_PATH" | sha256sum --check --strict; export CAL7_WINDOW_LAYOUT="$GITHUB_WORKSPACE/src/$LAYOUT_PATH" CAL7_WINDOW_LAYOUT_SHA256="$LAYOUT_SHA"; }'));
  const call = l.findIndex(x => x.startsWith('bash "src/$WC/run_checks.sh"'));
  assert.ok(l.indexOf('[ -z "$LAYOUT_PATH" ] || { echo "$LAYOUT_SHA  src/$LAYOUT_PATH" | sha256sum --check --strict; export CAL7_WINDOW_LAYOUT="$GITHUB_WORKSPACE/src/$LAYOUT_PATH" CAL7_WINDOW_LAYOUT_SHA256="$LAYOUT_SHA"; }') < call);
  assert.ok(l[call].endsWith('"$GITHUB_WORKSPACE/out/checks" 2>&1 | tee "$GITHUB_WORKSPACE/out/verify.log"'), "run_checks.sh call is unchanged");
  assert.ok(runLines(step("prepare", "Check research commit")).includes('[ -z "$LAYOUT_PATH" ] || git cat-file -e "$SHA:$LAYOUT_PATH" || fail "$LAYOUT_PATH is missing at $SHA"'));
});
test("research_ref must lie on the research branch", () => {
  assert.match(text, /^  RESEARCH_BRANCH: research\/cube-display-feasibility$/m);
  const prep = step("prepare", "Check research commit");
  const l = runLines(prep), i = l.findIndex(x => x.startsWith("git merge-base --is-ancestor")), f = l.findIndex(x => x.startsWith("git fetch --no-tags origin \"$SHA\""));
  assert.ok(f >= 0 && i > f, "ancestor check after the fetch of the commit");
  assert.ok(prep.run.includes("refs/pull/N/head"), "comment names the pull request refs");
  assert.doesNotMatch(prep.run, /only in a fork is not fetchable/);
});
test("every segment records research_ref, library, width and lambda (segments.tsv), carried through resume", () => {
  const p = step("produce", "Produce edges"), a = runLines(p).find(l => l.startsWith("args=("));
  for (const k of ['library="$LIBRARY"', 'width="$WIDTH"', 'lambda="$LAMBDA"', 'run_id="$GITHUB_RUN_ID"', 'research_ref="$SHA"']) assert.ok(a.includes(k), k);
  requireJobLines("produce", ['cp "$best/chain.moves.tsv" "$best/edges.tsv" "$best/segments.tsv" "$GITHUB_WORKSPACE/prior/"; cp -R "$best/states" "$GITHUB_WORKSPACE/prior/states"']);
  assert.ok(runLines(step("produce", "Produce edges")).some(l => l.includes('test -s "$out/segments.tsv"')));
  const pk = step("verify", "Package artifact");
  assert.ok(pk.run.includes('"$c/segments.tsv"'));
  assert.ok(pk.run.includes('echo "months_sha256=$MONTHS_SHA"; echo "root_month=${ROOT_MONTH:--}"'));
});
test("no workflow expression inside any run block (script injection)", () => {
  for (const [name, j] of Object.entries(jobs)) for (const s of j.steps) assert.doesNotMatch(s.run, /\$\{\{/, `${name}/${s.name ?? s.uses}: expression in run`);
  assert.doesNotMatch(text, /^\s+run: [^|]/m, "run blocks use the | form only");
});
test("every input reaches the scripts through env, with the exact mapping", () => {
  const v = step("prepare", "Validate inputs").env;
  const want = { IN_REF: "research_ref", IN_START: "start", IN_END: "end", IN_MONTHS_PATH: "months_path", IN_MONTHS_SHA: "months_sha256", IN_ROOT: "root_month", IN_PRINT_PATH: "print_path", IN_PRINT_SHA: "print_sha256", IN_LAYOUT_PATH: "layout_path", IN_LAYOUT_SHA: "layout_sha256", IN_BEST: "best_effort_path", IN_CLAIMS: "claims_path", IN_LIBRARY: "library", IN_WIDTH: "width", IN_LAMBDA: "lambda", IN_PRIOR: "prior_run_id", IN_SMOKE: "smoke_mode" };
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
  requireJobLines("produce", ['cp "$best/chain.moves.tsv" "$best/edges.tsv" "$best/segments.tsv" "$GITHUB_WORKSPACE/prior/"; cp -R "$best/states" "$GITHUB_WORKSPACE/prior/states"']);   // the solver and parameter record travel with the chain
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
test("every sed extraction of PROGRESS.txt in the workflow returns the right value on a sample (GNU sed basic regex)", () => {
  const sample = "complete=false\nstop_reason=max_edges\nedges_total=12\nedges_new=5\nchain_end=2026-08\ngreedy_edges=3\nplan_end=2026-09\nroot_month=2026-05\nrooted=true\nbridge_edges=1\nbest_effort_edges=2\nseconds=9.5\n";
  const want = { chain_end: "2026-08", edges_total: "12", complete: "false", best_effort: "2", greedy_edges: "3" };
  const found = {};
  for (const j of ["produce", "verify"]) for (const s of jobs[j].steps) for (const l of runLines(s)) {
    const m = l.match(/sed -n '(s\/\^([a-z_]+)=.*\/p)'/);
    if (!m) continue;
    const key = l.match(/^([a-z_]+)=\$\(/)?.[1] ?? (m[2] === "edges_total" ? "edges_total" : m[2]);
    const out = execFileSync("sed", ["-n", m[1]], { input: sample }).toString().trim();
    const expected = want[key] ?? want[m[2]];
    assert.equal(out, expected, `sed for ${key} (${m[2]}) returned '${out}'`);
    found[m[2]] = true;
  }
  for (const k of ["chain_end", "edges_total", "complete", "best_effort_edges", "greedy_edges"]) assert.ok(found[k], `no sed extraction found for ${k}`);
});
