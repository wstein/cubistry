import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { TABLE_URL, TABLE_SHA256 } from "@puzlwerk/solver-2x2";
import { tableLoader, solverFailure } from "../src/apps/playground/solver.ts";
const table = readFileSync(TABLE_URL);
const compressed = gzipSync(table);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

async function gzipServer(t) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/octet-stream",
      "content-encoding": "gzip", "content-length": compressed.length });
    response.end(compressed);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/optimal-2x2.v2.bin`;
  return { url, fetcher: (_url, options) => fetch(url, options) };
}

test("real HTTP gzip transport loads the complete pinned decoded table", async t => {
  const { url, fetcher } = await gzipServer(t);
  const response = await fetch(url), decoded = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.equal(Number(response.headers.get("content-length")), compressed.length);
  assert.notEqual(compressed.length, table.length);
  assert.equal(decoded.length, 1837112);
  assert.equal(hash(decoded), TABLE_SHA256);
  t.diagnostic(`encoded Content-Length=${compressed.length}; decoded bytes=${decoded.length}; SHA-256=${hash(decoded)}`);
  const loaded = await tableLoader(fetcher)();
  assert.deepEqual(loaded, new Uint8Array(table));
});


test("same-length corrupt and wrong-version responses are not cached and retry bypasses stale HTTP cache", async () => {
  for (const corrupt of [bytes => { bytes[bytes.length - 1] ^= 1; },
    bytes => { new DataView(bytes.buffer).setUint32(8, 3, true); }]) {
    const bad = Uint8Array.from(table); corrupt(bad);
    const requests = [];
    const load = tableLoader(async (_url, options) => {
      requests.push(options);
      return new Response(requests.length === 1 ? bad : table);
    });
    await assert.rejects(load(), error => solverFailure(error).code === "Unavailable" && /SHA-256/.test(error.message));
    assert.deepEqual(await load(), new Uint8Array(table));
    assert.equal(requests[0].cache, "default"); assert.equal(requests[1].cache, "reload");
    await load(); assert.equal(requests.length, 2);
  }
});
