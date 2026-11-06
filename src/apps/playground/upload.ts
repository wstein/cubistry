// User pictures, the pure part: limits, file-name assignment, net layout and cutting rectangles,
// PNG header validation, the resolution hint and the assembly of a `FaceSet`. Everything here works
// on bytes and numbers, so it is unit-tested in Node; decoding, resampling and the DOM live in
// upload-browser.ts. An upload produces the same `FaceSet` type as a built-in theme, so slicing,
// the suitability display and rendering never special-case where the pictures came from. All
// processing is local: nothing in this module (or its browser companion) touches the network.
import {
  LOCAL_ASSET_LIMITS,
  LOCAL_ASSET_PREFIX,
  pngDimensions,
  sha256,
  type LocalSources,
} from "@cubistry/cube-assets";
import { FACE_IDS, type FaceId, type FaceSet, type FaceSource } from "./themes.ts";

export const UPLOAD_LIMITS = Object.freeze({
  /** Bytes per uploaded file and for the whole selection. */
  fileBytes: 5 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  /** Files: six faces, or one net. */
  files: 6,
  /** Pixels per side of an uploaded PNG; larger images are refused. */
  pngSide: 4096,
  /** Faces are resampled to at most this edge before they are kept (memory, texture size). */
  workingEdge: 1024,
});
/** Minimum face resolution advice: pixels per sticker edge. */
export const MIN_PIXELS_PER_STICKER = 100;
export const UPLOAD_SET_ID = "upload";
export const UPLOAD_SET_NAME = "Your pictures";

export type UploadFormat = "png" | "svg";

/** Face letter of a file name such as `F.png`, `b.SVG`; null when the name does not follow the rule. */
export function faceOfFileName(name: string): FaceId | null {
  const m = /^([FBLRUD])\.(?:png|svg)$/i.exec(name.trim());
  return m ? (m[1].toUpperCase() as FaceId) : null;
}

export interface Assignment {
  /** Index into the given names for each face found. */
  readonly byFace: Partial<Record<FaceId, number>>;
  /** Indexes of names that matched no face. */
  readonly unmatched: readonly number[];
  /** Faces named by more than one file. */
  readonly duplicates: readonly FaceId[];
  readonly missing: readonly FaceId[];
  readonly complete: boolean;
}

export function assignFilesByName(names: readonly string[]): Assignment {
  const byFace: Partial<Record<FaceId, number>> = {},
    unmatched: number[] = [],
    duplicates = new Set<FaceId>();
  names.forEach((name, i) => {
    const face = faceOfFileName(name);
    if (!face) unmatched.push(i);
    else if (byFace[face] !== undefined) duplicates.add(face);
    else byFace[face] = i;
  });
  const missing = FACE_IDS.filter((f) => byFace[f] === undefined);
  return {
    byFace,
    unmatched,
    duplicates: [...duplicates],
    missing,
    complete: missing.length === 0 && duplicates.size === 0 && unmatched.length === 0,
  };
}

/** Throws a plain message when the selection breaks the count or byte limits. */
export function checkSelection(files: readonly { readonly name: string; readonly size: number }[]): void {
  if (files.length === 0) throw Error("Choose at least one picture file.");
  if (files.length > UPLOAD_LIMITS.files)
    throw Error(`Choose one net image or up to ${UPLOAD_LIMITS.files} face images, not ${files.length} files.`);
  let total = 0;
  for (const f of files) {
    if (f.size <= 0) throw Error(`${f.name} is empty.`);
    if (f.size > UPLOAD_LIMITS.fileBytes)
      throw Error(`${f.name} is larger than ${UPLOAD_LIMITS.fileBytes / 1048576} MB.`);
    total += f.size;
  }
  if (total > UPLOAD_LIMITS.totalBytes)
    throw Error(`The files together are larger than ${UPLOAD_LIMITS.totalBytes / 1048576} MB.`);
}

/** PNG signature, IHDR and dimensions; the browser decode confirms them afterwards. */
export function validatePngBytes(bytes: Uint8Array): readonly [number, number] {
  if (bytes.length < 33 || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR")
    throw Error("This is not a valid PNG file.");
  let size: readonly [number, number];
  try {
    size = pngDimensions(bytes);
  } catch {
    throw Error("This is not a valid PNG file.");
  }
  const [w, h] = size;
  if (w < 1 || h < 1) throw Error("This PNG has no pixels.");
  if (w > UPLOAD_LIMITS.pngSide || h > UPLOAD_LIMITS.pngSide)
    throw Error(`A PNG may be at most ${UPLOAD_LIMITS.pngSide} pixels per side, this one is ${w} × ${h}.`);
  return size;
}

/** What kind of picture the bytes are, by content and not by file name. */
export function sniffFormat(bytes: Uint8Array): UploadFormat | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "png";
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^﻿/, "");
  return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head) ? "svg" : null;
}

// --- Net layout ---------------------------------------------------------------------------------

