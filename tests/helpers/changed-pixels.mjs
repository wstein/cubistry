/**
 * CSS for `locator.screenshot({ style })`. The canvas fills the viewport (`#cube { position: fixed;
 * inset: 0 }`) and translucent, blurred HUD layers float above it, so a canvas screenshot also
 * captures them. Their backdrop blur follows the pixels underneath, which makes them change when a
 * sticker changes. `visibility: hidden` keeps the layout and applies only while Playwright captures.
 */
export const HIDE_HUD_LAYERS_STYLE = [
  ".floating-island",
  ".floating-hud",
  ".floating-dock",
  ".floating-glass-pill",
  ".presentation-exit-btn",
  "#viewer-hint",
].map((selector) => `${selector} { visibility: hidden !important; }`).join("\n");

/** Rendered-field screenshot: only the WebGL canvas, without the HUD layers above it. */
export function renderedFieldShot(page) {
  return page.locator("#cube canvas").screenshot({ style: HIDE_HUD_LAYERS_STYLE });
}

/**
 * Count pixels whose summed RGB difference exceeds `threshold`, in total and outside `box`
 * ({ minX, maxX, minY, maxY }, inclusive). Both images are decoded PNGs of equal size.
 */
export function countChangedPixels(a, b, box, threshold = 10) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("image size mismatch");
  let changed = 0,
    outside = 0;
  for (let y = 0; y < a.height; y++)
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (
        Math.abs(a.data[i] - b.data[i]) +
          Math.abs(a.data[i + 1] - b.data[i + 1]) +
          Math.abs(a.data[i + 2] - b.data[i + 2]) >
        threshold
      ) {
        changed++;
        if (!(x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY)) outside++;
      }
    }
  return { changed, outside };
}
