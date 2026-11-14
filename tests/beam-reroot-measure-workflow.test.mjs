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
  const env = { ...process.env, GITHUB_OUTPUT: outFile, IN_REF: "a".repeat(40), IN_EDGES: "87,62,54,22,77,74,193,203,166,159", IN_COMMITS: "1,10,30,60", IN_LIBRARY: "L5", IN_WIDTH: "40", IN_LAMBDA: "3", IN_DEADLINE: "300", ...inputs };
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
    "deadline 29": { IN_DEADLINE: "29" }, "deadline 321": { IN_DEADLINE: "321" }, "deadline 345": { IN_DEADLINE: "345" },
  };
  for (const [name, inp] of Object.entries(bad)) assert.notEqual(validate(inp).status, 0, name);
  for (const ok of [{ IN_DEADLINE: "30" }, { IN_DEADLINE: "320" }, { IN_EDGES: "2,205" }]) assert.equal(validate(ok).status, 0, JSON.stringify(ok));
});
test("the default edge list is the selection of the research README (ten edges, two per job)", () => {
  assert.ok(text.includes('        default: "87,62,54,22,77,74,193,203,166,159"'));
  assert.ok(text.includes("the selection of the research README is 87,62,54,22,77,74,193,203,166,159"));
  assert.ok(text.includes('        default: "1,10,30,60"'));
});
