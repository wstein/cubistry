import { CounterController } from "../counter/controller.ts";
import { loadCounterDesign } from "../counter/design.ts";
import { loadCertifiedCounter } from "../counter/certified.ts";
import type { AssetManifest, loadAssets } from "@cubistry/cube-assets";

type View = ConstructorParameters<typeof CounterController>[0];

/**
 * Loads the counter design and certified route, builds the controller with its
 * positional arguments (view, design, onState, resolveAssets), starts it at 00 on
 * the certified leading-zero route and installs the studio manifest.
 */
export async function createStudioCounter(opts: {
  base: string;
  view: View;
  manifest: AssetManifest;
  onState: (value: number, busy: boolean) => void;
  resolveAssets?: typeof loadAssets;
}): Promise<CounterController> {
  const design = await loadCounterDesign(undefined, opts.base);
  const certified = await loadCertifiedCounter(design, opts.base);
  const c = new CounterController(opts.view, design, opts.onState, opts.resolveAssets);
  await c.configure("COUNTER", certified.padded, 0, certified);
  await c.updateManifest(opts.manifest);
  return c;
}
