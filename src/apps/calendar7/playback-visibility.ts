// SPDX-License-Identifier: AGPL-3.0-or-later
/** Fit playback below the cube in the actual studio scrollport. This is a
 * one-time navigation/resize adjustment, never per-move document scrolling. */
export function revealPlayback(scene: HTMLElement, panel: HTMLElement, word: HTMLElement): void {
  const port = scene.closest<HTMLElement>(".shell-stage");
  if (!port || port.clientHeight === 0) return;
  port.style.removeProperty("--c7-playback-scene-height");
  word.style.removeProperty("max-height");
  const sceneHeight = scene.getBoundingClientRect().height;
  const style = getComputedStyle(word);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const line = parseFloat(style.lineHeight) || 20;
  const maximum = parseFloat(style.maxHeight) || 224;
  const overhead = panel.getBoundingClientRect().height - word.getBoundingClientRect().height;
  // Leave the panel's two outer gutters and at least two text lines in the word.
  const available = port.clientHeight - 32;
  const height = Math.min(sceneHeight, Math.max(120, available - overhead - 2 * line - padding));
  port.style.setProperty("--c7-playback-scene-height", `${height}px`);
  word.style.maxHeight = `${Math.min(maximum, Math.max(2 * line, available - height - overhead - padding))}px`;
  const cube = scene.getBoundingClientRect();
  if (getComputedStyle(scene).position === "sticky") {
    port.scrollTop += panel.getBoundingClientRect().top - cube.bottom - 8;
  } else {
    // On phones the cube itself scrolls. Bring its top into this same scrollport.
    port.scrollTop += cube.top - port.getBoundingClientRect().top;
  }
}
export function resetPlaybackVisibility(scene: HTMLElement, word: HTMLElement | null): void {
  scene.closest<HTMLElement>(".shell-stage")?.style.removeProperty("--c7-playback-scene-height");
  word?.style.removeProperty("max-height");
}
