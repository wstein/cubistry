// SPDX-License-Identifier: AGPL-3.0-or-later
// Static checks of .github/workflows/beam-reroot-measure.yml (manual workflow; it cannot run in CI). WORKFLOW_FILE overrides the file
// (scripts/ci/beam-reroot-measure-mutants.sh runs this test on mutated copies).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const text = readFileSync(process.env.WORKFLOW_FILE ?? new URL("../.github/workflows/beam-reroot-measure.yml", import.meta.url), "utf8");
const lines = text.split("\n");
const section = (start, end) => { const a = lines.indexOf(start); assert.ok(a >= 0, start); const b = end ? lines.indexOf(end, a + 1) : lines.length; return lines.slice(a + 1, b < 0 ? lines.length : b); };
const jobBlock = name => { const a = lines.indexOf(`  ${name}:`); assert.ok(a >= 0, `job ${name}`); let b = lines.length; for (let i = a + 1; i < lines.length; i++) if (/^  [a-z-]+:$/.test(lines[i])) { b = i; break; } return lines.slice(a, b); };
const runBlock = (block, stepName) => { const a = block.findIndex(l => l === `      - name: ${stepName}`); assert.ok(a >= 0, `step ${stepName}`); const r = block.findIndex((l, i) => i > a && l === "        run: |"); assert.ok(r > a); const out = []; for (let i = r + 1; i < block.length && (block[i] === "" || block[i].startsWith("          ")); i++) out.push(block[i].slice(10)); return out.join("\n"); };

