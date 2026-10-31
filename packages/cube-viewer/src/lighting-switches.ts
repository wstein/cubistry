import { PRESENTATION_PRESET } from "./presentation-preset.ts";

export interface LightingOptions { contactShadow: boolean; colorTemperature: boolean }
export const defaultLightingOptions = (): LightingOptions => ({
  contactShadow: PRESENTATION_PRESET.contactShadowDefault,
  colorTemperature: PRESENTATION_PRESET.colorTemperatureDefault,
});
/** Own small versioned key; the appearance storage format stays unchanged. */
export const lightingStorageKey = (pathname: string) => `cubistry-viewer-lighting-v1:${pathname.slice(0, 200)}`;
export function readLightingOptions(storage: Pick<Storage, "getItem"> | undefined, key: string): LightingOptions {
  const fallback = defaultLightingOptions();
  try {
    const raw = storage?.getItem(key); if (!raw || raw.length > 256) return fallback;
    const value = JSON.parse(raw);
    if (value?.version !== 1) return fallback;
    return {
      contactShadow: typeof value.contactShadow === "boolean" ? value.contactShadow : fallback.contactShadow,
      colorTemperature: typeof value.colorTemperature === "boolean" ? value.colorTemperature : fallback.colorTemperature,
    };
  } catch { return fallback; }
}
export interface LightingSwitchTarget {
  setContactShadow(on: boolean): void;
  setColorTemperature(on: boolean): void;
}
export interface LightingEnvironment {
  document: Pick<Document, "createElement">;
  storage?: Pick<Storage, "getItem" | "setItem">;
  pathname: string;
}
function browserEnvironment(): LightingEnvironment {
  let storage: LightingEnvironment["storage"]; try { storage = localStorage; } catch { /* Private mode can deny access. */ }
  return { document, storage, pathname: location.pathname };
}
/** Adds "Contact shadow" and "Warm studio light" checkboxes to the shared
 * Appearance panel, applies the persisted (or default) state to the studio. */
export function bindLightingSwitches(panel: HTMLElement, studio: LightingSwitchTarget, environment?: LightingEnvironment) {
  const env = environment ?? browserEnvironment(), key = lightingStorageKey(env.pathname);
  const state = readLightingOptions(env.storage, key);
  const rows: HTMLElement[] = [], listeners: [HTMLInputElement, () => void][] = [];
  const add = (text: string, name: keyof LightingOptions, apply: (on: boolean) => void) => {
    const label = env.document.createElement("label") as HTMLLabelElement; label.style.display = "block";
    const box = env.document.createElement("input") as HTMLInputElement; box.type = "checkbox"; box.checked = state[name];
    label.append(box, ` ${text}`); rows.push(label); apply(state[name]);
    const change = () => {
      state[name] = box.checked; apply(box.checked);
      try { env.storage?.setItem(key, JSON.stringify({ version: 1, ...state })); } catch { /* Lighting stays usable without persistence. */ }
    };
    box.addEventListener("change", change); listeners.push([box, change]);
  };
  add("Contact shadow", "contactShadow", on => studio.setContactShadow(on));
  add("Warm studio light", "colorTemperature", on => studio.setColorTemperature(on));
  panel.append(...rows);
  return {
    dispose() {
      for (const [box, change] of listeners) box.removeEventListener("change", change);
      listeners.length = 0; for (const row of rows) row.remove(); rows.length = 0;
    },
  };
}
export type LightingSwitches = ReturnType<typeof bindLightingSwitches>;
