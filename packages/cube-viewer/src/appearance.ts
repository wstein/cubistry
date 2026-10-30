import { demand } from "@cubistry/cube-core";
import type { AssetManifest } from "@cubistry/cube-assets";
export type Construction = "stickered" | "stickerless";
export interface ViewerAppearance {
  readonly construction: Construction;
  readonly frameColor: string | null;
}
export const DEFAULT_APPEARANCE: ViewerAppearance = Object.freeze({ construction: "stickered", frameColor: null });
export function validateAppearance(value: ViewerAppearance): ViewerAppearance {
  demand(value && ["stickered", "stickerless"].includes(value.construction), "Invalid cube construction");
  demand(value.frameColor === null || /^#[0-9a-f]{6}$/i.test(value.frameColor), "Invalid frame color");
  return Object.freeze({ construction: value.construction, frameColor: value.frameColor });
}
/** Explicit asset metadata only; never sample pixels, erase white or alter art. */
export function sourceFaceColor(assetId: string, manifest: AssetManifest | undefined, fallback: string): string {
  const asset = manifest?.images.find(image => image.id === assetId);
  if (asset?.kind === "color") return asset.color;
  if (asset?.kind === "text")
    return manifest?.documents.find(document => document.id === asset.documentId)?.background ?? fallback;
  return fallback;
}
export const appearanceStorageKey = (pathname: string) => `cubistry-viewer-appearance-v1:${pathname.slice(0, 200)}`;
export function readAppearance(storage: Pick<Storage, "getItem">, key: string): ViewerAppearance {
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null");
    return saved?.version === 1 ? validateAppearance(saved) : DEFAULT_APPEARANCE;
  } catch { return DEFAULT_APPEARANCE; }
}

/** One small presentation control per viewport; no application-state settings. */
export function installAppearanceControls(host: HTMLElement, change: (value: ViewerAppearance) => void) {
  const key = appearanceStorageKey(location.pathname);
  let value = DEFAULT_APPEARANCE;
  try { value = readAppearance(localStorage, key); } catch { /* Storage may be unavailable. */ }
  let defaultColor = "#202329";
  const previousPosition = host.style.position;
  host.style.position = "relative";
  const panel = document.createElement("details");
  panel.className = "cube-appearance";
  Object.assign(panel.style, { position: "absolute", top: "12px", left: "12px", zIndex: "2",
    background: "#fffdf5ed", color: "#342e28", border: "1px solid #c9bbab", borderRadius: "8px",
    padding: "7px 10px", fontSize: "12px", textAlign: "left", maxWidth: "calc(100% - 24px)" });
  const summary = document.createElement("summary"); summary.textContent = "Appearance";
  const label = document.createElement("label"); label.textContent = "Construction ";
  const mode = document.createElement("select"); mode.setAttribute("aria-label", "Cube construction");
  for (const [id, title] of [["stickered", "Stickered"], ["stickerless", "Stickerless"]]) {
    const option = document.createElement("option"); option.value = id; option.textContent = title; mode.append(option);
  }
  label.append(mode);
  const colorLabel = document.createElement("label"); colorLabel.textContent = " Frame color ";
  const color = document.createElement("input"); color.type = "color"; color.setAttribute("aria-label", "Plastic frame color");
  colorLabel.append(color);
  const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Style default";
  const note = document.createElement("p"); note.textContent = "Printed artwork is retained in both constructions.";
  note.style.margin = "6px 0 0";
  panel.append(summary, label, colorLabel, reset, note); host.append(panel);
  const refresh = () => {
    mode.value = value.construction; color.value = value.frameColor ?? defaultColor;
    color.disabled = reset.disabled = value.construction === "stickerless";
  };
  const update = (next: ViewerAppearance) => {
    value = validateAppearance(next); refresh(); change(value);
    try { localStorage.setItem(key, JSON.stringify({ version: 1, ...value })); } catch { /* Presentation remains usable. */ }
  };
  mode.addEventListener("change", () => update({ ...value, construction: mode.value as Construction }));
  color.addEventListener("input", () => update({ ...value, frameColor: color.value }));
  reset.addEventListener("click", () => update({ ...value, frameColor: null }));
  refresh(); change(value);
  return {
    panel,
    setDefaultColor(color: string) { defaultColor = color; refresh(); },
    dispose() { panel.remove(); host.style.position = previousPosition; },
  };
}
