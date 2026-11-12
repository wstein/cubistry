// Face sets: where the playground's pictures come from. A face set is six whole face images plus a
// name; it knows nothing about the cube size. `sliceFaceSet` cuts it into the N x N stickers a cube
// of size N needs (one image asset per sticker with a pixel crop of its face; the asset loader
// decodes each face once and shares it between its crops). Slicing and rendering depend only on the
// `FaceSet` type, never on which set it is, so built-in themes and, later, user uploads (six faces
// or one net image cut into six faces) are handled alike: an upload only has to produce a FaceSet.
// The playground itself runs size 2 today, so createDesign uses sliceFaceSet(set, 2).
// To add a built-in theme: copy the six faces to public/playground-<id>/, run
// `node scripts/build-playground-theme.mjs <id>` and add one entry to THEMES below.
import type { ImageAsset } from "@cubistry/cube-assets";
import { halloweenFaces } from "./theme-assets/halloween.ts";
import { easterFaces } from "./theme-assets/easter.ts";
import { christmasFaces } from "./theme-assets/christmas.ts";
import { spaceFaces } from "./theme-assets/space.ts";
import { martinFaces } from "./theme-assets/martin.ts";
import { bremenFaces } from "./theme-assets/bremen.ts";
import { seasonsFaces } from "./theme-assets/seasons.ts";
import { friedenFaces } from "./theme-assets/frieden.ts";
export const FACE_IDS = ["F", "B", "R", "L", "U", "D"] as const;
export type FaceId = (typeof FACE_IDS)[number];
/** One whole face image. `size` is its decoded edge length in pixels (SVG user units for SVG). */
export interface FaceSource {
  readonly url: string;
  readonly format: "svg" | "png" | "webp";
  readonly sha256: string;
  readonly size: number;
}
export interface FaceSet {
  /** Design value and print id suffix: lowercase letters only. */
  readonly id: string;
  /** Label shown in the Design selector. */
  readonly name: string;
  readonly faces: Readonly<Record<FaceId, FaceSource>>;
  /**
   * Print version (default 1): the print id is `playground_<id>_v<version>`. Bump it whenever a face
   * image changes, so a saved or running puzzle never meets different art under the same print id.
   */
  readonly version?: number;
  /**
   * Content id (lowercase hex, at most 32 characters) for sets whose art is not fixed in the
   * repository, such as an upload: it becomes part of the print id, so different pictures never
   * share one.
   */
  readonly contentId?: string;
}
export const MIN_CUBE_SIZE = 2;
export const MAX_CUBE_SIZE = 7;
const REGISTRY = [
  { id: "seasons", name: "Four Seasons", faces: seasonsFaces },
  { id: "bremen", name: "Town Musicians", faces: bremenFaces },
  { id: "martin", name: "Lantern Parade", faces: martinFaces },
  { id: "space", name: "Starry Sky", faces: spaceFaces },
  { id: "christmas", name: "Christmas", faces: christmasFaces },
  { id: "easter", name: "Easter", faces: easterFaces },
  { id: "halloween", name: "Halloween", faces: halloweenFaces },
  { id: "frieden", name: "Frieden", faces: friedenFaces },
] as const satisfies readonly FaceSet[];
/** Literal union of the registered ids; it is what makes `Style` and `createDesign` type-checked. */
export type ThemeId = (typeof REGISTRY)[number]["id"];
export const THEMES: readonly FaceSet[] = REGISTRY;
/** Pixel boundaries of the n tile columns (or rows) of a face of `size` pixels: rounded, no gaps. */
export function tileEdges(n: number, size: number): readonly number[] {
  if (!Number.isInteger(n) || n < MIN_CUBE_SIZE || n > MAX_CUBE_SIZE)
    throw Error(`Cube size must be an integer from ${MIN_CUBE_SIZE} to ${MAX_CUBE_SIZE}`);
  if (!Number.isInteger(size) || size < n) throw Error("A face needs at least one pixel per sticker");
  return Array.from({ length: n + 1 }, (_, k) => Math.round((k * size) / n));
}
/** The n x n stickers of each face as cropped image assets with ids `F_<row>_<col>`. */
export function sliceFaceSet(set: FaceSet, n: number): readonly ImageAsset[] {
  return FACE_IDS.flatMap((face) => {
    const { url, format, sha256, size } = set.faces[face];
    const edges = tileEdges(n, size);
    return Array.from({ length: n * n }, (_, i) => {
      const row = Math.floor(i / n),
        col = i % n;
      return {
        id: `${face}_${row}_${col}`,
        kind: "image" as const,
        format,
        url,
        sha256,
        crop: [edges[col], edges[row], edges[col + 1] - edges[col], edges[row + 1] - edges[row]] as const,
      };
    });
  });
}
