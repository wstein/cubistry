import { FACE_FRAMES, type Face } from "./model.ts";
import { PhotoDecoder, paintFace, validateSources, validateCrop, DEFAULT_CROP, type FaceSources, type Crop, type DecodedImage } from "./images.ts";
import { presetSvg, type Preset } from "./presets.ts";
interface FaceResource { source: DecodedImage; blob: Blob; crop: Crop; canvas: HTMLCanvasElement; tiles: HTMLCanvasElement[] }
export interface EditorPorts {
  decoder: PhotoDecoder;
  canvas(size: number): HTMLCanvasElement;
  rasterize(svg: string): Promise<Blob>;
  changed(): void;
}
/** Trusted bundled SVG only; uploaded SVG never enters this decoder. */
export async function rasterizePreset(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), image = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(Error("Bundled picture decode timed out. Retry the preset.")), 5000);
      image.onload = () => resolve(); image.onerror = () => reject(Error("Cannot decode this bundled picture.")); image.src = url;
    });
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 768;
    const context = canvas.getContext("2d"); if (!context) throw Error("Canvas image editing is unavailable.");
    context.drawImage(image, 0, 0, 768, 768);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error("Cannot prepare the picture preset.")), "image/png"));
  } finally { clearTimeout(timer); image.onload = image.onerror = null; image.src = ""; URL.revokeObjectURL(url); }
}
export class PictureEditor {
  private readonly ports: EditorPorts;
  private resources = new Map<Face, FaceResource>();
  private versions = new Map<Face, number>();
  private reserved = new Map<Face, Blob>();
  private epoch = 0;
  private disposed = false;
  private replacing = false;
  private classic = new Map<Face, HTMLCanvasElement>();
  constructor(ports: Partial<EditorPorts> = {}) {
    this.ports = { decoder: new PhotoDecoder(), canvas(size) { const c = document.createElement("canvas"); c.width = c.height = size; return c; },
      rasterize: rasterizePreset, changed() {}, ...ports };
  }
  get ready(): boolean { return this.resources.size === 6; }
  get pending(): boolean { return this.replacing || this.reserved.size > 0; }
  get faces(): ReadonlyMap<Face, FaceResource> { return this.resources; }
  snapshot(): FaceSources {
    const result = Object.fromEntries([...this.resources].map(([face, r]) => [face, { blob: r.blob, crop: { ...r.crop } }])) as FaceSources;
    validateSources(result); return result;
  }
  private make(source: DecodedImage, blob: Blob, crop: Crop): FaceResource {
    const canvas = this.ports.canvas(768), tiles = Array.from({ length: 9 }, () => this.ports.canvas(256));
    try { paintFace(source as ImageBitmap, crop, canvas, tiles); return { source, blob, crop: { ...crop }, canvas, tiles }; }
    catch (error) { for (const c of [canvas, ...tiles]) c.width = c.height = 0; throw error; }
  }
  private release(resource: FaceResource): void {
    resource.source.close(); for (const canvas of [resource.canvas, ...resource.tiles]) canvas.width = canvas.height = 0;
  }
  async preset(id: Preset): Promise<boolean> {
    return this.replace(async () => {
      const entries = [];
      for (const { face } of FACE_FRAMES) entries.push([face, { blob: await this.ports.rasterize(presetSvg(id, face)), crop: DEFAULT_CROP }]);
      return Object.fromEntries(entries) as FaceSources;
    });
  }
  async load(sources: FaceSources): Promise<boolean> {
    validateSources(sources); return this.replace(async () => sources);
  }
  private async replace(read: () => Promise<FaceSources>): Promise<boolean> {
    if (this.disposed) throw Error("Picture editor has been closed.");
    const epoch = ++this.epoch; this.ports.decoder.invalidate(); this.reserved.clear(); this.replacing = true;
    this.ports.changed(); const staged = new Map<Face, FaceResource>();
    const current = () => !this.disposed && this.epoch === epoch;
    try {
      const sources = await read(); validateSources(sources);
      for (const { face } of FACE_FRAMES) {
        if (!current()) return false;
        const value = sources[face], source = await this.ports.decoder.load(face, value.blob);
        if (!source) return false;
        if (!current()) { source.close(); return false; }
        try { staged.set(face, this.make(source, value.blob, value.crop)); } catch (error) { source.close(); throw error; }
      }
      if (!current()) return false;
      const previous = this.resources; this.resources = staged;
      try { this.ports.changed(); } finally { for (const r of previous.values()) this.release(r); }
      return true;
    } catch (error) { if (current()) throw error; return false; }
    finally {
      if (this.resources !== staged) for (const resource of staged.values()) this.release(resource);
      if (current()) { this.replacing = false; this.ports.changed(); }
    }
  }
  async upload(face: Face, blob: Blob): Promise<boolean> {
    if (!this.ready || this.disposed || this.replacing) throw Error("Wait for the picture set to finish loading.");
    const candidate = this.snapshot(); for (const [key, value] of this.reserved) candidate[key] = { blob: value, crop: DEFAULT_CROP };
    candidate[face] = { blob, crop: DEFAULT_CROP }; validateSources(candidate);
    const epoch = this.epoch, version = (this.versions.get(face) ?? 0) + 1;
    this.versions.set(face, version); this.reserved.set(face, blob); this.ports.changed();
    const current = () => !this.disposed && epoch === this.epoch && this.versions.get(face) === version;
    try {
      const source = await this.ports.decoder.load(face, blob);
      if (!source) return false;
      if (!current()) { source.close(); return false; }
      let resource: FaceResource;
      try { resource = this.make(source, blob, DEFAULT_CROP); } catch (error) { source.close(); throw error; }
      const previous = this.resources.get(face)!; this.resources.set(face, resource);
      try { this.ports.changed(); } finally { this.release(previous); }
      return true;
    } catch (error) { if (current()) throw error; return false; }
    finally { if (current()) { this.reserved.delete(face); this.ports.changed(); } }
  }
  crop(face: Face, crop: Crop): void {
    const resource = this.resources.get(face);
    if (!resource || this.disposed) throw Error("Choose a picture first.");
    const next = validateCrop(crop);
    paintFace(resource.source as ImageBitmap, next, resource.canvas, resource.tiles);
    resource.crop = next; this.ports.changed();
  }
  artwork(style: "picture" | "classic"): ReadonlyMap<number, HTMLCanvasElement> {
    if (!this.ready) throw Error("The six picture faces are not ready.");
    const result = new Map<number, HTMLCanvasElement>();
    FACE_FRAMES.forEach((f, index) => {
      if (style === "classic" && !this.classic.has(f.face)) {
        const canvas = this.ports.canvas(256), context = canvas.getContext("2d");
        if (!context) throw Error("Canvas image editing is unavailable.");
        context.fillStyle = f.color; context.fillRect(0, 0, 256, 256); this.classic.set(f.face, canvas);
      }
      for (let tile = 0; tile < 9; tile++) result.set(index * 9 + tile, style === "picture" ? this.resources.get(f.face)!.tiles[tile] : this.classic.get(f.face)!);
    });
    return result;
  }
  dispose(): void {
    this.disposed = true; this.epoch++; this.ports.decoder.dispose(); this.reserved.clear();
    for (const r of this.resources.values()) this.release(r); this.resources.clear();
    for (const canvas of this.classic.values()) canvas.width = canvas.height = 0; this.classic.clear();
  }
}
