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
  // On a phone the cube scrolls with the page, so the month picker between the cube and the
  // player stays on screen. Wide stages pin the cube and scroll that picker away.
  const picker = panel.closest(".c7-root")?.querySelector<HTMLElement>(".c7-date-choice");
  const pickerStyle = picker ? getComputedStyle(picker) : null;
  const pickerBlock = picker && pickerStyle && getComputedStyle(scene).position !== "sticky"
    ? picker.getBoundingClientRect().height + (parseFloat(pickerStyle.marginTop) || 0) + (parseFloat(pickerStyle.marginBottom) || 0)
    : 0;
  // Leave the panel's two outer gutters and at least two text lines in the word.
  // The 120px floor already fills a phone stage. The month picker is an extra row on that
  // stage, so let the cube give up that row, and stop at 72px so the cube stays visible.
  const available = port.clientHeight - 32;
  const room = available - overhead - 2 * line - padding;
  const minimum = Math.max(72, 120 - pickerBlock);
  const height = Math.max(minimum, Math.min(sceneHeight - pickerBlock, room));
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
