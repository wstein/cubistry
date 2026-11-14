// node --test test/verify.test.mjs   Checks that the independent verifier accepts real routes and rejects tampered ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { here } from "../lib.mjs";

const run = (file) => spawnSync(process.execPath, [`${here}/verify-routes.mjs`, file], { encoding: "utf8" });
const sample = readFileSync(`${here}/fixtures/results-sample.tsv`, "utf8").split("\n").filter(Boolean);
const dir = mkdtempSync(`${tmpdir()}/fg-verify-`);
const write = (name, lines) => { const f = `${dir}/${name}`; writeFileSync(f, lines.join("\n") + "\n"); return f; };

test("accepts the recorded routes (app pose and own pose)", () => {
  const r = run(`${here}/fixtures/results-sample.tsv`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verified 12 routes with the app engine, failures 0/);
});

test("rejects a route that no longer shows the date", () => {
  const lines = [...sample];
  const f = lines[1].split("\t");
  f[13] = f[13] + " R"; // extra move breaks the visible target
  lines[1] = f.join("\t");
  const r = run(write("tampered.tsv", lines));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /does not show/);
});

test("rejects a wrong move count", () => {
  const lines = [...sample];
  const f = lines[2].split("\t");
  f[7] = String(Number(f[7]) + 1);
  lines[2] = f.join("\t");
  const r = run(write("counts.tsv", lines));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /counts/);
});
