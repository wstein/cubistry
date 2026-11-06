// SVG pictures to faces, the pure part: sanitizing, the square check and the cut of a cross net. It runs
// in a Worker (svg-worker.ts) so that a hostile file can never stall the page, and directly in tests.
// Cells of a net are cut at the exact boundaries k * width / 4 and k * height / 3 of the viewBox (SVG
// units are not pixels, so nothing is rounded) and stretched to square faces, which is what the PNG
// cut does as well.
import { sanitizeSvg } from "@cubistry/cube-assets";
import { FACE_IDS, type FaceId } from "./themes.ts";
import { crossRects, isCrossAspect, UPLOAD_LIMITS } from "./upload.ts";

const SQUARE_TOLERANCE = 0.01;
const EDGE = UPLOAD_LIMITS.workingEdge;
const SIZE = [EDGE, EDGE] as const;

export type SvgFaceResult =
  | { readonly kind: "face"; readonly svg: string }
  | { readonly kind: "not-square"; readonly width: number; readonly height: number };
export type SvgNetResult =
  | { readonly kind: "faces"; readonly faces: Readonly<Record<FaceId, string>> }
  | { readonly kind: "not-a-cross"; readonly width: number; readonly height: number };

/** One face image: sanitized, sized to the working edge, square within one percent. */
export function prepareSvgFace(text: string): SvgFaceResult {
  const { svg, viewBox } = sanitizeSvg(text, { size: SIZE, preserveAspectRatio: "none" });
  const [, , w, h] = viewBox;
  if (Math.abs(w / h - 1) > SQUARE_TOLERANCE) return { kind: "not-square", width: w, height: h };
  return { kind: "face", svg };
}

/** One net in the standard cross layout, cut into six sanitized face SVGs. */
export function cutSvgNet(text: string): SvgNetResult {
  const { viewBox } = sanitizeSvg(text);
  const [x, y, w, h] = viewBox;
  if (!isCrossAspect(w, h)) return { kind: "not-a-cross", width: w, height: h };
  const rects = crossRects(w, h, x, y, false);
  const faces = {} as Record<FaceId, string>;
  for (const f of FACE_IDS)
    faces[f] = sanitizeSvg(text, { viewBox: rects[f], size: SIZE, preserveAspectRatio: "none" }).svg;
  return { kind: "faces", faces };
}

export type SvgJob = { readonly op: "face"; readonly text: string } | { readonly op: "net"; readonly text: string };
export type SvgJobReply =
  | { readonly ok: true; readonly result: SvgFaceResult | SvgNetResult }
  | { readonly ok: false; readonly rejected: boolean; readonly message: string };