test("trigger: workflow_dispatch only, never push or pull_request", () => {
  const on = section("on:", "permissions:").filter(l => /^  [a-z_]+:/.test(l)).map(l => l.trim());
  assert.deepEqual(on, ["workflow_dispatch:"]);
  assert.ok(!/^\s+(push|pull_request|pull_request_target|schedule|workflow_run):/m.test(text));
});
test("permissions are read-only (contents, actions) and runs are serialized", () => {
  assert.deepEqual(section("permissions:", "concurrency:").filter(l => /^  [a-z-]+:/.test(l)).map(l => l.trim()), ["contents: read", "actions: read"]);
  assert.ok(text.includes("concurrency:\n  group: beam-reroot-measure\n  cancel-in-progress: false\n"));
  assert.ok(!/contents: write|id-token|pull-requests|packages/.test(text));
});
test("every action is pinned to a commit SHA", () => {
  const uses = lines.filter(l => /^\s+- uses:|^\s+uses:/.test(l));
  assert.ok(uses.length >= 4);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40} # v\d/, u);
  assert.ok(!/persist-credentials: true/.test(text));
  assert.equal(lines.filter(l => l.includes("persist-credentials: false")).length, 2);
});
test("job limits stay below 345 minutes and the heavy step runs niced with a timeout", () => {
  for (const j of ["prepare", "measure"]) {
    const m = jobBlock(j).join("\n").match(/^    timeout-minutes: (\d+)$/m); assert.ok(m, j);
    assert.ok(Number(m[1]) < 345, `${j} ${m[1]}`);
  }
  assert.equal(jobBlock("measure").join("\n").match(/^    timeout-minutes: (\d+)$/m)[1], "340");
  const run = runBlock(jobBlock("measure"), "Measure");
  assert.match(run, /nice -n 10 timeout \$\(\(DEADLINE_MIN \+ 15\)\)m/);
  assert.match(run, /deadline_s=\$\(\(DEADLINE_MIN \* 60\)\)/);
  assert.match(run, /run_reroot_measure\.sh/);
  assert.ok(jobBlock("measure").includes("      max-parallel: 5"));
  assert.ok(jobBlock("measure").includes("      fail-fast: false"));
});
test("artifacts are uploaded even when the measurement fails", () => {
  const b = jobBlock("measure").join("\n");
  assert.match(b, /upload-artifact@[0-9a-f]{40}[^\n]*\n\s+if: always\(\)\n\s+with:\n\s+name: reroot-\$\{\{ strategy\.job-index \}\}-\$\{\{ github\.run_id \}\}\n\s+path: out\/\n/);
});
test("prepare refuses while a window-chain run is queued or running", () => {
  const run = runBlock(jobBlock("prepare"), "Refuse while a window-chain run is queued or running");
  assert.match(run, /for s in queued in_progress waiting pending requested; do/);
  assert.match(run, /workflows\/window-chain\.yml\/runs\?status=\$s/);
  assert.match(run, /\[ "\$n" = 0 \] \|\| \{ echo "::error::/);
});
test("prepare checks the research commit: ancestor of the research branch, files, hook", () => {
  const run = runBlock(jobBlock("prepare"), "Check research commit");
  for (const g of ['git merge-base --is-ancestor "$SHA" "refs/remotes/origin/$RESEARCH_BRANCH"', 'run_reroot_measure.sh', 'evidence/reroot-measure/SHA256SUMS', 'git grep -qw BEAMLOG "$SHA"'])
    assert.ok(run.includes(g), g);
  assert.ok(text.includes("  RESEARCH_BRANCH: research/cube-display-feasibility"));
});

const validate = (inputs) => {
  const dir = mkdtempSync(join(tmpdir(), "brm-")); const outFile = join(dir, "out");
  writeFileSync(outFile, "");
  const env = { ...process.env, GITHUB_OUTPUT: outFile, IN_REF: "a".repeat(40), IN_EDGES: "87,62,54,22,77,74,193,203,166,159", IN_COMMITS: "1,10,30,60", IN_LIBRARY: "L5", IN_WIDTH: "40", IN_LAMBDA: "3", IN_REF_WIDTH: "", IN_DEADLINE: "300", ...inputs };
  const r = spawnSync("bash", ["-c", runBlock(jobBlock("prepare"), "Validate inputs")], { encoding: "utf8", env });
  return { status: r.status, out: r.stdout, matrix: readFileSync(outFile, "utf8").trim() };
};
test("validate: defaults give five pairs; an odd count leaves a single edge", () => {
  const d = validate({});
  assert.equal(d.status, 0, d.out);
  assert.equal(d.matrix, 'matrix={"ids":["87,62","54,22","77,74","193,203","166,159"]}');
  assert.equal(validate({ IN_EDGES: "3,4,5" }).matrix, 'matrix={"ids":["3,4","5"]}');
  assert.equal(validate({ IN_EDGES: "205" }).matrix, 'matrix={"ids":["205"]}');
});
test("validate: bad inputs are refused", () => {
  const bad = {
    "short sha": { IN_REF: "abc" }, "upper sha": { IN_REF: "A".repeat(40) },
    "empty edges": { IN_EDGES: "" }, "edge 1": { IN_EDGES: "1,5" }, "edge 206": { IN_EDGES: "206" }, "duplicate": { IN_EDGES: "5,5" },
    "21 edges": { IN_EDGES: Array.from({ length: 21 }, (_, i) => i + 10).join(",") }, "shell": { IN_EDGES: "5;rm" },
    "commit 0": { IN_COMMITS: "0,5" }, "commit text": { IN_COMMITS: "a" }, "nine commits": { IN_COMMITS: "1,2,3,4,5,6,7,8,9" },
    "library L2": { IN_LIBRARY: "L2" }, "width 0": { IN_WIDTH: "0" }, "width 201": { IN_WIDTH: "201" }, "lambda 11": { IN_LAMBDA: "11" },
    "ref_width 0": { IN_REF_WIDTH: "0" }, "ref_width 401": { IN_REF_WIDTH: "401" }, "ref_width text": { IN_REF_WIDTH: "wide" }, "ref_width shell": { IN_REF_WIDTH: "5;ls" },
    "deadline 29": { IN_DEADLINE: "29" }, "deadline 321": { IN_DEADLINE: "321" }, "deadline 345": { IN_DEADLINE: "345" },
  };
  for (const [name, inp] of Object.entries(bad)) assert.notEqual(validate(inp).status, 0, name);
  for (const ok of [{ IN_DEADLINE: "30" }, { IN_DEADLINE: "320" }, { IN_EDGES: "2,205" }, { IN_REF_WIDTH: "80" }, { IN_REF_WIDTH: "400" }]) assert.equal(validate(ok).status, 0, JSON.stringify(ok));
});
test("the default edge list is the selection of the research README (ten edges, two per job)", () => {
  assert.ok(text.includes('        default: "87,62,54,22,77,74,193,203,166,159"'));
  assert.ok(text.includes("the selection of the research README is 87,62,54,22,77,74,193,203,166,159"));
  assert.ok(text.includes('        default: "1,10,30,60"'));
});

test("measure: the exit code is read from PIPESTATUS and decides the job; the script path, the reference width and the checkout are exact", () => {
  const run = runBlock(jobBlock("measure"), "Measure");
  assert.ok(run.includes("rc=${PIPESTATUS[0]}"), "rc from PIPESTATUS (a pipe to tee hides the exit code of the script otherwise)");
  assert.ok(!/rc=\$\?/.test(run));
  assert.ok(run.trimEnd().split("\n").at(-1) === '[ "$rc" = 0 ]', "the last line fails the job when the measurement failed");
  assert.ok(run.includes('bash "src/research/calendar-7x7/row1-window-chain/run_reroot_measure.sh" "$out" "$IDS"'));
  assert.ok(run.includes('${REF_WIDTH:+ref_width="$REF_WIDTH"}'));
  assert.ok(run.includes('commits="$COMMITS" library="$LIBRARY" width="$WIDTH" lambda="$LAMBDA"'));
  const b = jobBlock("measure").join("\n");
  assert.ok(b.includes("          repository: ${{ github.repository }}\n          ref: ${{ inputs.research_ref }}\n          path: src\n"));
  assert.ok(!/^\s+ref: (main|refs\/heads\/main)\s*$/m.test(text));
  assert.equal((text.match(/ref: \$\{\{ inputs\.research_ref \}\}/g) ?? []).length, 1);
  assert.ok(b.includes("      REF_WIDTH: ${{ inputs.ref_width }}"));
});
test("prepare: every required file is checked and a missing one stops the run", () => {
  const run = runBlock(jobBlock("prepare"), "Check research commit");
  const want = ["measure_edges.jl", "reroot_measure_lib.jl", "run_reroot_measure.sh", "window_chain_lib.jl", "evidence/reroot-measure/SHA256SUMS", "evidence/reroot-measure/chain-2019-01-2036-01.moves.tsv",
    "research/calendar-7x7/upright-beam/beam2.jl", "research/calendar-7x7/global-search/search.jl"];
  const loop = run.match(/for f in ([\s\S]*?); do\n/)[1];
  for (const w of want) assert.ok(loop.includes(w), w);
  assert.ok(run.includes('git cat-file -e "$SHA:$f" 2>/dev/null || { echo "::error::$f is missing at $SHA"; missing=1; }'));
  assert.ok(run.includes('[ "$missing" = 0 ] || fail "research commit lacks required files"'));
  assert.ok(run.includes('git grep -qw ref_width "$SHA" -- "$WC/measure_edges.jl" || fail'));
  assert.ok(run.includes('git grep -qw BEAMLOG "$SHA" -- research/calendar-7x7/upright-beam/beam2.jl || fail'));
});
test("no workflow expression is expanded inside a run script (inputs reach scripts only through env)", () => {
  let inRun = false, n = 0;
  for (const l of lines) {
    if (/^\s+run: \|$/.test(l)) { inRun = true; n++; continue; }
    if (inRun && l !== "" && !/^ {10}/.test(l)) inRun = false;
    if (inRun) assert.ok(!l.includes("${{"), l);
  }
  assert.ok(n >= 3);
  assert.ok(!/inputs\.edges/.test(runBlock(jobBlock("measure"), "Measure")));
});
test("ref_width is an optional input with an empty default and a research_ref hint", () => {
  assert.ok(text.includes('      ref_width:\n') && /ref_width:\n(.*\n){2}\s+default: ""/.test(text));
  assert.ok(text.includes("research/cube-display-feasibility; not a PR branch commit, not a main commit"));
});
