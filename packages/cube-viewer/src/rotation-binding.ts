import type { Object3D } from "three";
import { SmartRotation, rotationModes, type RotationMode } from "./smart-rotation.ts";
import { installPresentationDrag } from "./presentation-input.ts";
export interface RotationEnvironment {
  now(): number;
  document: Pick<Document, "hidden" | "createElement" | "addEventListener" | "removeEventListener">;
  window?: Pick<Window, "addEventListener" | "removeEventListener">;
  media: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
  storage?: Pick<Storage, "getItem" | "setItem">;
  pathname: string;
}
export const rotationStorageKey = (pathname: string) => `cubistry-viewer-rotation-v1:${pathname.slice(0, 200)}`;
export function readRotationMode(storage: Pick<Storage, "getItem"> | undefined, key: string): RotationMode {
  try {
    const raw = storage?.getItem(key); if (!raw || raw.length > 256) return "smart";
    const value = JSON.parse(raw); return value?.version === 1 && rotationModes.includes(value.mode) ? value.mode : "smart";
  } catch { return "smart"; }
}
function browserEnvironment(): RotationEnvironment {
  let storage: RotationEnvironment["storage"]; try { storage = localStorage; } catch { /* Private mode can deny access. */ }
  return { now: () => performance.now() / 1000, document, window, media: matchMedia("(prefers-reduced-motion: reduce)"), storage, pathname: location.pathname };
}
let noteSerial = 0;
/** One binding per viewport, including one for the entire shared clock assembly. */
export function bindSmartRotation(element: HTMLElement, root: Object3D, options: {
  sensitivity: number; threshold?: number; panel: HTMLElement; changed?: () => void; environment?: RotationEnvironment;
}) {
  if (!Number.isFinite(options.sensitivity) || options.sensitivity <= 0) throw Error("Invalid rotation sensitivity");
  const env = options.environment ?? browserEnvironment(), key = rotationStorageKey(env.pathname);
  const controller = new SmartRotation(root.quaternion, readRotationMode(env.storage, key), env.media.matches);
  let disposed = false, canvasHeld = false, blockedOverlap = false, focused = true;
  const panelPointers = new Set<number>();
  const apply = () => root.quaternion.copy(controller.quaternion);
  const previousTouchAction = element.style.touchAction; element.style.touchAction = "none";
  const drag = installPresentationDrag(element, (dx, dy) => {
    if (panelPointers.size || blockedOverlap) return;
    controller.drag(dy * options.sensitivity, dx * options.sensitivity, env.now());
    apply(); if (dx || dy) options.changed?.();
  }, options.threshold ?? 0, {
    down() { canvasHeld = true; if (panelPointers.size) blockedOverlap = true; controller.down(env.now()); apply(); },
    up(_event, cancelled) {
      canvasHeld = false;
      if (!panelPointers.size) { controller.up(env.now(), cancelled || blockedOverlap); blockedOverlap = false; }
      apply();
    },
  });
  const label = env.document.createElement("label"); label.textContent = " Rotation ";
  const select = env.document.createElement("select"); select.setAttribute("aria-label", "View rotation mode");
  for (const [value, text] of [["smart", "Smart Rubber Band"], ["free", "Free Rotation"], ["classic", "Classic"]]) {
    const option = env.document.createElement("option"); option.value = value; option.textContent = text; select.append(option);
  }
  const note = env.document.createElement("p"); note.id = `cube-rotation-note-${++noteSerial}`; note.style.margin = "6px 0 0";
  select.setAttribute("aria-describedby", note.id); label.append(select); options.panel.append(label, note);
  const refresh = () => {
    select.value = controller.mode;
    note.textContent = controller.reducedMotion ? "Reduced motion: inertia and automatic return are off; choosing an upright mode levels gently over 150 ms."
      : controller.mode === "smart" ? "Smart upright: views within 35° of the front stay; larger ones spring back to the front after settling and 2 seconds idle."
      : controller.mode === "free" ? "Free Rotation: full rotation with inertia, without automatic return." : "Classic upright: direct rotation, without inertia or automatic return.";
  };
  const change = () => {
    if (disposed) return;
    if (!rotationModes.includes(select.value as RotationMode)) { refresh(); return; }
    controller.setMode(select.value as RotationMode, env.now()); apply(); refresh();
    try { env.storage?.setItem(key, JSON.stringify({ version: 1, mode: controller.mode })); } catch { /* Motion stays usable without persistence. */ }
  };
  const panelDown = (event: Event) => {
    if (disposed) return;
    const id = (event as PointerEvent).pointerId;
    panelPointers.add(id); if (canvasHeld) blockedOverlap = true;
    controller.down(env.now()); apply();
  };
  const panelRelease = (event: Event) => {
    if (disposed || !panelPointers.delete((event as PointerEvent).pointerId) || panelPointers.size) return;
    if (!canvasHeld) { controller.up(env.now(), true); blockedOverlap = false; apply(); }
  };
  const clearContacts = () => { panelPointers.clear(); drag(); canvasHeld = false; blockedOverlap = false; };
  const blur = () => { if (!disposed) { focused = false; controller.suspend(env.now()); clearContacts(); apply(); } };
  const focus = () => { if (!disposed) { focused = true; if (!env.document.hidden) controller.resume(env.now()); apply(); } };
  const panelActivity = () => { if (!disposed) { controller.interact(env.now()); apply(); } };
  const preference = () => { if (!disposed) { controller.setReducedMotion(env.media.matches, env.now()); apply(); refresh(); } };
  const visibility = () => {
    if (disposed) return;
    if (env.document.hidden) { controller.suspend(env.now()); clearContacts(); }
    else if (focused) controller.resume(env.now());
    apply();
  };
  options.panel.addEventListener("pointerdown", panelDown);
  for (const type of ["keydown", "input", "change"]) options.panel.addEventListener(type, panelActivity);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) env.document.addEventListener(type, panelRelease, true);
  env.window?.addEventListener("blur", blur); env.window?.addEventListener("focus", focus);
  select.addEventListener("change", change); env.media.addEventListener("change", preference); env.document.addEventListener("visibilitychange", visibility);
  refresh(); if (env.document.hidden) controller.suspend(env.now()); apply();
  return {
    controller,
    step() { if (!disposed) { controller.step(env.now()); apply(); } },
    interact() { if (!disposed) { controller.interact(env.now()); apply(); } },
    reset() { if (!disposed) { controller.reset(env.now()); drag(); apply(); } },
    dispose() {
      if (disposed) return; disposed = true; controller.dispose(); drag.dispose();
      select.removeEventListener("change", change); env.media.removeEventListener("change", preference); env.document.removeEventListener("visibilitychange", visibility);
      options.panel.removeEventListener("pointerdown", panelDown);
      for (const type of ["keydown", "input", "change"]) options.panel.removeEventListener(type, panelActivity);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) env.document.removeEventListener(type, panelRelease, true);
      env.window?.removeEventListener("blur", blur); env.window?.removeEventListener("focus", focus); panelPointers.clear();
      label.remove(); note.remove(); element.style.touchAction = previousTouchAction;
    },
  };
}
export type SmartRotationBinding = ReturnType<typeof bindSmartRotation>;
