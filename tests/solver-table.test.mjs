import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { TABLE_URL, TABLE_SHA256 } from "@puzlwerk/solver-2x2";
import { createCounterSolver } from "../src/adapters/puzlwerk-2x2.ts";
import { createDesign, scramble, fullGoal } from "../src/apps/playground/model.ts";
import { PlaygroundController } from "../src/apps/playground/controller.ts";
import { stateEquals, validateState } from "@cubistry/cube-core";
import { applyMoves, stickerPoses } from "@cubistry/cube-mechanics";
import { tableLoader, solverFailure } from "../src/apps/playground/solver.ts";
const table = readFileSync(TABLE_URL);
const compressed = gzipSync(table);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function sendGzip(response, bytes = table) {
  const payload = bytes === table ? compressed : gzipSync(bytes);
  response.writeHead(200, { "content-type": "application/octet-stream",
    "content-encoding": "gzip", "content-length": payload.length });
  response.end(payload);
}
async function gzipServer(t, respond = (_request, response) => sendGzip(response)) {
  const requests = [], options = [];
  const server = createServer((request, response) => {
    requests.push(request.url); respond(request, response, requests.length);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/optimal-2x2.v2.bin`;
  return { url, requests, options, fetcher: (_url, init) => { options.push(init); return fetch(url, init); } };
}
function settled(controller, changes) {
  if (!controller.snapshot.busy) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (controller.snapshot.busy) return;
      clearTimeout(timer); changes.delete(check); resolve();
    };
    const timer = setTimeout(() => {
      changes.delete(check);
      reject(Error(`Controller did not settle: ${controller.snapshot.solverStatus}`));
    }, 5000);
    changes.add(check); check();
  });
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


const unavailable = error => solverFailure(error).code === "Unavailable";
for (const [name, fail, message] of [
  ["missing asset", response => { response.writeHead(404); response.end("missing"); }, /HTTP 404/],
  ["truncated decoded table", response => sendGzip(response, table.subarray(0, -1)), /Truncated/],
  ["oversized decoded table", response => sendGzip(response, Buffer.concat([table, Buffer.from([0])])), /decoded size/],
  ["HTML fallback", response => { response.writeHead(200, { "content-type": "text/html; charset=utf-8" }); response.end("<html>wrong route</html>"); }, /HTML/],
  ["missing body", response => { response.writeHead(204); response.end(); }, /no body/],
]) test(`${name} is an unavailable resource, not an invalid cube, and can retry`, async t => {
  const server = await gzipServer(t, (_request, response, count) => count === 1 ? fail(response) : sendGzip(response));
  const load = tableLoader(server.fetcher);
  await assert.rejects(load(), error => unavailable(error) && message.test(error.message));
  assert.deepEqual(await load(), new Uint8Array(table));
  assert.equal(server.requests.length, 2);
  assert.deepEqual(server.options.map(init => init.cache), ["default", "reload"]);
});

test("wrong asset path reports the HTTP resource failure and recovers after the path is corrected", async t => {
  const server = await gzipServer(t, (request, response) => {
    if (request.url === "/optimal-2x2.v2.bin") sendGzip(response);
    else { response.writeHead(404); response.end("unknown asset"); }
  });
  let url = new URL("wrong-path.bin", server.url);
  const load = tableLoader((_source, init) => fetch(url, init));
  await assert.rejects(load(), error => unavailable(error) && /HTTP 404/.test(error.message));
  url = new URL(server.url);
  assert.equal(hash(await load()), TABLE_SHA256);
  assert.deepEqual(server.requests, ["/wrong-path.bin", "/optimal-2x2.v2.bin"]);
});

test("decoded stream limit cancels excess data and failed readers are unavailable even if their message says Invalid", async () => {
  let cancelled = 0;
  const oversized = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(table.length + 1)); },
    cancel() { cancelled++; },
  }));
  await assert.rejects(tableLoader(async () => oversized)(), unavailable);
  assert.equal(cancelled, 1);
  let calls = 0;
  const load = tableLoader(async () => ++calls === 1 ? new Response(new ReadableStream({
    start(controller) { controller.error(Error("Invalid transport framing")); },
  })) : new Response(table));
  await assert.rejects(load(), unavailable);
  assert.equal(hash(await load()), TABLE_SHA256);
  assert.equal(calls, 2);
});

test("real fetch timeout is classified separately and retries can initialize", async t => {
  const server = await gzipServer(t, (_request, response, count) => {
    if (count !== 1) { sendGzip(response); return; }
    const timer = setTimeout(() => sendGzip(response), 4000);
    response.once("close", () => clearTimeout(timer));
  });
  const load = tableLoader(server.fetcher, 1000);
  await assert.rejects(load(), error => solverFailure(error).code === "Timeout");
  assert.equal(hash(await load()), TABLE_SHA256);
});

test("concurrent and repeated classic/Picture initialization shares one authenticated fetch and preserves exact seed44/20 targets", async t => {
  const server = await gzipServer(t), load = tableLoader(server.fetcher);
  const one = load(), two = load(); assert.equal(one, two);
  assert.equal(hash(await one), TABLE_SHA256);
  const designs = [createDesign("classic"), createDesign("picture")];
  const solvers = await Promise.all(designs.map(design => createCounterSolver(design.print, load)));
  for (let i = 0; i < designs.length; i++) {
    const design = designs[i], before = JSON.stringify(design.print);
    const source = applyMoves(design.target, scramble(44, 20));
    validateState(source, design.print); assert.equal(fullGoal(design, source), false);
    const moves = solvers[i].solve(source, design.target), restored = applyMoves(source, moves);
    assert(stateEquals(restored, design.target)); assert(fullGoal(design, restored));
    assert.deepEqual(stickerPoses(design.print, restored), stickerPoses(design.print, design.target));
    const repeat = await createCounterSolver(design.print, load);
    assert.deepEqual(repeat.solve(source, design.target), moves);
    assert.deepEqual(repeat.solve(design.target, design.target), []);
    assert.equal(JSON.stringify(design.print), before);
    t.diagnostic(`${design.style}: seed44/20 exact replay verified in ${moves.length} HTM (no optimality claim)`);
    const invalid = structuredClone(source); invalid.cubies[0].position = [0, 0, 0];
    assert.throws(() => repeat.solve(invalid, design.target), error => solverFailure(error).code === "Invalid");
  }
  assert.equal(hash(await load()), TABLE_SHA256);
  assert.equal(server.requests.length, 1);
});

test("Solve alone initializes; corrupt first load preserves the session, then a healthy retry reaches the full Picture target", async t => {
  const bad = Uint8Array.from(table); bad[100] ^= 1;
  const server = await gzipServer(t, (_request, response, count) => sendGzip(response, count === 1 ? bad : table));
  const load = tableLoader(server.fetcher), design = createDesign("picture");
  let calls = 0;
  const changes = new Set();
  const viewer = { presentedState: null, configure(_print, state) { this.presentedState = state; },
    animate(event) { this.presentedState = event.to; return Promise.resolve(); } };
  const controller = new PlaygroundController(viewer, { design, assets: {} }, () => {
    for (const check of changes) check();
  }, print => {
    calls++; return createCounterSolver(print, load);
  });
  assert.equal(calls, 0); controller.scramble(44, 20); await settled(controller, changes);
  assert.equal(calls, 0); assert.equal(server.requests.length, 0);
  const before = controller.snapshot, printBefore = JSON.stringify(design.print);
  controller.solve(); await settled(controller, changes);
  assert.equal(controller.snapshot.solverStatus, "Unavailable");
  assert.match(controller.snapshot.message, /^Unavailable:.*SHA-256/);
  assert(stateEquals(controller.snapshot.state, before.state));
  assert.equal(controller.snapshot.cursor, 20); assert.equal(controller.snapshot.turns, 20);
  assert.deepEqual(controller.snapshot.history, before.history); assert.equal(controller.snapshot.frozen, false);
  controller.solve(); await settled(controller, changes);
  assert.equal(controller.snapshot.solverStatus, "Verified");
  assert(stateEquals(controller.snapshot.state, design.target));
  assert.deepEqual(stickerPoses(design.print, controller.snapshot.state), stickerPoses(design.print, design.target));
  assert.equal(JSON.stringify(design.print), printBefore); assert.equal(server.requests.length, 2);
  assert.deepEqual(server.options.map(init => init.cache), ["default", "reload"]);
});
