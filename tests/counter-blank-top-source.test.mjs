// Provenance of the blank-top Counter variant: byte pins of the research
// copies, the derived runtime, and negative controls for the derivation.
// These are app regression tests, not proofs; the native Julia and Flix
// checkers on the research branch are the authority for the print and routes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  deriveRuntime,
  derivePrinting,
  deriveMode,
  parseTsv,
  serialize,
  inverseWord,
  PINNED_COMMIT,
} from "../scripts/counter-blank-top.mjs";
import { exportNet } from "../scripts/export-counter-blank-top-net.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pin = JSON.parse(readFileSync("counter-blank-top-source.json", "utf8"));
const canonical = JSON.parse(readFileSync(pin.canonicalSource.path, "utf8")).prints.padded;
const files = Object.fromEntries(
  Object.keys(pin.appCopies).map((copy) => [
    copy.slice("data/counter/blank-top/".length),
    readFileSync(copy, "utf8"),
  ]),
);

test("the blank-top copies are pinned to the research commit", () => {
  assert.equal(pin.repository, "https://github.com/wstein/cubistry");
  assert.equal(pin.branch, "research/counter-99-blank-top");
  assert.equal(pin.commit, "22fe5842c4c59e54789c865914e70abb7cfcb24c");
  assert.equal(PINNED_COMMIT, pin.commit);
  for (const [copy, research] of Object.entries(pin.appCopies)) {
    assert.ok(research.startsWith(pin.researchRoot + "/evidence/"), research);
    assert.match(pin.researchFiles[research], /^[0-9a-f]{64}$/);
    assert.equal(sha(readFileSync(copy)), pin.researchFiles[research], copy);
  }
  // Both native checkers emit byte-identical receipts per mode.
  for (const mode of ["lz", "nz"])
    assert.equal(
      pin.researchFiles[`${pin.researchRoot}/evidence/receipt-julia-${mode}.tsv`],
      pin.researchFiles[`${pin.researchRoot}/evidence/receipt-flix-${mode}.tsv`],
    );
  assert.match(pin.reviewStatus, /UNKNOWN/);
});

test("the runtime file is the current derivation of the copies", () => {
  const text = serialize(deriveRuntime(files, canonical));
  assert.equal(readFileSync(pin.runtimePath, "utf8"), text);
  assert.equal(sha(text), pin.runtimeSHA256);
  const runtime = JSON.parse(text);
  assert.deepEqual(
    runtime.modes.map((m) => [m.mode, m.totalHTM, m.maximumHTM, m.setupHTM]),
    [
      ["lz", 278, 4, 0],
      ["nz", 270, 4, 6],
    ],
  );
  assert.deepEqual(runtime.modeSwitch, {
    from: "lz",
    to: "nz",
    value: 0,
    word: "L' U B' U L2 U",
    htm: 6,
  });
});

test("the runtime keeps the canonical source identities and research artwork", () => {
  const runtime = deriveRuntime(files, canonical);
  const research = parseTsv(files["print.tsv"]);
  runtime.printing.forEach((s, i) => {
    const source = canonical.stickers[i];
    const cubie = canonical.cubies.find((c) => c.id === source.cubie);
    assert.deepEqual([s.id, s.cubie, s.p, s.n], [source.id, source.cubie, cubie.position, source.normal]);
    const r = research[s.researchSticker];
    assert.equal(r.position, s.p.join(","));
    assert.equal(r.normal, s.n.join(","));
    assert.equal(r.artwork, s.image);
    if (r.up !== "-") assert.equal(r.up, s.up.join(","));
  });
  assert.equal(new Set(runtime.printing.map((s) => s.researchSticker)).size, 24);
});

test("derivation rejects damaged research rows", () => {
  const rows = (name) => parseTsv(files[name]);
  const lz = () => rows("routes-lz.tsv");
  const setupLz = rows("setup-lz.tsv");
  const controls = [
    (r) => (r[5].decrement = r[5].increment),
    (r) => (r[7].inc_htm = "2"),
    (r) => (r[9].increment = "X"),
    (r) => r.pop(),
    (r) => (r[99].to = "100"),
  ];
  for (const mutate of controls) {
    const r = lz();
    mutate(r);
    assert.throws(() => deriveMode("lz", r, setupLz));
  }
  const print = rows("print.tsv");
  for (const mutate of [
    (p) => (p[7].artwork = "5"), // a fifth glyph 5, one blank fewer
    (p) => (p[7].up = "0,0,1"), // blank carrying an up vector
    (p) => (p[0].normal = "0,0,1"), // sticker off its corner frame
  ]) {
    const p = structuredClone(print);
    mutate(p);
    assert.throws(() => derivePrinting(p, canonical));
  }
  assert.throws(() =>
    deriveRuntime({ ...files, "setup-lz.tsv": "mode\tsetup\thtm\nlz\tR\t1\n" }, canonical),
  );
});

test("inverse words undo every turn in reverse order", () => {
  assert.equal(inverseWord("L' U B' U L2 U"), "U' L2 U' B U' L");
  assert.equal(inverseWord(inverseWord("B' U R' U'")), "B' U R' U'");
});

test("the committed sticker net is the current export of the runtime print", () => {
  const svg = exportNet();
  assert.equal(readFileSync("public/print/counter-blank-top/net.svg", "utf8"), svg);
  const stickers = [...svg.matchAll(/data-face="([UDLRFB])" data-image="([^"]+)"/g)];
  assert.equal(stickers.length, 24);
  assert.equal(stickers.filter((m) => m[2] === "blank").length, 4);
  // The printed state shows 00 with blank upper cells on the front face.
  assert.deepEqual(
    stickers.filter((m) => m[1] === "F").map((m) => m[2]).sort(),
    ["0", "0", "blank", "blank"],
  );
  assert.doesNotMatch(svg, /<(script|image|foreignObject)/);
});
