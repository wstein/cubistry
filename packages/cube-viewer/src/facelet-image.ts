import {
  eq,
  type CubeState,
  type PrintDefinition,
  type Vec3,
} from "@cubistry/cube-core";
import { stickerPoses } from "@cubistry/cube-mechanics";
/** Optional screen presentation of one field; never modifies physical print/state. */
export interface FaceletImageOverride {
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly sourceAssetId: string;
  readonly replacementAssetId: string;
}
export function overriddenSticker(
  print: PrintDefinition,
  state: CubeState,
  rule: FaceletImageOverride | null,
): number | null {
  if (!rule) return null;
  return (
    stickerPoses(print, state).find(
      (p) =>
        eq(p.p, rule.position) &&
        eq(p.n, rule.normal) &&
        p.assetId === rule.sourceAssetId,
    )?.id ?? null
  );
}
