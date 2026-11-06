// Renders the stickers of a picture source for the suitability measures. The stickers come through
// the same asset loader as the playground's own textures (built-in sets are fetched and hash-pinned,
// uploads use the in-memory path), so a set is judged exactly as it would be shown, whatever its
// source. The loader counts the many crops of a shared face apart (cropCount), so all stickers of a size load in one manifest.
import { loadAssets, type AssetManifest, type ImageAsset, type LocalSources } from "@cubistry/cube-assets";
import { sliceFaceSet, type FaceSet } from "./themes.ts";
import { SAMPLE, analyzeStickers, type StickerInput, type Suitability } from "./suitability.ts";

export interface RenderedSticker extends StickerInput {
  readonly data: Uint8ClampedArray;
}

const manifestOf = (images: readonly ImageAsset[]): AssetManifest => ({
  schema: "cubistry.assets",
  version: 1,
  fonts: [],
  documents: [],
  materials: [],
  images,
});

/** Renders the stickers of `images` (loaded in groups) as SAMPLE x SAMPLE RGBA, upright. */
export async function renderStickers(
  groups: readonly (readonly ImageAsset[])[],
  basePath: string,
  local?: LocalSources,
  signal?: AbortSignal,
): Promise<RenderedSticker[]> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw Error("2D image context unavailable");
  const out: RenderedSticker[] = [];
  for (const group of groups) {
    const loaded = await loadAssets(manifestOf(group), [], signal, basePath, local);
    try {
      for (const asset of group) {
        const bitmap = loaded.images.get(asset.id)!;
        // Transparent pixels show the white sticker material.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, SAMPLE, SAMPLE);
        // The loader flips textures vertically (OpenGL origin); flip back to the picture's own up.
        ctx.save();
        ctx.translate(0, SAMPLE);
        ctx.scale(1, -1);
        ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
        ctx.restore();
        out.push({ id: asset.id, data: new Uint8ClampedArray(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data) });
      }
    } finally {
      loaded.dispose();
    }
  }
  return out;
}


export async function measureFaceSet(
  set: FaceSet,
  n: number,
  basePath: string,
  local?: LocalSources,
  signal?: AbortSignal,
): Promise<{ result: Suitability; stickers: RenderedSticker[] }> {
  const stickers = await renderStickers([sliceFaceSet(set, n)], basePath, local, signal);
  return { result: analyzeStickers(stickers, n), stickers };
}
