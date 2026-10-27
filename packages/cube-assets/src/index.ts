import {
  deepFreeze,
  demand,
  identifier,
  record,
  validatePrint,
  validateState,
  type PrintDefinition,
} from "@cubistry/cube-core";
export interface FontAsset {
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
  readonly family: string;
  readonly weight: number;
  readonly format: "woff2";
  readonly license: string;
}
export interface Material {
  readonly id: string;
  readonly color: string;
  readonly roughness: number;
}
export interface TextDocument {
  readonly id: string;
  readonly text: string;
  readonly fontId: string;
  readonly color: string;
  readonly background: string;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly minFontSize: number;
  readonly lineHeight: number;
}
export type ImageAsset =
  | { readonly id: string; readonly kind: "color"; readonly color: string }
  | {
      readonly id: string;
      readonly kind: "image";
      readonly format: "svg" | "png" | "webp";
      readonly url: string;
      readonly sha256: string;
    }
  | {
      readonly id: string;
      readonly kind: "text";
      readonly documentId: string;
      readonly crop: readonly [number, number, number, number];
    };
export interface AssetManifest {
  readonly schema: "cubistry.assets";
  readonly version: 1;
  readonly fonts: readonly FontAsset[];
  readonly materials: readonly Material[];
  readonly documents: readonly TextDocument[];
  readonly images: readonly ImageAsset[];
}
export interface LoadedAssets {
  readonly textureOrigin: "bottom-left";
  readonly manifest: AssetManifest;
  readonly images: ReadonlyMap<string, ImageBitmap>;
  readonly materials: ReadonlyMap<string, Material>;
  readonly dispose: () => void;
}
export const ASSET_LIMITS = deepFreeze({
  count: 64,
  bytesPerFile: 262144,
  totalBytes: 4194304,
  pixelsPerSide: 1024,
  decodedPixels: 8388608,
  textCodePoints: 512,
  timeoutMs: 10000,
});
const color = (s: unknown): s is string =>
  typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
const hash = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
export function safeAssetPath(value: unknown): string {
  demand(
    typeof value === "string" &&
      value.length <= 256 &&
      /^\/[A-Za-z0-9_/-]+\.(svg|png|webp|woff2)$/.test(value) &&
      !value.includes("//") &&
      !value.split("/").includes(".."),
    "Asset URL must be a bounded same-origin static path",
  );
  return value;
}
const unique = (items: readonly { id: string }[], name: string) =>
  demand(
    new Set(items.map((i) => i.id)).size === items.length,
    `Duplicate ${name} ID`,
  );
