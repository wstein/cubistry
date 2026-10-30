import { FACE_FRAMES, type Face } from "./model.ts";
export const PRESETS = [
  { id: "coast", name: "Coastal landscapes" },
  { id: "orbit", name: "Orbital patterns" },
  { id: "blocks", name: "Color studies" },
] as const;
export type Preset = typeof PRESETS[number]["id"];
/** Original vector artwork, AGPL-3.0-or-later. No fonts or external resources. */
export function presetSvg(preset: Preset, face: Face): string {
  const index = FACE_FRAMES.findIndex(f => f.face === face);
  if (index < 0 || !PRESETS.some(p => p.id === preset)) throw Error("Unknown picture preset");
  const palettes = [["#a9dce6", "#f3cd83", "#24687a"], ["#e4bdd3", "#f8e8bd", "#58365d"],
    ["#bcdcb5", "#f4d295", "#276755"], ["#bbc8e7", "#edb5a0", "#354d83"],
    ["#edd3b7", "#dbb8df", "#854939"], ["#c2dbd6", "#f7d886", "#3d6270"]];
  const [sky, warm, ink] = palettes[index], shift = index * 23;
  const art = preset === "coast"
    ? `<circle cx="${180 + shift}" cy="170" r="90" fill="${warm}"/><path d="M0 470L210 250 440 500 650 340 768 460V768H0Z" fill="${ink}"/><path d="M0 580Q210 470 400 610T768 560V768H0Z" fill="${warm}"/><path d="M0 690Q190 570 430 700T768 650V768H0Z" fill="${ink}"/>`
    : preset === "orbit"
      ? `<circle cx="${250 + shift}" cy="360" r="270" fill="${warm}"/><circle cx="${320 + shift}" cy="330" r="180" fill="${ink}"/><circle cx="${360 + shift}" cy="300" r="90" fill="${sky}"/><path d="M45 660L630 70 690 130 105 720Z" fill="${warm}"/>`
      : `<path d="M0 768V270L480 0H768V500L300 768Z" fill="${warm}"/><path d="M0 120L650 768H768V600L160 0H0Z" fill="${ink}"/><circle cx="${180 + shift}" cy="490" r="105" fill="${sky}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><rect width="768" height="768" fill="${sky}"/>${art}<path d="M350 390L384 330 418 390 395 390V430H373V390Z" fill="${ink}"/><rect x="25" y="25" width="55" height="24" rx="8" fill="${ink}"/></svg>`;
}
