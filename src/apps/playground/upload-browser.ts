// User pictures, the browser part: reading files, decoding and resampling PNG, sanitizing SVG and
// cutting a net into six faces. Everything runs locally; nothing is sent anywhere. PNG faces are
// always decoded and drawn again onto a fresh canvas, so the kept bytes are a clean re-encoding
// without metadata chunks; SVG faces are the sanitizer's output (cube-assets/svg-sanitize.ts) and
// are only ever shown through <img> elements with blob URLs, never inlined into the page.
import { sanitizeSvg } from "@cubistry/cube-assets";
import { cutSvgNet, prepareSvgFace, type SvgFaceResult, type SvgJob, type SvgJobReply, type SvgNetResult } from "./svg-faces.ts";
import { FACE_IDS, type FaceId } from "./themes.ts";
import {
  UPLOAD_LIMITS,
  crossRects,
  isCrossAspect,
  sniffFormat,
  validatePngBytes,
  type PreparedFace,
  type UploadFormat,
} from "./upload.ts";

const SQUARE_TOLERANCE = 0.01;
const isSquare = (w: number, h: number) => w > 0 && h > 0 && Math.abs(w / h - 1) <= SQUARE_TOLERANCE;

async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function toBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((ok, no) =>
    canvas.toBlob((b) => (b ? ok(b) : no(Error("The image could not be encoded."))), type),
  );
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Decodes a PNG and checks the decoded size against its header; the header was already bounded. */
async function decodePng(bytes: Uint8Array, name: string): Promise<ImageBitmap> {
  const [w, h] = validatePngBytes(bytes);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }));
  } catch {
    throw Error(`${name} could not be decoded as a PNG image.`);
  }
  if (bitmap.width !== w || bitmap.height !== h) {
    bitmap.close();
    throw Error(`${name} is not a consistent PNG image.`);
  }
  return bitmap;
}