export function validateAssets(
  raw: unknown,
  prints: readonly PrintDefinition[] = [],
): AssetManifest {
  const a = record(raw, "assets");
  demand(
    a.schema === "cubistry.assets" && a.version === 1,
    "Unsupported asset schema/version",
  );
  for (const k of ["fonts", "materials", "documents", "images"])
    demand(
      Array.isArray(a[k]) && (a[k] as unknown[]).length <= ASSET_LIMITS.count,
      `Invalid ${k} list`,
    );
  for (const raw of a.fonts as unknown[]) {
    const f = record(raw, "font");
    demand(
      identifier(f.id) &&
        f.format === "woff2" &&
        hash(f.sha256) &&
        typeof f.family === "string" &&
        /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(f.family) &&
        Number.isInteger(f.weight) &&
        Number(f.weight) >= 100 &&
        Number(f.weight) <= 900 &&
        typeof f.license === "string" &&
        f.license.length <= 128,
      "Invalid font metadata",
    );
    demand(safeAssetPath(f.url).endsWith(".woff2"), "Font URL/format mismatch");
  }
  for (const raw of a.materials as unknown[]) {
    const m = record(raw, "material");
    demand(
      identifier(m.id) &&
        color(m.color) &&
        typeof m.roughness === "number" &&
        Number.isFinite(m.roughness) &&
        m.roughness >= 0 &&
        m.roughness <= 1,
      "Invalid material",
    );
  }
  const fonts = new Set((a.fonts as FontAsset[]).map((f) => f.id));
  for (const raw of a.documents as unknown[]) {
    const d = record(raw, "text document");
    demand(
      identifier(d.id) &&
        typeof d.text === "string" &&
        Array.from(d.text).length <= ASSET_LIMITS.textCodePoints &&
        d.text.split("\n").length <= 16 &&
        identifier(d.fontId) &&
        fonts.has(d.fontId) &&
        color(d.color) &&
        color(d.background),
      "Invalid text/font reference",
    );
    for (const k of [
      "width",
      "height",
      "fontSize",
      "minFontSize",
      "lineHeight",
    ])
      demand(
        Number.isInteger(d[k]) &&
          Number(d[k]) > 0 &&
          Number(d[k]) <= ASSET_LIMITS.pixelsPerSide,
        `Invalid text ${k}`,
      );
    demand(
      Number(d.minFontSize) <= Number(d.fontSize),
      "Invalid text font-size range",
    );
  }
  const documents = new Map(
    (a.documents as TextDocument[]).map((d) => [d.id, d]),
  );
  for (const raw of a.images as unknown[]) {
    const i = record(raw, "image");
    demand(identifier(i.id), "Invalid image ID");
    if (i.kind === "color") demand(color(i.color), "Invalid flat image color");
    else if (i.kind === "image") {
      demand(
        typeof i.format === "string" &&
          ["svg", "png", "webp"].includes(i.format) &&
          hash(i.sha256),
        "Unsupported image format or missing integrity hash",
      );
      demand(
        safeAssetPath(i.url).endsWith("." + i.format),
        "Image URL/format mismatch",
      );
    } else if (i.kind === "text") {
      demand(identifier(i.documentId), "Invalid text-document reference type");
      const d = documents.get(i.documentId);
      demand(
        d &&
          Array.isArray(i.crop) &&
          i.crop.length === 4 &&
          i.crop.every(Number.isInteger),
        "Invalid text image reference/crop",
      );
      const [x, y, w, h] = i.crop;
      demand(
        x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          x + w <= d.width &&
          y + h <= d.height,
        "Text crop exceeds document",
      );
    } else throw Error("Unsupported asset kind");
  }
  const typed = a as unknown as AssetManifest;
  for (const [name, list] of [
    ["font", typed.fonts],
    ["material", typed.materials],
    ["document", typed.documents],
    ["image", typed.images],
  ] as const)
    unique(list, name);
  const ids = new Set(typed.images.map((i) => i.id)),
    materials = new Set(typed.materials.map((i) => i.id));
  for (const p of prints)
    for (const s of p.stickers)
      demand(
        ids.has(s.assetId) && materials.has(s.materialId),
        "Unresolved physical sticker asset/material",
      );
  return deepFreeze(structuredClone(typed));
}
const allowedTags = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
]);
const allowedAttrs = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "d",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "transform",
]);
export function validateSvg(text: string): void {
  demand(
    text.length <= ASSET_LIMITS.bytesPerFile &&
      !/<!|<\?|\b(?:script|foreignObject)\b/i.test(text),
    "Unsafe SVG declaration/content",
  );
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  demand(
    doc.documentElement.localName === "svg" &&
      !doc.querySelector("parsererror"),
    "Malformed SVG",
  );
  for (const el of doc.querySelectorAll("*")) {
    demand(
      allowedTags.has(el.localName) &&
        el.namespaceURI === "http://www.w3.org/2000/svg",
      "Unsupported SVG element",
    );
    for (const a of el.attributes) {
      demand(
        (allowedAttrs.has(a.name) &&
          !/[\\\x00-\x1f\x7f]/.test(a.value) &&
          !/(?:url\s*\(|javascript:|data:|https?:|@)/i.test(a.value)) ||
          (a.name === "xmlns" && a.value === "http://www.w3.org/2000/svg"),
        "Unsafe SVG attribute",
      );
    }
  }
  const w = Number(doc.documentElement.getAttribute("width")),
    h = Number(doc.documentElement.getAttribute("height"));
  demand(
    Number.isInteger(w) &&
      Number.isInteger(h) &&
      w > 0 &&
      h > 0 &&
      w <= 1024 &&
      h <= 1024,
    "SVG needs bounded numeric dimensions",
  );
}
function rasterDimensions(
  bytes: Uint8Array,
  format: "png" | "webp",
): readonly [number, number] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === "png") {
    demand(
      bytes.length >= 24 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n),
      "Invalid PNG signature",
    );
    return [v.getUint32(16), v.getUint32(20)];
  }
  const ascii = (a: number, b: number) =>
    new TextDecoder().decode(bytes.slice(a, b));
  demand(
    bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "Invalid WebP signature",
  );
  const kind = ascii(12, 16);
  if (kind === "VP8X")
    return [
      1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536,
      1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536,
    ];
  if (kind === "VP8L") {
    demand(bytes[20] === 47, "Invalid lossless WebP");
    return [
      1 + bytes[21] + (bytes[22] & 63) * 256,
      1 + (bytes[22] >> 6) + bytes[23] * 4 + (bytes[24] & 15) * 1024,
    ];
  }
  demand(
    kind === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42,
    "Unsupported WebP encoding",
  );
  return [v.getUint16(26, true) & 16383, v.getUint16(28, true) & 16383];
}
function canvas(w = 256, h = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  demand(ctx, "2D image context unavailable");
  return ctx;
}
async function digest(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function fetchBounded(
  path: string,
  expected: string,
  kind: "svg" | "png" | "webp" | "woff2",
  budget: { bytes: number },
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(safeAssetPath(path), {
    signal,
    redirect: "error",
    credentials: "same-origin",
  });
  demand(response.ok, "Asset could not be loaded");
  const mime = (response.headers.get("content-type") || "").split(";")[0];
  demand(
    mime ===
      {
        svg: "image/svg+xml",
        png: "image/png",
        webp: "image/webp",
        woff2: "font/woff2",
      }[kind],
    "Unexpected asset content type",
  );
  const declared = Number(response.headers.get("content-length") || 0);
  demand(
    declared <= ASSET_LIMITS.bytesPerFile,
    "Asset content length exceeds limit",
  );
  demand(response.body, "Asset body unavailable");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      budget.bytes += value.length;
      demand(
        length <= ASSET_LIMITS.bytesPerFile &&
          budget.bytes <= ASSET_LIMITS.totalBytes,
        "Asset byte limit exceeded",
      );
      parts.push(value);
    }
  } catch (e) {
    await reader.cancel();
    throw e;
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  demand((await digest(bytes)) === expected, "Asset integrity check failed");
  return bytes;
}
export async function loadAssets(
  raw: unknown,
  prints: readonly PrintDefinition[],
  signal?: AbortSignal,
): Promise<LoadedAssets> {
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(ASSET_LIMITS.timeoutMs)])
    : AbortSignal.timeout(ASSET_LIMITS.timeoutMs);
  const manifest = validateAssets(raw, prints),
    images = new Map<string, ImageBitmap>(),
    materials = new Map(manifest.materials.map((m) => [m.id, m])),
    budget = { bytes: 0 };
  let pixels = 0;
  const reserve = (w: number, h: number) => {
    pixels += w * h;
    demand(
      pixels <= ASSET_LIMITS.decodedPixels,
      "Decoded image pixel budget exceeded",
    );
  };
  const fontFamilies = new Map<string, string>(),
    texts = new Map<string, HTMLCanvasElement>(),
    fontFaces: FontFace[] = [];
  try {
    for (const f of manifest.fonts) {
      const bytes = await fetchBounded(
        f.url,
        f.sha256,
        "woff2",
        budget,
        signal,
      );
      demand(
        new TextDecoder().decode(bytes.slice(0, 4)) === "wOF2",
        "Invalid WOFF2 signature",
      );
      const family = "Cubistry_" + f.sha256.slice(0, 16);
      const face = new FontFace(family, new Uint8Array(bytes).buffer, {
        weight: String(f.weight),
      });
      await face.load();
      document.fonts.add(face);
      fontFaces.push(face);
      fontFamilies.set(f.id, family);
    }
    for (const d of manifest.documents) {
      reserve(d.width, d.height);
      const c = canvas(d.width, d.height),
        ctx = context(c),
        weight = manifest.fonts.find((f) => f.id === d.fontId)!.weight;
      ctx.fillStyle = d.background;
      ctx.fillRect(0, 0, d.width, d.height);
      const lines = d.text.trim().split("\n");
      let size = d.fontSize;
      while (size > d.minFontSize) {
        ctx.font = `${weight} ${size}px "${fontFamilies.get(d.fontId)}"`;
        if (lines.every((l) => ctx.measureText(l).width <= d.width - 48)) break;
        size--;
      }
      ctx.font = `${weight} ${size}px "${fontFamilies.get(d.fontId)}"`;
      demand(
        lines.every((l) => ctx.measureText(l).width <= d.width - 48),
        "This label is too wide for the fixed print. Please shorten it.",
      );
      ctx.fillStyle = d.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((l, i) =>
        ctx.fillText(
          l,
          d.width / 2,
          d.height / 2 +
            (i - (lines.length - 1) / 2) * ((d.lineHeight * size) / d.fontSize),
        ),
      );
      texts.set(d.id, c);
    }
  } finally {
    for (const f of fontFaces) document.fonts.delete(f);
  }
  try {
    for (const asset of manifest.images) {
      let c: HTMLCanvasElement;
      if (asset.kind === "color") {
        reserve(256, 256);
        c = canvas();
        const ctx = context(c);
        ctx.fillStyle = asset.color;
        ctx.fillRect(0, 0, c.width, c.height);
      } else if (asset.kind === "text") {
        const doc = texts.get(asset.documentId)!;
        const [x, y, w, h] = asset.crop;
        reserve(w, h);
        c = canvas(w, h);
        context(c).drawImage(doc, x, y, w, h, 0, 0, w, h);
      } else {
        const bytes = await fetchBounded(
          asset.url,
          asset.sha256,
          asset.format,
          budget,
          signal,
        );
        if (asset.format === "svg")
          validateSvg(new TextDecoder().decode(bytes));
        else {
          const [w, h] = rasterDimensions(bytes, asset.format);
          demand(
            w > 0 &&
              h > 0 &&
              w <= ASSET_LIMITS.pixelsPerSide &&
              h <= ASSET_LIMITS.pixelsPerSide,
            "Raster dimensions exceed limit",
          );
        }
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes).buffer], {
            type:
              "image/" + (asset.format === "svg" ? "svg+xml" : asset.format),
          }),
        );
        try {
          const image = new Image();
          await new Promise<void>((ok, no) => {
            image.onload = () => ok();
            image.onerror = () => no(Error("Image decode failed"));
            image.src = url;
          });
          demand(
            image.width > 0 &&
              image.height > 0 &&
              image.width <= 1024 &&
              image.height <= 1024,
            "Decoded image exceeds bounds",
          );
          reserve(image.width, image.height);
          c = canvas(image.width, image.height);
          context(c).drawImage(image, 0, 0);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      reserve(c.width, c.height);
      images.set(
        asset.id,
        await createImageBitmap(c, { imageOrientation: "flipY" }),
      );
    }
  } catch (e) {
    for (const image of images.values()) image.close();
    throw e;
  }
  const readonlyMap = <K, V>(m: Map<K, V>): ReadonlyMap<K, V> => {
    const view: ReadonlyMap<K, V> = Object.freeze({
      get size() {
        return m.size;
      },
      get: (k: K) => m.get(k),
      has: (k: K) => m.has(k),
      entries: () => m.entries(),
      keys: () => m.keys(),
      values: () => m.values(),
      [Symbol.iterator]: () => m[Symbol.iterator](),
      forEach: (fn: (v: V, k: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) =>
        m.forEach((v, k) => fn.call(thisArg, v, k, view)),
    });
    return view;
  };
  return Object.freeze({
    textureOrigin: "bottom-left",
    manifest,
    images: readonlyMap(images),
    materials: readonlyMap(materials),
    dispose: () => {
      for (const image of images.values()) image.close();
    },
  });
}
/** Lossless physical JSON transport. Color-facelet codecs are not substituted. */
export function serializeDesignState(
  print: PrintDefinition,
  state: import("@cubistry/cube-core").CubeState,
  assets: AssetManifest,
): string {
  print = validatePrint(print);
  state = validateState(state, print);
  assets = validateAssets(assets, [print]);
  return JSON.stringify({
    schema: "cubistry.design-state",
    version: 1,
    print,
    state,
    assets,
  });
}
export async function parseDesignState(
  text: string,
): Promise<{
  print: PrintDefinition;
  state: import("@cubistry/cube-core").CubeState;
  assets: AssetManifest;
}> {
  demand(text.length <= 2097152, "Design-state JSON exceeds limit");
  const raw = record(JSON.parse(text), "design-state");
  demand(
    raw.schema === "cubistry.design-state" && raw.version === 1,
    "Unsupported design-state schema/version",
  );
  const print = validatePrint(raw.print),
    state = validateState(raw.state, print),
    assets = validateAssets(raw.assets, [print]);
  return deepFreeze({ print, state, assets });
}
