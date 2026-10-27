import {sha256} from "./crypto.ts";
export {sha256,requireWebCrypto} from "./crypto.ts";
import {
  deepFreeze,
  demand,
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
/** Pure schema and JSON transport implementation is owned by ReScript. */
import * as Assets from "../res/PwAssets.res.mjs";
export const ASSET_LIMITS = Assets.limits;
export const safeAssetPath = Assets.safeAssetPath;
export function validateAssets(raw: unknown, prints: readonly PrintDefinition[] = []): AssetManifest {
  return Assets.validateAssets(raw, prints);
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
/** Deployment prefix changes transport only; canonical manifest URLs and hashes stay intact. */
export function deploymentBasePath(basePath: string): string {
  demand(
    typeof basePath === "string" &&
      basePath.length <= 256 &&
      /^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath),
    "Invalid asset base path",
  );
  return basePath;
}
export function assetTransportPath(path: string, basePath = "/"): string {
  return deploymentBasePath(basePath) + safeAssetPath(path).slice(1);
}
async function fetchBounded(
  path: string,
  expected: string,
  kind: "svg" | "png" | "webp" | "woff2",
  budget: { bytes: number },
  signal?: AbortSignal,
  basePath = "/",
): Promise<Uint8Array> {
  const response = await fetch(assetTransportPath(path, basePath), {
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
  demand((await sha256(bytes)) === expected, "Asset integrity check failed");
  return bytes;
}
export async function loadAssets(
  raw: unknown,
  prints: readonly PrintDefinition[],
  signal?: AbortSignal,
  basePath = "/",
): Promise<LoadedAssets> {
  basePath = deploymentBasePath(basePath);
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
        basePath,
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
          basePath,
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
/** ReScript-owned lossless JSON codec; Promise shape retained for consumers. */
export const serializeDesignState = Assets.serializeDesignState;
export async function parseDesignState(text: string): Promise<{print: PrintDefinition; state: import("@cubistry/cube-core").CubeState; assets: AssetManifest}> {
  return Assets.parseDesignState(text);
}
