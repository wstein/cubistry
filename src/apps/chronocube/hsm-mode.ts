import { HsmController } from "../hsm/controller.ts";
import type { HsmDesign, Letter } from "../hsm/design.ts";
import { MsController } from "../ms/controller.ts";
import type { MsDesign } from "../ms/design.ts";
import type { MoveProgress } from "../shared/playback.ts";
import type { AssetManifest, loadAssets } from "@cubistry/cube-assets";

type View = ConstructorParameters<typeof HsmController>[0];
export type StudioOnState = (
  value: number,
  busy: boolean,
  error?: Error,
  progress?: MoveProgress,
) => void;

/** Positional arguments of HsmController: (view, design, manifest, letter, onState, resolveAssets). */
export function createStudioHsmController(
  view: View,
  design: HsmDesign,
  manifest: AssetManifest,
  letter: Letter,
  onState: StudioOnState,
  resolveAssets?: typeof loadAssets,
  range = 59,
): HsmController {
  const c = new HsmController(view, design, manifest, letter, onState, resolveAssets);
  c.setMode(range, 1);
  return c;
}

/**
 * The single-cube counter of the studio: the M/S variant runs on MsController
 * (positional arguments: view, print, manifest, letter, onState, resolveAssets),
 * the H/S/M and H/M variants on HsmController.
 */
export function createStudioSingleController(
  variant: "hsm" | "hm" | "ms",
  view: View,
  design: HsmDesign | MsDesign,
  manifest: AssetManifest,
  letter: Letter,
  onState: StudioOnState,
  resolveAssets?: typeof loadAssets,
): HsmController | MsController {
  if (variant === "ms")
    return new MsController(
      view,
      (design as MsDesign).print,
      manifest,
      letter as "M" | "S",
      onState,
      resolveAssets,
    );
  // The H/M print counts hours 00-23; every other unit counts 00-59.
  const range = variant === "hm" && letter === "H" ? 23 : 59;
  return createStudioHsmController(view, design as HsmDesign, manifest, letter, onState, resolveAssets, range);
}
