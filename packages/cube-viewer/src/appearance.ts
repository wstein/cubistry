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
  const panel = document.createElement("aside");
  panel.className = "cube-appearance floating-hud floating-hud-appearance";
  Object.assign(panel.style, {
    position: "absolute",
    top: "16px",
    left: "16px",
    zIndex: "30",
    textAlign: "left",
  });

  const header = document.createElement("div");
  header.className = "hud-header";

  const title = document.createElement("h2");
  title.className = "hud-title";
  title.textContent = "Appearance";

  const actions = document.createElement("div");
  actions.className = "hud-actions";

  const toggleBtn = document.createElement("span");
  toggleBtn.setAttribute("role", "button");
  toggleBtn.setAttribute("tabindex", "0");
  toggleBtn.className = "hud-btn icon-only hud-toggle-btn";
  toggleBtn.title = "Minimize or expand appearance";
  toggleBtn.textContent = "─";
  actions.append(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    if (panel.classList?.toggle) {
      panel.classList.toggle("is-minimized");
      toggleBtn.textContent = panel.classList.contains("is-minimized") ? "⚙" : "─";
    }
  });

  header.append(title, actions);

  const summary = document.createElement("summary");
  summary.className = "cube-appearance-summary";
  summary.setAttribute("aria-label", "Appearance settings");
  summary.textContent = "Appearance";
  summary.style.display = "none";

  const popover = document.createElement("div");
  popover.className = "cube-appearance-popover hud-content";

  const tabNav = document.createElement("div");
  tabNav.className = "cube-appearance-tabs";
  tabNav.setAttribute("role", "tablist");
  tabNav.style.display = "none";

  const tabStickersBtn = document.createElement("span");
  tabStickersBtn.className = "cube-appearance-tab active";
  tabStickersBtn.setAttribute("role", "tab");
  tabStickersBtn.setAttribute("tabindex", "0");
  tabStickersBtn.setAttribute("aria-selected", "true");
  tabStickersBtn.textContent = "Stickers & Type";

  const tabViewportBtn = document.createElement("span");
  tabViewportBtn.className = "cube-appearance-tab";
  tabViewportBtn.setAttribute("role", "tab");
  tabViewportBtn.setAttribute("tabindex", "0");
  tabViewportBtn.setAttribute("aria-selected", "false");
  tabViewportBtn.textContent = "3D & Viewport";

  tabNav.append(tabStickersBtn, tabViewportBtn);

  const stickersSection = document.createElement("div");
  stickersSection.className = "cube-appearance-section cube-appearance-stickers";
  stickersSection.style.display = "none";

  const viewportSection = document.createElement("div");
  viewportSection.className = "cube-appearance-section cube-appearance-viewport";
  viewportSection.style.display = "block";

  const switchTab = (tab: "stickers" | "viewport") => {
    tabStickersBtn.className = `cube-appearance-tab${tab === "stickers" ? " active" : ""}`;
    tabStickersBtn.setAttribute("aria-selected", String(tab === "stickers"));
    tabViewportBtn.className = `cube-appearance-tab${tab === "viewport" ? " active" : ""}`;
    tabViewportBtn.setAttribute("aria-selected", String(tab === "viewport"));
    stickersSection.style.display = tab === "stickers" ? "block" : "none";
    viewportSection.style.display = tab === "viewport" ? "block" : "none";
  };

  const bindTabEvents = (el: HTMLElement, tab: "stickers" | "viewport") => {
    el.addEventListener("click", () => switchTab(tab));
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        switchTab(tab);
      }
    });
  };
  bindTabEvents(tabStickersBtn, "stickers");
  bindTabEvents(tabViewportBtn, "viewport");

  popover.append(tabNav, stickersSection, viewportSection);

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
  viewportSection.append(label, colorLabel, reset, note);

  panel.append(header, summary, popover);
  host.append(panel);

  const originalAppend = panel.append.bind(panel);
  panel.append = (...nodes: any[]) => {
    for (const node of nodes) {
      if (node === header || node === summary || node === popover) {
        originalAppend(node);
      } else {
        const text = String(node.textContent ?? "").toLowerCase();
        const id = String(node.id ?? "").toLowerCase();
        const isSticker =
          id.includes("display") ||
          id.includes("letter") ||
          id.includes("marker") ||
          text.includes("display") ||
          text.includes("letter") ||
          text.includes("marker");
        if (isSticker) {
          stickersSection.append(node);
          tabNav.style.display = "flex";
          switchTab("stickers");
        } else {
          viewportSection.append(node);
        }
      }
    }
  };

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
    dispose() {
      panel.remove();
      host.style.position = previousPosition;
    },
  };
}
