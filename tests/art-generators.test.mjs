import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diffAgainst, generateAll, missingOutputs } from "../scripts/check-art-generators.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const gen = generateAll();
const { files, generators } = gen;

test("every picture-art generator is deterministic and reproduces the committed files", () => {
  assert.ok(generators.length >= 8, "generators found");
  assert.ok(files.size > 100, "files generated");
  assert.deepEqual(diffAgainst(files), []);
  assert.deepEqual(missingOutputs(gen), []);
});

test("theme manifests and face tables match the committed SVGs", () => {
  // Themes with a generated table; pastel and playground have their own generators and are covered above.
  const ids = readdirSync(join(repo, "src/apps/playground/theme-assets")).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3)).sort();
  assert.ok(ids.length >= 7, "theme ids found");
  const r = spawnSync(process.execPath, ["scripts/build-playground-theme.mjs", "--check", ...ids], { cwd: repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("negative control: a changed SVG or manifest is reported", () => {
  const changed = new Map(files);
  changed.set("public/playground-martin/F.svg", Buffer.from(changed.get("public/playground-martin/F.svg") + " "));
  assert.deepEqual(diffAgainst(changed), ["public/playground-martin/F.svg"]);
  const tmp = mkdtempSync(join(tmpdir(), "art-neg-"));
  try {
    const rel = "public/playground-pastel/manifest.json";
    mkdirSync(dirname(join(tmp, rel)), { recursive: true });
    cpSync(join(repo, rel), join(tmp, rel));
    const one = new Map([[rel, files.get(rel)]]);
    assert.deepEqual(diffAgainst(one, tmp), []);
    one.set(rel, Buffer.from(one.get(rel).toString().replace("sha256", "sha257")));
    assert.deepEqual(diffAgainst(one, tmp), [rel]);
    assert.deepEqual(diffAgainst(new Map([["public/playground-pastel/none.svg", Buffer.from("x")]]), tmp), ["public/playground-pastel/none.svg"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("negative control: a generator that writes nothing or misses a face is reported", () => {
  const silent = { ...gen, perGenerator: { ...gen.perGenerator, "build-easter-art.mjs": 0 } };
  assert.deepEqual(missingOutputs(silent), ["build-easter-art.mjs wrote no files"]);
  const files2 = new Map(files);
  files2.delete("public/playground-easter/F.svg");
  assert.deepEqual(missingOutputs({ ...gen, files: files2 }), ["not generated: public/playground-easter/F.svg"]);
});
