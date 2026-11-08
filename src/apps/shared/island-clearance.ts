/**
 * Keeps the Counter panel (`#counter-controls`) clear of the floating island header.
 *
 * The header is fixed at the top center and its size depends on the viewport, the page (hsm-counter has a longer
 * header) and the root font size. Where it would reach the panel, which is fixed at the top right, the panel must
 * start below it. This measures both boxes and publishes the panel's top as `--counter-top` on the root element.
 * Without it (JS not run yet) style.css falls back to breakpoint values.
 */

const GAP = 12;
const EDGE = 16;

export function installIslandClearance(): { destroy(): void } {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof ResizeObserver === "undefined") {
    return { destroy() {} };
  }
  const header = document.querySelector<HTMLElement>("header.floating-island");
  const panel = document.getElementById("counter-controls");
  if (!header || !panel) return { destroy() {} };

  const root = document.documentElement;
  const update = (): void => {
    const h = header.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    // The panel's left edge and width do not depend on its top, so this is stable whatever top is set now.
    const collides = p.width > 0 && h.width > 0 && h.right + GAP > p.left && p.right + GAP > h.left;
    root.style.setProperty("--counter-top", `${collides ? Math.ceil(h.bottom + GAP) : EDGE}px`);
  };

  const observer = new ResizeObserver(update);
  observer.observe(header);
  observer.observe(panel);
  window.addEventListener("resize", update);
  update();
  return {
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--counter-top");
    },
  };
}
