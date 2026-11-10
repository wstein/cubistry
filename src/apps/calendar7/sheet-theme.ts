// SPDX-License-Identifier: AGPL-3.0-or-later
/** Canvas lettering must follow the same automatic/explicit theme changes as its HTML cells. */
export interface SheetThemeEnvironment {
  readonly media: Pick<MediaQueryList, "addEventListener" | "removeEventListener">;
  observe(change: () => void): () => void;
}
const browserEnvironment = (): SheetThemeEnvironment => ({
  media: matchMedia("(prefers-color-scheme: dark)"),
  observe: change => {
    const observer = new MutationObserver(change);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  },
});
export function watchSheetTheme(redraw: () => void, env: SheetThemeEnvironment = browserEnvironment()): () => void {
  let disposed = false;
  const change = (): void => { if (!disposed) redraw(); };
  env.media.addEventListener("change", change);
  const stopObserver = env.observe(change);
  return () => {
    disposed = true;
    env.media.removeEventListener("change", change);
    stopObserver();
  };
}
