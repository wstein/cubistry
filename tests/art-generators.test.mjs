import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diffAgainst, generateAll } from "../scripts/check-art-generators.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const { files, generators } = generateAll();

test("every picture-art generator is deterministic and reproduces the committed files", () => {
  assert.ok(generators.length >= 8, "generators found");
  assert.ok(files.size > 100, "files generated");
  assert.deepEqual(diffAgainst(files), []);
});

test("theme manifests and face tables match the committed SVGs", () => {
  const ids = ["bremen", "christmas", "easter", "halloween", "martin", "seasons", "space"];
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