/** Standard cross: U above F; L F R B in one row; D below F. Column and row of each face. */
export const CROSS_CELLS: Readonly<Record<FaceId, readonly [number, number]>> = {
  U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2],
};
/** Accepted deviation of width/height from 4:3. */
export const CROSS_ASPECT_TOLERANCE = 0.02;

export function isCrossAspect(width: number, height: number): boolean {
  return width > 0 && height > 0 && Math.abs(width / height - 4 / 3) <= (4 / 3) * CROSS_ASPECT_TOLERANCE;
}

/**
 * Rectangles [x, y, w, h] of the six faces of a cross net at the boundaries k * width / 4 and
 * k * height / 3. With `integer` (pixels, the default) the boundaries are rounded: no gaps, no overlap.
 * SVG user units are not pixels, so SVG nets pass `integer = false` and are cut exactly.
 */
export function crossRects(
  width: number,
  height: number,
  originX = 0,
  originY = 0,
  integer = true,
): Readonly<Record<FaceId, readonly [number, number, number, number]>> {
  if (!isCrossAspect(width, height)) throw Error("This is not a 4:3 cross layout.");
  const at = (k: number, total: number, parts: number) => (integer ? Math.round((k * total) / parts) : (k * total) / parts);
  const xs = [0, 1, 2, 3, 4].map((k) => at(k, width, 4)),
    ys = [0, 1, 2, 3].map((k) => at(k, height, 3));
  return Object.fromEntries(
    FACE_IDS.map((f) => {
      const [c, r] = CROSS_CELLS[f];
      return [f, [originX + xs[c], originY + ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r]] as const];
    }),
  ) as Record<FaceId, readonly [number, number, number, number]>;
}

// --- Resolution hint ----------------------------------------------------------------------------

/** Pixels one face edge needs for a size-n cube at the advised density. */
export function minFaceResolution(n: number): number {
  return n * MIN_PIXELS_PER_STICKER;
}

export interface ResolutionHint {
  readonly required: number;
  /** PNG faces below the advised resolution, with their size. */
  readonly small: readonly { readonly face: FaceId; readonly size: number }[];
  /** True when every raster face meets the advice (SVG faces always do). */
  readonly ok: boolean;
}

export function resolutionHint(
  n: number,
  faces: Readonly<Record<FaceId, { readonly format: UploadFormat; readonly originalSize: number }>>,
): ResolutionHint {
  const required = minFaceResolution(n),
    small = FACE_IDS.filter((f) => faces[f].format === "png" && faces[f].originalSize < required).map(
      (face) => ({ face, size: faces[face].originalSize }),
    );
  return { required, small, ok: small.length === 0 };
}

// --- Assembling the face set ----------------------------------------------------------------------

/** A validated face ready to be kept in memory. `size` is its decoded edge, `originalSize` the uploaded one. */
export interface PreparedFace {
  readonly format: UploadFormat;
  readonly bytes: Uint8Array;
  readonly size: number;
  readonly originalSize: number;
}

export interface UploadedFaceSet {
  readonly set: FaceSet;
  /** Bytes by URL for the asset loader's in-memory path. */
  readonly local: LocalSources;
  readonly faces: Readonly<Record<FaceId, PreparedFace>>;
}

/** Computes the SHA-256 of each face client side and describes the six faces as an ordinary FaceSet. */
export async function buildUploadedFaceSet(
  faces: Readonly<Record<FaceId, PreparedFace>>,
  name = UPLOAD_SET_NAME,
): Promise<UploadedFaceSet> {
  const local = new Map<string, { format: UploadFormat; bytes: Uint8Array }>(),
    sources = {} as Record<FaceId, FaceSource>;
  // The loader's limits apply to what is kept, which can be larger than what was uploaded (an SVG grows
  // when sanitizing escapes its text), so they are checked here and not first when the design loads.
  let total = 0;
  for (const face of FACE_IDS) {
    const { bytes } = faces[face];
    total += bytes.length;
    if (bytes.length > LOCAL_ASSET_LIMITS.bytesPerFile)
      throw Error(`Face ${face} is too large after cleaning (${Math.ceil(bytes.length / 1024)} KB, limit ${LOCAL_ASSET_LIMITS.bytesPerFile / 1048576} MB).`);
  }
  if (total > LOCAL_ASSET_LIMITS.totalBytes)
    throw Error(`The six faces are too large together after cleaning (limit ${LOCAL_ASSET_LIMITS.totalBytes / 1048576} MB).`);
  for (const face of FACE_IDS) {
    const { format, bytes, size } = faces[face];
    const url = `${LOCAL_ASSET_PREFIX}${face}.${format}`;
    local.set(url, { format, bytes });
    sources[face] = { url, format, sha256: await sha256(bytes), size };
  }
  // Different pictures must never share a print id: it carries a hash of the six face hashes.
  const contentId = (await sha256(new TextEncoder().encode(FACE_IDS.map((f) => sources[f].sha256).join(" ")))).slice(0, 20);
  return { set: { id: UPLOAD_SET_ID, name, faces: sources, contentId }, local, faces };
}
