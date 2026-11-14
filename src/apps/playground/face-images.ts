// SPDX-License-Identifier: AGPL-3.0-or-later
// The whole face images of a design for the Projected picture mode. They are loaded with the same bounded, hash-pinned asset
// loader as the tiles, but in a second call (own pixel budget: the tiles of a face already count a full face each) and
// handed to the viewer under the asset ids `face_U` to `face_B` next to the tile images.
import type { LoadedAssets } from "@cubistry/cube-assets";
import { faceImageAssetId, FACE_KEYS } from "@cubistry/cube-viewer";
import type { FaceSet } from "./themes.ts";

/** Manifest with the six whole face images (no crops, no materials). */
export function faceImageManifest(faces: FaceSet["faces"]) {
  return {
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    documents: [],
    materials: [],
    images: FACE_KEYS.map((key) => {
      const { url, format, sha256 } = faces[key];
      return { id: faceImageAssetId(key), kind: "image" as const, format, url, sha256 };
    }),
  };
}

/** The tile assets with the face images added to their image map; disposing releases both. */
export function withFaceImages(tiles: LoadedAssets, faces: LoadedAssets): LoadedAssets {
  const images = new Map([...tiles.images, ...faces.images]);
  return Object.freeze({
    ...tiles,
    images,
    dispose: () => {
      tiles.dispose();
      faces.dispose();
    },
  });
}

type Loader = (manifest: unknown, prints: readonly never[] | readonly unknown[], signal: undefined, base: string, local?: unknown) => Promise<LoadedAssets>;

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
  const tiles = await load(design.assets, [design.print], undefined, base, local);
  if (!design.faces) return tiles;
  try {
    return withFaceImages(tiles, await load(faceImageManifest(design.faces), [], undefined, base, local));
  } catch (error) {
    tiles.dispose();
    throw error;
  }
}
