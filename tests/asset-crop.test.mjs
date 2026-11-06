import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ASSET_LIMITS, loadAssets, validateAssets } from "../packages/cube-assets/src/index.ts";

const manifest = (crop) => ({
  schema: "cubistry.assets",
  version: 1,
  fonts: [],
  documents: [],
  materials: [],
  images: [
    {
      id: "F_0_0",
      kind: "image",
      format: "svg",
      url: "/playground-demo/F.svg",
      sha256: "0".repeat(64),
      ...(crop === undefined ? {} : { crop }),
    },
  ],
});

test("an image asset may name an integer crop rectangle of its source", () => {
  assert.doesNotThrow(() => validateAssets(manifest()));
  assert.doesNotThrow(() => validateAssets(manifest([0, 160, 160, 160])));
  assert.doesNotThrow(() => validateAssets(manifest([46, 46, 45, 46])));
  assert.doesNotThrow(() => validateAssets(manifest([0, 0, 1024, 1024])));
});

test("malformed image crops are rejected", () => {
  for (const crop of [[0, 0, 160], [0, 0, 160, 160, 1], [-1, 0, 160, 160], [0, 0, 0, 160], [0, 0, 160, 0], [0.5, 0, 160, 160], ["0", 0, 160, 160], "0 0 160 160", {}, [0, 0, 1025, 160], [0, 0, 160, 1025]])
    assert.throws(() => validateAssets(manifest(crop)), undefined, JSON.stringify(crop));
});

// A size-7 cube needs 6 * 49 = 294 crops of six whole faces. Crops count apart from whole assets.
const stickers = (faces, n, size) =>
  faces.flatMap((face) =>
    Array.from({ length: n * n }, (_, i) => {
      const row = Math.floor(i / n), col = i % n, edge = (k) => Math.round((k * size) / n);
      return {
        id: `${face}_${row}_${col}`,
        kind: "image",
        format: "svg",
        url: `/x/${face}.svg`,
        sha256: "0".repeat(64),
        crop: [edge(col), edge(row), edge(col + 1) - edge(col), edge(row + 1) - edge(row)],
      };
    }),
  );
const withImages = (images) => ({ ...manifest(), images });

test("crop assets are counted apart from the 64 whole assets, in bounded numbers", () => {
  for (let n = 2; n <= 7; n++) assert.doesNotThrow(() => validateAssets(withImages(stickers([..."FBRLUD"], n, 320))), `n=${n}`);
  const whole = (i) => ({ id: `W_${i}`, kind: "image", format: "svg", url: `/x/W${i}.svg`, sha256: "0".repeat(64) });
  const color = (i) => ({ id: `C_${i}`, kind: "color", color: "#ffffff" });
  assert.doesNotThrow(() => validateAssets(withImages([...Array.from({ length: 64 }, (_, i) => color(i)), ...stickers([..."FBRLUD"], 7, 320)])));
  assert.throws(() => validateAssets(withImages([...Array.from({ length: 65 }, (_, i) => color(i))])));
  assert.throws(() => validateAssets(withImages([...Array.from({ length: 65 }, (_, i) => whole(i)), ...stickers(["F"], 2, 320)])));
  const many = Array.from({ length: 513 }, (_, i) => ({ ...stickers(["F"], 2, 320)[0], id: `F_${i}_0` }));
  assert.throws(() => validateAssets(withImages(many)));
  assert.equal(ASSET_LIMITS.cropCount, 512);
});

