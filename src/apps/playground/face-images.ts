// SPDX-License-Identifier: AGPL-3.0-or-later
// The whole face images of a design for the Projected picture mode. They are loaded with the same bounded, hash-pinned asset
// loader as the tiles, but in a second call (own pixel budget: the tiles of a face already count a full face each) and
// handed to the viewer under the asset ids `face_U` to `face_B` next to the tile images.
import type { LoadedAssets } from "@cubistry/cube-assets";
import { faceImageAssetId, FACE_KEYS, type FaceKey } from "@cubistry/cube-viewer";
import type { FaceSet } from "./themes.ts";

/** Manifest with the six whole face images, or only `only` (no crops, no materials). */
export function faceImageManifest(faces: FaceSet["faces"], only?: FaceKey) {
  return {
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    documents: [],
    materials: [],
    images: FACE_KEYS.filter((key) => only === undefined || key === only).map((key) => {
      const { url, format, sha256 } = faces[key];
      return { id: faceImageAssetId(key), kind: "image" as const, format, url, sha256 };
    }),
  };
}

/** The tile assets with the face images added to their image map; disposing releases both. */
export function withFaceImages(tiles: LoadedAssets, ...faces: LoadedAssets[]): LoadedAssets {
  const images = new Map([...tiles.images, ...faces.flatMap((f) => [...f.images])]);
  return Object.freeze({
    ...tiles,
    images,
    dispose: () => {
      tiles.dispose();
      for (const f of faces) f.dispose();
    },
  });
}

type Loader = (manifest: unknown, prints: readonly never[] | readonly unknown[], signal: undefined, base: string, local?: unknown, bytes?: Map<string, Promise<Uint8Array>>) => Promise<LoadedAssets>;

/**
 * Loads a design's assets: the tiles for the per-sticker mapping and, when the design has whole faces, the face images for
 * the Projected mapping. A failure of either releases what the other already loaded.
 */
export async function loadDesignAssets(
  load: Loader,
  design: { readonly assets: unknown; readonly print: unknown; readonly faces?: FaceSet["faces"] },
  base: string,
  local?: unknown,
): Promise<LoadedAssets> {
  // One byte cache for all loads of a design: a face file that the tiles were cut from is fetched once.
  const bytes = new Map<string, Promise<Uint8Array>>();
  const tiles = await load(design.assets, [design.print], undefined, base, local, bytes);
  if (!design.faces) return tiles;
  // One call per face: the loader counts a whole image twice against its decoded-pixel budget (decode and bitmap), so six
  // faces of 1024 px in one call would exceed it; each call has its own budget.
  const loaded: LoadedAssets[] = [];
  try {
    for (const key of FACE_KEYS) loaded.push(await load(faceImageManifest(design.faces, key), [], undefined, base, local, bytes));
    return withFaceImages(tiles, ...loaded);
  } catch (error) {
    tiles.dispose();
    for (const f of loaded) f.dispose();
    throw error;
  }
}
