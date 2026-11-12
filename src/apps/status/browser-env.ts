// SPDX-License-Identifier: AGPL-3.0-or-later
/** The browser side of the CI Quality Cube mode: viewer, asset loader, policy loader and the address bar. */
import { loadAssets } from "@cubistry/cube-assets";
import { BASE_MOVE_DURATION_MS, CubeViewer } from "@cubistry/cube-viewer";
import raw from "./definition.json";
import { QualityPolicy } from "./policy.ts";
import type { StatusEnv } from "./mount.ts";

export function browserStatusEnv(base: string): StatusEnv {
  return {
    doc: document,
    definition: raw,
    createViewer: (host) => new CubeViewer(host),
    baseMoveMs: BASE_MOVE_DURATION_MS,
    resolveAssets: (manifest, prints) => loadAssets(manifest, prints, undefined, base),
    resolvePolicy: (definition) => QualityPolicy.load(definition, base),
    reload: () => location.reload(),
    replaceParams(own, ownKeys) {
      const url = new URL(location.href);
      for (const key of ownKeys) url.searchParams.delete(key);
      for (const [key, value] of own) url.searchParams.set(key, value);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
