// The cube canvas fills the window and the HUD panels, header, dock and footer float above it, so an
// element screenshot of the canvas also captures their pixels (hover, checkbox and focus states
// included). Pixel assertions about the rendered cube hide them for the capture only.
// Local to this helper: PR #230 found most of these selectors match nothing on
// solver-acceptance.html; keep the list for the pages that still float overlays.
const HIDE_OVERLAYS = [
  "aside",
  "header",
  "footer",
  ".floating-hud",
  ".floating-island",
  ".floating-dock",
  ".floating-glass-pill",
  ".cube-appearance",
  ".cube-footer",
]
  .map((selector) => `${selector} { visibility: hidden !important; }`)
  .join("\n");

/** Screenshot of `#cube canvas` without the overlay panels. */
export const canvasShot = (page) =>
  page.locator("#cube canvas").screenshot({ style: HIDE_OVERLAYS });
