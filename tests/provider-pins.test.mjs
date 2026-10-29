import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("provider source pins, npm lock and prepared artifact integrities agree", () => {
  const lock = JSON.parse(readFileSync("package-lock.json"));
  for (const [sourceFile, archive] of [
    ["puzlwerk-source.json", "solver-2x2.tgz"],
    ["puzlwerk-picture-source.json", "solver-3x3-picture.tgz"],
  ]) {
    const source = JSON.parse(readFileSync(sourceFile));
    const dependency = lock.packages[`node_modules/${source.package}`];
    assert.equal(dependency.version, source.version, source.package);
    assert.equal(dependency.resolved, `file:.puzlwerk-dependency/${archive}`);
    assert.equal(dependency.integrity, source.integrity, source.package);
    const bytes = readFileSync(`.puzlwerk-dependency/${archive}`);
    const actual =
      "sha512-" + createHash("sha512").update(bytes).digest("base64");
    assert.equal(actual, dependency.integrity, archive);
  }
});
