// Explicit post-build resource audit, not part of the default unit-test glob.
// Usage: node tests/solver-table-assets.mjs dist /cubistry/
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { TABLE_URL, TABLE_SHA256 } from "@puzlwerk/solver-2x2";
import { tableLoader } from "../src/apps/playground/solver.ts";
import { createCounterSolver } from "../src/adapters/puzlwerk-2x2.ts";
import { createDesign, scramble } from "../src/apps/playground/model.ts";
import { applyMoves, stickerPoses } from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
const directory = resolve(process.argv[2] ?? "dist"), base = process.argv[3];
assert(base?.startsWith("/") && base.endsWith("/"), "Supply the emitted deployment base");
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const files = walk(directory), tables = files.filter(path => /[/\\]optimal-2x2.*\.bin$/.test(path));
assert.equal(tables.length, 1, "Exactly one canonical 2×2 table must be packaged");
const path = base + relative(directory, tables[0]).replaceAll("\\", "/");
const references = new Set(files.filter(file => file.endsWith(".js")).flatMap(file =>
  [...readFileSync(file, "utf8").matchAll(/\/[A-Za-z0-9_./-]*assets\/optimal-2x2\.v2-[A-Za-z0-9_-]+\.bin/g)].map(match => match[0])));
assert.deepEqual([...references], [path], "Emitted runtime table URL must match the production/preview base");
const bytes = readFileSync(tables[0]), hash = createHash("sha256").update(bytes).digest("hex");
assert.equal(bytes.length, 1837112); assert.equal(hash, TABLE_SHA256);
const encoded = gzipSync(bytes); let requests = 0;
const server = createServer((request, response) => {
  requests++;
  if (request.url !== path) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "content-type": "application/octet-stream", "content-encoding": "gzip",
    "content-length": encoded.length }); response.end(encoded);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}${path}`;
  const load = tableLoader((source, options) => { assert.equal(String(source), String(TABLE_URL)); return fetch(url, options); });
  const outcomes = [];
  for (const style of ["classic", "picture"]) {
    const design = createDesign(style), from = applyMoves(design.target, scramble(44, 20));
    const solver = await createCounterSolver(design.print, load), moves = solver.solve(from, design.target);
    const restored = applyMoves(from, moves);
    assert(stateEquals(restored, design.target));
    assert.deepEqual(stickerPoses(design.print, restored), stickerPoses(design.print, design.target));
    outcomes.push({ style, seed: 44, scramble: 20, exactReplay: true, moves: moves.length });
  }
  assert.equal(requests, 1);
  console.log(JSON.stringify({ base, runtimeUrl: path, tableCount: tables.length,
    decodedBytes: bytes.length, encodedBytes: encoded.length, sha256: hash, outcomes }));
} finally {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
