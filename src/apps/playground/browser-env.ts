// SPDX-License-Identifier: AGPL-3.0-or-later
/** The browser side of the Picture Cube mode: viewer, asset loader, pictures panel, key target and address bar. */
import { loadAssets } from "@cubistry/cube-assets";
import { BASE_MOVE_DURATION_MS, CubeViewer } from "@cubistry/cube-viewer";
import { mountPicturesPanel } from "./pictures-panel.ts";
import { loadDesignAssets } from "./face-images.ts";
import type { PlaygroundEnv } from "./mount.ts";

export function browserPlaygroundEnv(base: string): PlaygroundEnv {
  return {
    doc: document,
    createViewer: (host) => {
      const viewer = new CubeViewer(host);
      // Test hook (tests/browser/stickerless-seam.spec.mjs): the spec sets canvas size and view and reads the render; no app code uses it.
      (window as unknown as Record<string, unknown>).__playgroundViewer = viewer;
      return viewer;
    },
    baseMoveMs: BASE_MOVE_DURATION_MS,
    loadAssets: (design, local) => loadDesignAssets(loadAssets as never, design, base, local),
    createPictures: (region, hooks) => mountPicturesPanel(region, { baseUrl: base, ...hooks }),
    keys: window,
    replaceParams(own, ownKeys) {
      const url = new URL(location.href);
      for (const key of ownKeys) url.searchParams.delete(key);
      for (const [key, value] of own) url.searchParams.set(key, value);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    },
    nextFrame: (fn) => void requestAnimationFrame(fn),
  };
}
