// SPDX-License-Identifier: AGPL-3.0-or-later
// Static checks of .github/workflows/window-chain.yml (the workflow is manual and cannot run in CI).
// The workflow is parsed into jobs and steps (no YAML library in the repo); the security gates are pinned line by line,
// because a gate that is weakened to `true` must fail a test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    if (!step) { if (map && (m = line.match(/^      ([A-Za-z_0-9]+): (.*)$/))) map[m[1]] = m[2]; continue; }
    if ((m = line.match(/^        (env|with):$/))) { map = step[m[1]]; continue; }
    if ((m = line.match(/^        run: \|$/))) { block = { step, indent: 10 }; map = null; continue; }
    if ((m = line.match(/^        (name|uses|if|timeout-minutes|continue-on-error): (.*)$/))) { step[m[1]] = m[2]; map = null; continue; }
    if (map && (m = line.match(/^          ([A-Za-z_0-9-]+): (.*)$/))) map[m[1]] = m[2];
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
  "[ -z \"$IN_PRIOR_MONTHS_SHA\" ] || [[ \"$IN_PRIOR_MONTHS_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"prior_months_sha256 must be 64 lowercase hex digits\"",
  "[ -z \"$IN_PRIOR_BEST_SHA\" ] || [[ \"$IN_PRIOR_BEST_SHA\" =~ ^[0-9a-f]{64}$ ]] || fail \"prior_best_effort_sha256 must be 64 lowercase hex digits\"",
  "[ -z \"$IN_PRIOR_MONTHS_SHA$IN_PRIOR_BEST_SHA\" ] || [ -n \"$IN_PRIOR\" ] || fail \"prior_*_sha256 need prior_run_id\"",
  "ym='^(19[0-9]{2}|20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'",
  "path='^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$'",
  "if [ \"$IN_SMOKE\" = \"true\" ]; then max=3; prior=\"\"; fi",
  "max=${IN_MAX:-100000}; prior=$IN_PRIOR"
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
  "grep -qx \"months_sha256=${PRIOR_MONTHS_SHA:-$MONTHS_SHA}\" \"$best/VERIFIED.txt\" || { echo \"::error::the prior chain was produced with another month list\"; exit 1; }",
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
test("layout input reaches the producer too, and prepare refuses early when the producer at research_ref cannot read it", () => {
  const head = text.split("\njobs:")[0];
  assert.doesNotMatch(head, /Only the verify job reads it|for example the April tiles/);
  assert.match(head, /^      layout_path:\n        description: [^\n]*producer[^\n]*\n/m);
  assert.equal(jobs.produce.env.LAYOUT_PATH, "${{ inputs.layout_path }}");
  assert.equal(jobs.produce.env.LAYOUT_SHA, "${{ inputs.layout_sha256 }}");
  const exp = '[ -z "$LAYOUT_PATH" ] || { echo "$LAYOUT_SHA  src/$LAYOUT_PATH" | sha256sum --check --strict; export CAL7_WINDOW_LAYOUT="$GITHUB_WORKSPACE/src/$LAYOUT_PATH" CAL7_WINDOW_LAYOUT_SHA256="$LAYOUT_SHA"; }';
  const p = runLines(step("produce", "Produce edges"));
  const e = p.indexOf(exp), j = p.findIndex(x => x.startsWith("timeout 65m julia"));
  assert.ok(e >= 0 && e < j, "produce exports the layout before the producer starts");
  const prep = runLines(step("prepare", "Check research commit"));
  const g = 'git grep -qw CAL7_WINDOW_LAYOUT "$SHA" -- "$WC/window_chain.jl" || fail "layout_path is set, but the producer at research_ref does not read CAL7_WINDOW_LAYOUT"';
  const g2 = 'git grep -qw CAL7_WINDOW_LAYOUT "$SHA" -- "$WC/run_checks.sh" || fail "layout_path is set, but run_checks.sh at research_ref does not read CAL7_WINDOW_LAYOUT"';
  for (const x of [g, g2]) assert.ok(prep.includes('[ -z "$LAYOUT_PATH" ] || ' + x), x);
});
test("the prepare gate matches the variable by word: a file that only names CAL7_WINDOW_LAYOUT_SHA256 does not pass", () => {
  const gates = runLines(step("prepare", "Check research commit")).filter(l => l.startsWith('[ -z "$LAYOUT_PATH" ] || git grep'));
  assert.equal(gates.length, 2);
  const repo = mkdtempSync(join(tmpdir(), "wc-gate-"));
  const wc = "research/x";
  mkdirSync(join(repo, wc), { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...a]).toString().trim();
  git("init", "-q");
  const commit = (producer, checks) => {
    writeFileSync(join(repo, wc, "window_chain.jl"), producer); writeFileSync(join(repo, wc, "run_checks.sh"), checks);
    git("add", "-A"); git("commit", "-q", "-m", "x"); return git("rev-parse", "HEAD");
  };
  const gate = (sha, layout) => spawnSync("bash", ["-c", 'fail() { echo "$1"; exit 1; }; ' + gates.join("\n")], { cwd: repo, env: { ...process.env, SHA: sha, WC: wc, LAYOUT_PATH: layout } });
  const both = commit("x = ENV[\"CAL7_WINDOW_LAYOUT\"]\n", "layout=${CAL7_WINDOW_LAYOUT:-d}\n");
  assert.equal(gate(both, "l.tsv").status, 0, "both files name the variable");
  assert.equal(gate(both, "").status, 0, "no layout input: no gate");
  const pinOnly = commit("x = ENV[\"CAL7_WINDOW_LAYOUT\"]\n", "pin=${CAL7_WINDOW_LAYOUT_SHA256:-}\n");
  const r = gate(pinOnly, "l.tsv");
  assert.equal(r.status, 1, "run_checks.sh that only names the pin must not pass");
  assert.match(r.stdout.toString(), /run_checks\.sh at research_ref/);
  const pinOnlyProducer = commit("x = ENV[\"CAL7_WINDOW_LAYOUT_SHA256\"]\n", "layout=${CAL7_WINDOW_LAYOUT:-d}\n");
  assert.match(gate(pinOnlyProducer, "l.tsv").stdout.toString(), /producer at research_ref/);
  assert.equal(gate(pinOnly, "").status, 0);
});
test("the layout pin is recorded in VERIFIED.txt and the summary, and a continuation compares it", () => {
  assert.ok(step("verify", "Package artifact").run.includes('echo "layout_sha256=${LAYOUT_SHA:--}"'));
  assert.ok(step("verify", "Package artifact").run.includes('layout: \\`${LAYOUT_PATH:--}\\`, \\`${LAYOUT_SHA:--}\\`'));
  requireJobLines("produce", ['grep -qx "layout_sha256=${LAYOUT_SHA:--}" "$best/VERIFIED.txt" || { echo "::error::the prior chain was produced with another layout"; exit 1; }']);
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

test("max_edges bounds the edges of one run (a stage); the smoke run is always 3 edges without a prior", () => {
  const head = text.split("\njobs:")[0];
  assert.match(head, /^      max_edges:\n        description: [^\n]*\n        type: string\n        default: ""\n/m);
  const l = runLines(step("prepare", "Validate inputs"));
  for (const x of [
    '[ -z "$IN_MAX" ] || { [[ "$IN_MAX" =~ ^[1-9][0-9]{0,4}$ ]] && [ "$IN_MAX" -le 100000 ]; } || fail "max_edges must be 1-100000"',
    'max=${IN_MAX:-100000}; prior=$IN_PRIOR',
    'if [ "$IN_SMOKE" = "true" ]; then max=3; prior=""; fi']) assert.ok(l.includes(x), x);
  assert.ok(l.indexOf('max=${IN_MAX:-100000}; prior=$IN_PRIOR') < l.indexOf('if [ "$IN_SMOKE" = "true" ]; then max=3; prior=""; fi'), "smoke overrides max_edges");
  assert.ok(runLines(step("produce", "Produce edges")).some(x => x.startsWith('args=(max_edges="$MAX_EDGES"')));
});
test("expect_prior_edges: a continuation checks the edge count of the prior chain before the producer starts", () => {
  const head = text.split("\njobs:")[0];
  assert.match(head, /^      expect_prior_edges:\n        description: [^\n]*\n        type: string\n        default: ""\n/m);
  const l = runLines(step("prepare", "Validate inputs"));
  for (const x of [
    '[ -z "$IN_EXPECT" ] || [[ "$IN_EXPECT" =~ ^[1-9][0-9]{0,4}$ ]] || fail "expect_prior_edges must be a positive number"',
    '[ -z "$IN_EXPECT" ] || [ -n "$IN_PRIOR" ] || fail "expect_prior_edges needs prior_run_id"',
    '[ "$IN_SMOKE" = "true" ] || [ -z "$IN_PRIOR" ] || [ -n "$IN_EXPECT" ] || fail "prior_run_id needs expect_prior_edges (the edge count of the prior chain)"']) assert.ok(l.includes(x), x);
  requireJobLines("produce", [
    '[ -z "$EXPECT_PRIOR" ] || [ "$most" = "$EXPECT_PRIOR" ] || { echo "::error::the prior chain has $most edges, expect_prior_edges is $EXPECT_PRIOR"; exit 1; }',
    '[ "${PRIOR_MONTHS_SHA:-$MONTHS_SHA}" != "$MONTHS_SHA" ] || grep -qx "complete=false" "$best/VERIFIED.txt" || { echo "::error::the prior chain is complete; there is nothing to continue"; exit 1; }']);
});
test("29 rule: opt-in input (default true), gate by word in prepare, exported to the checkers, compared on resume", () => {
  const head = text.split("\njobs:")[0];
  assert.match(head, /^      best_effort_29:\n        description: [^\n]*\n        type: boolean\n        default: true\n/m);
  const prep = runLines(step("prepare", "Check research commit"));
  for (const f of ["run_checks.sh", "check.jl", "verify_chain.jl"]) assert.ok(prep.includes(`[ "$BEST29" != true ] || git grep -qw CAL7_BEST_EFFORT_29 "$SHA" -- "$WC/${f}" || fail "best_effort_29 is set, but ${f} at research_ref does not read CAL7_BEST_EFFORT_29"`), f);
  const v = runLines(step("verify", "Verify chain (Julia, Flix, independent replay)"));
  const e = v.indexOf('[ "$BEST29" != true ] || export CAL7_BEST_EFFORT_29=1'), c = v.findIndex(x => x.startsWith('bash "src/$WC/run_checks.sh"'));
  assert.ok(e >= 0 && e < c, "exported before run_checks.sh");
  const w = step("verify", "Package artifact").run;
  assert.ok(w.includes('echo "best_effort_29=$BEST29"') && w.includes('echo "best_effort_sha256=$BEST_SHA"'));
  requireJobLines("produce", [
    'grep -qx "best_effort_29=$BEST29" "$best/VERIFIED.txt" || { echo "::error::the prior chain was checked with another best_effort_29 setting"; exit 1; }',
    'grep -qx "best_effort_sha256=${PRIOR_BEST_SHA:-$BEST_SHA}" "$best/VERIFIED.txt" || { echo "::error::the prior chain was produced with another best-effort file"; exit 1; }']);
});
test("the 29 gate in prepare passes only when each checker names CAL7_BEST_EFFORT_29 as a word, and is off with best_effort_29=false", () => {
  const gates = runLines(step("prepare", "Check research commit")).filter(l => l.startsWith('[ "$BEST29" != true ] || git grep'));
  assert.equal(gates.length, 3);
  const repo = mkdtempSync(join(tmpdir(), "wc-gate29-")), wc = "research/x";
  mkdirSync(join(repo, wc), { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...a]).toString().trim();
  git("init", "-q");
  const commit = (a, b, c) => { for (const [n, s] of [["run_checks.sh", a], ["check.jl", b], ["verify_chain.jl", c]]) writeFileSync(join(repo, wc, n), s); git("add", "-A"); git("commit", "-q", "-m", "x"); return git("rev-parse", "HEAD"); };
  const gate = (sha, on) => spawnSync("bash", ["-c", 'fail() { echo "$1"; exit 1; }; ' + gates.join("\n")], { cwd: repo, env: { ...process.env, SHA: sha, WC: wc, BEST29: on } });
  const all = commit("x=${CAL7_BEST_EFFORT_29:-}\n", 'ENV["CAL7_BEST_EFFORT_29"]\n', 'ENV["CAL7_BEST_EFFORT_29"]\n');
  assert.equal(gate(all, "true").status, 0);
  const none = commit("x\n", "y\n", "z\n");
  assert.equal(gate(none, "false").status, 0, "off: no gate");
  assert.equal(gate(none, "true").status, 1);
  const noVerify = commit("x=${CAL7_BEST_EFFORT_29:-}\n", 'ENV["CAL7_BEST_EFFORT_29"]\n', 'ENV["CAL7_BEST_EFFORT_29_X"]\n');
  const r = gate(noVerify, "true");
  assert.equal(r.status, 1, "a file that only names a longer variable does not pass");
  assert.match(r.stdout.toString(), /verify_chain\.jl at research_ref/);
});
test("state report: extra artifact after the checks, only when state_report.sh exists at research_ref, never part of the chain artifact", () => {
  const names = jobs.verify.steps.map(s => s.name ?? s.uses.split("@")[0]);
  const i = names.indexOf("State report"), v = names.indexOf("Verify chain (Julia, Flix, independent replay)"), p = names.indexOf("Package artifact");
  const upc = names.indexOf(jobs.verify.steps.find(x => x.with.name === "wc-chain-${{ github.run_id }}").uses.split("@")[0]);
  const chainUp = jobs.verify.steps.findIndex(x => x.with.name === "wc-chain-${{ github.run_id }}");
  assert.ok(v >= 0 && p > v && chainUp > p && i > chainUp, "state report runs after the verified chain artifact is uploaded, so a hang or failure cannot lose the stage");
  assert.ok(upc >= 0);
  const s = jobs.verify.steps[i], r = runLines(s);
  assert.equal(s.if, undefined);
  assert.equal(s["timeout-minutes"], "10");
  assert.equal(s["continue-on-error"], "true");
  assert.ok(r.includes('if [ -f "src/$WC/state_report.sh" ]; then'));
  assert.ok(r.some(x => x.startsWith('if bash "src/$WC/state_report.sh" "$GITHUB_WORKSPACE/cand/chain.moves.tsv" "$GITHUB_WORKSPACE/cand/states" "$(command -v julia)" >')));
  const up = jobs.verify.steps.find(x => x.with.name === "wc-state-report-${{ github.run_id }}");
  assert.ok(up && up.index > i && up.with["if-no-files-found"] === "ignore");
  assert.doesNotMatch(step("verify", "Package artifact").run, /state-report/);
  assert.equal(jobs.produce.steps.find(x => x.name === "Download prior run artifact").with.pattern, "wc-chain-*", "a state report is never taken as a prior");
});
test("no workflow expression inside any run block (script injection)", () => {
  for (const [name, j] of Object.entries(jobs)) for (const s of j.steps) assert.doesNotMatch(s.run, /\$\{\{/, `${name}/${s.name ?? s.uses}: expression in run`);
  assert.doesNotMatch(text, /^\s+run: [^|]/m, "run blocks use the | form only");
});
test("every input reaches the scripts through env, with the exact mapping", () => {
  const v = step("prepare", "Validate inputs").env;
  const want = { IN_REF: "research_ref", IN_START: "start", IN_END: "end", IN_MONTHS_PATH: "months_path", IN_MONTHS_SHA: "months_sha256", IN_ROOT: "root_month", IN_PRINT_PATH: "print_path", IN_PRINT_SHA: "print_sha256", IN_LAYOUT_PATH: "layout_path", IN_LAYOUT_SHA: "layout_sha256", IN_BEST: "best_effort_path", IN_CLAIMS: "claims_path", IN_LIBRARY: "library", IN_WIDTH: "width", IN_LAMBDA: "lambda", IN_PRIOR: "prior_run_id", IN_SMOKE: "smoke_mode", IN_MAX: "max_edges", IN_EXPECT: "expect_prior_edges", IN_PRIOR_MONTHS_SHA: "prior_months_sha256", IN_PRIOR_BEST_SHA: "prior_best_effort_sha256" };
  assert.deepEqual(Object.keys(v).sort(), Object.keys(want).sort());
  for (const [k, input] of Object.entries(want)) assert.equal(v[k], `\${{ inputs.${input} }}`, k);
  const inputsDeclared = [...text.matchAll(/^      ([a-z_0-9]+):\n        description:/gm)].map(m => m[1]).sort();
  assert.deepEqual(inputsDeclared, [...Object.values(want), "fail_on_greedy", "best_effort_29"].sort());
  assert.equal(jobs.verify.env.BEST29, "${{ inputs.best_effort_29 }}");
  assert.equal(jobs.produce.env.BEST29, "${{ inputs.best_effort_29 }}");
  assert.equal(jobs.produce.env.EXPECT_PRIOR, "${{ needs.prepare.outputs.expect_prior_edges }}");
  assert.equal(jobs.produce.env.PRIOR_MONTHS_SHA, "${{ inputs.prior_months_sha256 }}");
  assert.equal(jobs.produce.env.PRIOR_BEST_SHA, "${{ inputs.prior_best_effort_sha256 }}");
  assert.equal(jobs.prepare.steps.find(s => s.name === "Check research commit").env.BEST29, "${{ inputs.best_effort_29 }}");
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
