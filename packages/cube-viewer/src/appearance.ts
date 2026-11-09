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
  // A host that names a dock region (`data-appearance-dock`) gets the panel as a collapsed section of that region
  // instead of an overlay on the stage. Pages without it keep the floating panel.
  const dockName = (host as { dataset?: DOMStringMap }).dataset?.appearanceDock;
  const dock = dockName ? document.querySelector?.(`[data-region="${dockName}"]`) as HTMLElement | null : null;
  const previousPosition = host.style.position;
  if (!dock) host.style.position = "relative";
  const panel = document.createElement("aside");
  if (dock) {
    for (const stale of Array.from(dock.querySelectorAll(".cube-appearance"))) stale.remove();
    panel.className = "cube-appearance is-docked";
  } else {
    panel.className = "cube-appearance floating-hud floating-hud-appearance";
    Object.assign(panel.style, { position: "absolute", top: "16px", left: "16px", zIndex: "30", textAlign: "left" });
  }

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

  if (dock) header.append(title); else header.append(title, actions);

  const summary = document.createElement("summary");
  summary.className = "cube-appearance-summary";
  summary.setAttribute("aria-label", "Appearance settings");
  summary.textContent = "Appearance";
  summary.style.display = "none";

  const popover = document.createElement("div");
  popover.className = "cube-appearance-popover hud-content";

  const viewportSection = document.createElement("div");
  viewportSection.className = "cube-appearance-section cube-appearance-viewport";
  viewportSection.style.display = "flex";
  popover.append(viewportSection);

  const label = document.createElement("label"); label.textContent = "Construction ";
  const mode = document.createElement("select"); mode.setAttribute("aria-label", "Cube construction");
  for (const [id, title] of [["stickered", "Stickered"], ["stickerless", "Stickerless"]]) {
    const option = document.createElement("option"); option.value = id; option.textContent = title; mode.append(option);
  }
  label.append(mode);
  const note = document.createElement("p"); note.className = "cube-appearance-hint"; note.textContent = "Artwork is kept in both.";
  // Rarely changed settings sit under a native disclosure (keyboard and screen reader support without script).
  const more = document.createElement("details"); more.className = "cube-appearance-more";
  const moreSummary = document.createElement("summary"); moreSummary.textContent = "More";
  const moreBody = document.createElement("div"); moreBody.className = "cube-appearance-more-body";
  const colorLabel = document.createElement("label"); colorLabel.textContent = " Frame color ";
  const color = document.createElement("input"); color.type = "color"; color.setAttribute("aria-label", "Plastic frame color");
  colorLabel.append(color);
  const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Style default";
  moreBody.append(colorLabel, reset);
  more.append(moreSummary, moreBody);
  viewportSection.append(label, note, more);

  panel.append(header, summary, popover);
  let setOpen = (_open: boolean) => {};
  if (dock) {
    // Disclosure: collapsed on every install (the open state is deliberately not remembered).
    popover.id = "cube-appearance-body"; popover.hidden = true;
    const disclosure = document.createElement("button"); disclosure.type = "button"; disclosure.className = "cube-appearance-disclosure";
    disclosure.textContent = "Appearance"; disclosure.setAttribute("aria-expanded", "false"); disclosure.setAttribute("aria-controls", popover.id);
    title.textContent = ""; title.append(disclosure);
    let opener: HTMLElement | null = null;
    setOpen = (open: boolean) => {
      popover.hidden = !open; disclosure.setAttribute("aria-expanded", String(open));
      document.dispatchEvent?.(new CustomEvent("cube-appearance:state", { detail: { open, present: true } }));
    };
    disclosure.addEventListener("click", () => { opener = null; setOpen(Boolean(popover.hidden)); });
    panel.addEventListener("cube-appearance:open", (event) => {
      opener = (event as CustomEvent).detail?.opener ?? null; setOpen(true); disclosure.focus(); panel.scrollIntoView?.({ block: "nearest" });
    });
    panel.addEventListener("cube-appearance:close", () => setOpen(false));
    panel.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key !== "Escape" || popover.hidden) return;
      event.preventDefault(); setOpen(false); (opener ?? disclosure).focus();
    });
    dock.hidden = false; dock.append(panel); setOpen(false);
  } else host.append(panel);

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
        if (isSticker || node.className === "cube-appearance-more-item") {
          moreBody.append(node); // Sticker fonts and lighting rows are rarely changed: under "More", no tabs.
        } else if (viewportSection.insertBefore) {
          viewportSection.insertBefore(node, more); // Primary controls stay ahead of "More" in DOM order.
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
      // A superseded mode can dispose late, after a newer mode docked its own panel (which removed this one): then the
      // dock and the header button belong to the newer panel and stay as they are.
      const wasDocked = !!dock?.contains(panel);
      panel.remove();
      if (dock) {
        if (wasDocked) {
          if (!dock.children.length) dock.hidden = true;
          document.dispatchEvent?.(new CustomEvent("cube-appearance:state", { detail: { open: false, present: false } }));
        }
      } else host.style.position = previousPosition;
    },
  };
}