// --- loader level: a minimal DOM, network and canvas so loadAssets can run under node ---
function install(files) {
  const saved = {};
  const set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  const fetched = new Map(), draws = [], canvases = [], bitmaps = [];
  set("fetch", async (url) => {
    const path = new URL(url, "http://x").pathname;
    fetched.set(path, (fetched.get(path) ?? 0) + 1);
    return new Response(files[path], { status: 200, headers: { "content-type": "image/svg+xml" } });
  });
  set("DOMParser", class {
    parseFromString(text) {
      const attr = (n) => text.match(new RegExp(`<svg[^>]* ${n}="([^"]*)"`))?.[1] ?? null;
      return { documentElement: { localName: "svg", getAttribute: attr }, querySelector: () => null, querySelectorAll: () => [] };
    }
  });
  const blobs = new Map();
  let ids = 0;
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => { const u = `blob:fake/${ids++}`; blobs.set(u, b); return u; };
  URL.revokeObjectURL = () => {};
  set("Image", class {
    set src(u) {
      blobs.get(u).text().then((t) => {
        this.width = Number(t.match(/ width="(\d+)"/)[1]);
        this.height = Number(t.match(/ height="(\d+)"/)[1]);
        this.onload();
      });
    }
  });
  set("document", {
    fonts: { delete() {} },
    createElement() {
      const c = { width: 0, height: 0, getContext: () => ({ drawImage: (...a) => draws.push({ canvas: c, args: a }) }) };
      canvases.push(c);
      return c;
    },
  });
  set("createImageBitmap", async (c) => { const b = { width: c.width, height: c.height, close() {} }; bitmaps.push(b); return b; });
  return {
    fetched, draws, canvases, bitmaps,
    restore() {
      for (const [k, d] of Object.entries(saved)) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k];
      URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke;
    },
  };
}
const face = (size, tag) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#${tag}"/></svg>`;
const hex = (s) => createHash("sha256").update(s).digest("hex");
async function run(images, files) {
  const env = install(files);
  try {
    const loaded = await loadAssets({ ...manifest(), images }, []);
    return { env, loaded };
  } finally {
    env.restore();
  }
}
const pinned = (list, files) => list.map((i) => ({ ...i, sha256: hex(files[i.url]) }));

test("the loader fetches each crop source once and cuts every sticker from the decoded image", async () => {
  const files = Object.fromEntries([..."FBRLUD"].map((f, i) => [`/x/${f}.svg`, face(320, `00${i}000`)]));
  const images = pinned(stickers([..."FBRLUD"], 2, 320), files);
  const { env, loaded } = await run(images, files);
  assert.equal(loaded.images.size, 24);
  assert.deepEqual([...env.fetched.values()], [1, 1, 1, 1, 1, 1]);
  const cuts = env.draws.filter((d) => d.args.length === 9);
  assert.equal(cuts.length, 24);
  assert.deepEqual(cuts.find((d) => d.args[1] === 160 && d.args[2] === 160).args.slice(1, 5), [160, 160, 160, 160]);
  for (const b of loaded.images.values()) assert.deepEqual([b.width, b.height], [160, 160]);
});

test("the loader accepts a size-7 cut and whole faces up to the 1024 px bound", async () => {
  const files = Object.fromEntries([..."FBRLUD"].map((f, i) => [`/x/${f}.svg`, face(1024, `00${i}000`)]));
  const big = await run(pinned(stickers([..."FBRLUD"], 2, 1024), files), files);
  assert.equal(big.loaded.images.size, 24);
  const small = Object.fromEntries([..."FBRLUD"].map((f, i) => [`/x/${f}.svg`, face(320, `00${i}000`)]));
  const seven = await run(pinned(stickers([..."FBRLUD"], 7, 320), small), small);
  assert.equal(seven.loaded.images.size, 294);
  assert.deepEqual([...seven.env.fetched.values()], [1, 1, 1, 1, 1, 1]);
});

test("a crop outside the decoded image and an exhausted pixel budget are refused", async () => {
  const files = { "/x/F.svg": face(320, "112233") };
  const outside = pinned([{ ...stickers(["F"], 2, 320)[0], crop: [200, 0, 160, 160] }], files);
  await assert.rejects(run(outside, files), /Image crop exceeds the decoded image/);
  // Nine 1024 x 1024 crops of one 1024 px face keep 9 Mpixel alive: more than the 8 Mpixel budget.
  const bigFile = { "/x/F.svg": face(1024, "112233") };
  const crops = Array.from({ length: 9 }, (_, i) => ({ ...stickers(["F"], 2, 320)[0], id: `F_${i}_0`, crop: [0, 0, 1024, 1024] }));
  await assert.rejects(run(pinned(crops, bigFile), bigFile), /Decoded image pixel budget exceeded/);
});
