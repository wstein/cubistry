import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("production builds retain exact cubing and bundled WebAssembly dependency notices", () => {
  const output = mkdtempSync(join(tmpdir(), "cubistry-runtime-notices-"));
  try {
    execFileSync(process.execPath, ["scripts/copy-solver-notices.mjs", output]);
    const root = join(output, "licenses/cubing");
    const pin = JSON.parse(readFileSync(join(root, "provenance.json")));
    assert.equal(
      pin.cubingVersion,
      JSON.parse(readFileSync("node_modules/cubing/package.json")).version,
    );
    assert.equal(pin.selectedOriginalCodeLicense, "MPL-2.0");
    for (const file of pin.files)
      assert.equal(
        hash(readFileSync(join(root, file.path))),
        file.sha256,
        file.path,
      );
    const wasm = JSON.parse(
      readFileSync(join(root, "twips-crate-notices.json")),
    );
    assert.equal(wasm.packages.length, 101);
    assert.equal(
      wasm.upstreamCommit,
      "2bde869a68254163a1cf16300d1ce7d98c4f8493",
    );
    for (const p of wasm.packages) {
      assert.match(p.crateSHA256, /^[a-f0-9]{64}$/);
      assert(p.source.startsWith("https://static.crates.io/crates/"));
      for (const file of p.files)
        assert.equal(
          hash(readFileSync(join(root, file.path))),
          file.sha256,
          file.path,
        );
    }
    assert(
      wasm.packages
        .find((p) => p.name === "wasip2")
        .files.some((f) => f.path.includes("wasip2-licenses/")),
    );
    assert(
      readFileSync(join(root, "csTimer-LICENSE"), "utf8").includes(
        "GNU GENERAL PUBLIC LICENSE",
      ),
    );
    assert(
      readFileSync(join(root, "comlink-LICENSE"), "utf8").includes(
        "Apache License",
      ),
    );
    assert(
      readFileSync(join(output, "licenses/puzlwerk/LICENSE"), "utf8").length >
        100,
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("runtime notices remain compatible with the unchanged static artifact extractor", () => {
  const output = mkdtempSync(join(tmpdir(), "cubistry-notices-artifact-"));
  try {
    const site = join(output, "site"),
      archive = join(output, "site.zip"),
      extracted = join(output, "extracted");
    execFileSync(process.execPath, ["scripts/copy-solver-notices.mjs", site]);
    writeFileSync(
      join(site, "index.html"),
      "<!doctype html><html><head></head><body>Notice fixture</body></html>",
    );
    execFileSync("python3", [
      "-c",
      "import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(p,str(p.relative_to(root))) for p in root.rglob('*') if p.is_file()]; z.close()",
      site,
      archive,
    ]);
    execFileSync("python3", ["scripts/pages/extract.py", archive, extracted]);
    assert(
      readFileSync(join(extracted, "licenses/cubing/twips-crate-notices.json"))
        .length > 100,
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
