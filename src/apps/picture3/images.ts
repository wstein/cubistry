import { FACE_FRAMES, type Face } from "./model.ts";
export const IMAGE_LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, setBytes: 32 * 1024 * 1024,
  pixels: 16 * 1024 * 1024, dimension: 8192, sourceEdge: 1536, faceEdge: 768, tileEdge: 256 });
export interface Crop { readonly zoom: number; readonly x: number; readonly y: number }
export const DEFAULT_CROP: Crop = Object.freeze({ zoom: 1, x: 0, y: 0 });
export interface FaceSource { readonly blob: Blob; readonly crop: Crop }
export type FaceSources = Record<Face, FaceSource>;
export function validateCrop(crop: Crop): Crop {
  if (!crop || ![crop.zoom, crop.x, crop.y].every(Number.isFinite) || crop.zoom < 1 || crop.zoom > 4 ||
    Math.abs(crop.x) > 1 || Math.abs(crop.y) > 1) throw Error("Use zoom 1–4 and positions from −1 to 1.");
  return { zoom: crop.zoom, x: crop.x, y: crop.y };
}
export function cropRectangle(width: number, height: number, crop: Crop): readonly [number, number, number, number] {
  validateCrop(crop);
  if (![width, height].every(n => Number.isInteger(n) && n > 0)) throw Error("Invalid image dimensions.");
  const edge = Math.min(width, height) / crop.zoom;
  return [(width - edge) * (crop.x + 1) / 2, (height - edge) * (crop.y + 1) / 2, edge, edge];
}
export function validateSources(sources: FaceSources): number {
  if (!sources || Object.keys(sources).length !== 6) throw Error("A picture set needs all six faces.");
  let total = 0;
  for (const { face } of FACE_FRAMES) {
    const source = sources[face];
    if (!source || !(source.blob instanceof Blob) || !["image/png", "image/jpeg", "image/webp"].includes(source.blob.type) ||
      source.blob.size <= 0 || source.blob.size > IMAGE_LIMITS.bytes) throw Error("Use PNG, JPEG or WebP images up to 8 MiB per face.");
    validateCrop(source.crop); total += source.blob.size;
  }
  if (total > IMAGE_LIMITS.setBytes) throw Error("A picture set may contain at most 32 MiB of source images.");
  return total;
}
/** Inspect raster headers before decoding, preventing small compressed pixel bombs. */
export function rasterDimensions(bytes: Uint8Array, type: string): readonly [number, number] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), ascii = (a: number, b: number) => new TextDecoder().decode(bytes.subarray(a, b));
  let width = 0, height = 0;
  if (type === "image/png" && bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((x,i) => bytes[i] === x) && ascii(12,16) === "IHDR") {
    width = v.getUint32(16); height = v.getUint32(20);
  } else if (type === "image/webp" && bytes.length >= 30 && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP") {
    if (ascii(12,16) === "VP8X") { width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536; height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536; }
    else if (ascii(12,16) === "VP8L" && bytes[20] === 47) { width = 1 + bytes[21] + (bytes[22] & 63) * 256; height = 1 + (bytes[22] >> 6) + bytes[23] * 4 + (bytes[24] & 15) * 1024; }
    else if (ascii(12,16) === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) { width = v.getUint16(26, true) & 16383; height = v.getUint16(28, true) & 16383; }
  } else if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2;
    while (at + 3 < bytes.length) {
      if (bytes[at++] !== 255) throw Error("Invalid JPEG marker.");
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (at + 2 > bytes.length) break;
      const length = v.getUint16(at);
      if (length < 2 || at + length > bytes.length) throw Error("Truncated JPEG image.");
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        if (length < 8) throw Error("Invalid JPEG dimensions.");
        height = v.getUint16(at + 3); width = v.getUint16(at + 5); break;
      }
      at += length;
    }
  }
  if (!width || !height) throw Error("The file does not match a supported raster image.");
  checkDimensions(width, height); return [width, height];
}
function checkDimensions(width: number, height: number): void {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= IMAGE_LIMITS.dimension) || width * height > IMAGE_LIMITS.pixels)
    throw Error("Resize the image to at most 16 megapixels and 8192 pixels per side.");
}
export interface DecodedImage { readonly width: number; readonly height: number; close(): void }
export interface ImageDecoder { (blob: Blob, options: ImageBitmapOptions): Promise<DecodedImage> }
export async function decodePhoto(blob: Blob, decode: ImageDecoder = (blob, options) => createImageBitmap(blob, options)): Promise<DecodedImage> {
  if (!(blob instanceof Blob) || blob.size <= 0 || blob.size > IMAGE_LIMITS.bytes || !["image/png", "image/jpeg", "image/webp"].includes(blob.type))
    throw Error("Use a PNG, JPEG or WebP image up to 8 MiB. SVG uploads are not supported.");
  const [width, height] = rasterDimensions(new Uint8Array(await blob.arrayBuffer()), blob.type);
  const scale = Math.min(1, IMAGE_LIMITS.sourceEdge / Math.max(width, height));
  // Specify one dimension so EXIF-rotated photos retain their decoded aspect.
  // The conservative short-side target bounds either possible orientation.
  const image = await decode(blob, { imageOrientation: "from-image",
    ...(scale < 1 ? { resizeWidth: Math.max(1, Math.floor(Math.min(width, height) * scale)) } : {}),
    resizeQuality: "high" });
  try {
    checkDimensions(image.width, image.height);
    if (Math.max(image.width, image.height) > IMAGE_LIMITS.sourceEdge) throw Error("This browser could not safely resize the decoded image.");
    return image;
  } catch (error) { image.close(); throw error; }
}
export function paintFace(source: CanvasImageSource & { width: number; height: number }, crop: Crop,
  face: HTMLCanvasElement, tiles: readonly HTMLCanvasElement[]): void {
  if (face.width !== IMAGE_LIMITS.faceEdge || face.height !== IMAGE_LIMITS.faceEdge || tiles.length !== 9 ||
    tiles.some(t => t.width !== IMAGE_LIMITS.tileEdge || t.height !== IMAGE_LIMITS.tileEdge)) throw Error("Invalid picture raster size.");
  const ctx = face.getContext("2d"); if (!ctx) throw Error("Canvas image editing is unavailable.");
  ctx.clearRect(0, 0, face.width, face.height);
  ctx.drawImage(source, ...cropRectangle(source.width, source.height, crop), 0, 0, face.width, face.height);
  tiles.forEach((tile, i) => {
    const context = tile.getContext("2d"); if (!context) throw Error("Canvas image editing is unavailable.");
    context.clearRect(0, 0, tile.width, tile.height);
    context.drawImage(face, (i % 3) * 256, Math.floor(i / 3) * 256, 256, 256, 0, 0, 256, 256);
  });
}
/** Serial decode limits peak decoder memory; face generations discard obsolete results. */
export class PhotoDecoder {
  private tail: Promise<unknown> = Promise.resolve();
  private versions = new Map<Face, number>();
  private disposed = false;
  constructor(privateDecode: ImageDecoder = (blob, options) => createImageBitmap(blob, options)) { this.decode = privateDecode; }
  private readonly decode: ImageDecoder;
  async load(face: Face, blob: Blob): Promise<DecodedImage | null> {
    if (this.disposed) throw Error("Picture editor has been closed.");
    const version = (this.versions.get(face) ?? 0) + 1; this.versions.set(face, version);
    const current = () => !this.disposed && this.versions.get(face) === version;
    const job = this.tail.catch(() => {}).then(async () => {
      if (!current()) return null;
      let image: DecodedImage;
      try { image = await decodePhoto(blob, this.decode); } catch (error) { if (!current()) return null; throw error; }
      if (!current()) { image.close(); return null; }
      return image;
    });
    this.tail = job; return job;
  }
  invalidate(): void { for (const { face } of FACE_FRAMES) this.versions.set(face, (this.versions.get(face) ?? 0) + 1); }
  dispose(): void { this.disposed = true; this.invalidate(); }
}