/** Draws a rectangle of a bitmap onto a new edge x edge canvas and returns the PNG bytes. */
async function pngOfRegion(bitmap: ImageBitmap, rect: readonly [number, number, number, number], edge: number): Promise<Uint8Array> {
  const c = canvasOf(edge, edge),
    ctx = c.getContext("2d");
  if (!ctx) throw Error("2D image context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, rect[0], rect[1], rect[2], rect[3], 0, 0, edge, edge);
  return new Uint8Array(await (await toBlob(c)).arrayBuffer());
}

/** Loads sanitized SVG text in an <img> (blob URL) to confirm that the browser renders it. */
export async function decodeSvgImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => {
      img.onload = () => ok();
      img.onerror = () => no(Error("The SVG could not be rendered."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Longest an SVG may take to check; a file that needs more is refused (the worker is terminated). */
const SVG_CHECK_MS = 8000;

/**
 * Sanitizes and cuts an SVG in a Worker, so that even a file built to be slow cannot freeze the page:
 * after SVG_CHECK_MS the worker is terminated and the file is refused. Without Worker support the same
 * pure code runs inline.
 */
function runSvg(job: SvgJob, name: string): Promise<SvgJobReply & { ok: true }> {
  const fail = (message: string) => Error(`${name} was rejected: ${message}.`);
  if (typeof Worker === "undefined")
    return Promise.resolve().then(() => {
      try {
        return { ok: true as const, result: job.op === "net" ? cutSvgNet(job.text) : prepareSvgFace(job.text) };
      } catch (e) {
        throw fail(e instanceof Error ? e.message : "unreadable SVG");
      }
    });
  return new Promise((ok, no) => {
    const worker = new Worker(new URL("./svg-worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => {
      worker.terminate();
      no(fail("it took too long to check"));
    }, SVG_CHECK_MS);
    const done = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (e: MessageEvent<SvgJobReply>) => {
      done();
      if (e.data.ok) ok(e.data);
      else no(fail(e.data.message));
    };
    worker.onerror = () => {
      done();
      no(fail("it could not be checked"));
    };
    worker.postMessage(job);
  });
}

const svgBytes = (svg: string): PreparedFace => ({
  format: "svg",
  bytes: new TextEncoder().encode(svg),
  size: UPLOAD_LIMITS.workingEdge,
  originalSize: UPLOAD_LIMITS.workingEdge,
});

export interface FileKind {
  readonly format: UploadFormat;
  readonly bytes: Uint8Array;
}

/** Reads a file and decides its format from its content (not its name). */
export async function readPictureFile(file: File): Promise<FileKind> {
  const bytes = await readBytes(file);
  const format = sniffFormat(bytes);
  if (!format) throw Error(`${file.name} is neither a PNG nor an SVG image.`);
  return { format, bytes };
}

/** One face image: PNG or SVG, square. */
export async function prepareFace(file: File): Promise<PreparedFace> {
  const { format, bytes } = await readPictureFile(file);
  if (format === "png") {
    const bitmap = await decodePng(bytes, file.name);
    try {
      if (!isSquare(bitmap.width, bitmap.height))
        throw Error(`${file.name} is ${bitmap.width} × ${bitmap.height}; a face must be square.`);
      const edge = Math.min(bitmap.width, UPLOAD_LIMITS.workingEdge);
      return {
        format: "png",
        bytes: await pngOfRegion(bitmap, [0, 0, bitmap.width, bitmap.height], edge),
        size: edge,
        originalSize: bitmap.width,
      };
    } finally {
      bitmap.close();
    }
  }
  const reply = await runSvg({ op: "face", text: new TextDecoder("utf-8").decode(bytes) }, file.name);
  const result = reply.result as SvgFaceResult;
  if (result.kind === "not-square")
    throw Error(`${file.name} is ${result.width} × ${result.height}; a face must be square.`);
  await decodeSvgImage(result.svg);
  return svgBytes(result.svg);
}

export type NetCut =
  | { readonly kind: "faces"; readonly faces: Readonly<Record<FaceId, PreparedFace>> }
  | { readonly kind: "not-a-cross"; readonly width: number; readonly height: number };

/** One net image in the standard cross layout; reports `not-a-cross` when the aspect is not 4:3. */
export async function prepareNet(file: File): Promise<NetCut> {
  const { format, bytes } = await readPictureFile(file);
  if (format === "png") {
    const bitmap = await decodePng(bytes, file.name);
    try {
      if (!isCrossAspect(bitmap.width, bitmap.height))
        return { kind: "not-a-cross", width: bitmap.width, height: bitmap.height };
      const rects = crossRects(bitmap.width, bitmap.height);
      const faces = {} as Record<FaceId, PreparedFace>;
      for (const f of FACE_IDS) {
        const rect = rects[f],
          side = Math.min(rect[2], rect[3]),
          edge = Math.min(side, UPLOAD_LIMITS.workingEdge);
        faces[f] = { format: "png", bytes: await pngOfRegion(bitmap, rect, edge), size: edge, originalSize: side };
      }
      return { kind: "faces", faces };
    } finally {
      bitmap.close();
    }
  }
  const reply = await runSvg({ op: "net", text: new TextDecoder("utf-8").decode(bytes) }, file.name);
  const result = reply.result as SvgNetResult;
  if (result.kind === "not-a-cross") return { kind: "not-a-cross", width: result.width, height: result.height };
  const faces = {} as Record<FaceId, PreparedFace>;
  for (const f of FACE_IDS) {
    await decodeSvgImage(result.faces[f]);
    faces[f] = svgBytes(result.faces[f]);
  }
  return { kind: "faces", faces };
}

/** Renders SVG text to a PNG blob of the given pixel size through an <img> and a canvas. */
export async function renderSvgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const img = await decodeSvgImage(sanitizeSvg(svg).svg);
  const c = canvasOf(width, height),
    ctx = c.getContext("2d");
  if (!ctx) throw Error("2D image context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return toBlob(c);
}

/** Starts a download of in-memory data without any network request. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
