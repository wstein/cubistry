export interface PresentationDragBinding { (): void; dispose(): void }
export interface PresentationDragLifecycle {
  down?(event: PointerEvent): void;
  up?(event: PointerEvent | undefined, cancelled: boolean): void;
}
/** Pointer routing shared by presentation owners; no puzzle or camera ownership.
 * Multiple contacts hold orientation until all are released (no implicit pinch). */
export function installPresentationDrag(
  element: HTMLElement,
  move: (dx: number, dy: number, elapsed: number) => void,
  threshold = 0,
  lifecycle: PresentationDragLifecycle = {},
): PresentationDragBinding {
  type Drag = { x: number; y: number; startX: number; startY: number; time: number; active: boolean };
  const pointers = new Map<number, Drag>();
  let blocked = false, disposed = false;
  const releaseCapture = (id: number) => { try { if (element.hasPointerCapture(id)) element.releasePointerCapture(id); } catch { /* Capture may already be lost. */ } };
  const down = (e: PointerEvent) => {
    if (disposed) return;
    lifecycle.down?.(e); // Interrupt pending/active motion before the movement threshold.
    if (pointers.has(e.pointerId)) return;
    if (pointers.size) blocked = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
      time: e.timeStamp, active: threshold === 0 });
    try { element.setPointerCapture(e.pointerId); } catch {
      // Without capture an outside release may never reach this element.
      // Never retain that contact as a ghost that blocks future gestures.
      pointers.delete(e.pointerId);
      if (!pointers.size) { blocked = false; lifecycle.up?.(e, true); }
    }
  };
  const motion = (e: PointerEvent) => {
    const drag = pointers.get(e.pointerId);
    if (!drag || blocked || disposed) return;
    if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < threshold) return;
    drag.active = true;
    move(e.clientX - drag.x, e.clientY - drag.y, e.timeStamp - drag.time);
    drag.x = e.clientX; drag.y = e.clientY; drag.time = e.timeStamp;
  };
  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId) || disposed) return;
    releaseCapture(e.pointerId);
    if (pointers.size) return;
    const cancelled = blocked || e.type !== "pointerup"; blocked = false;
    lifecycle.up?.(e, cancelled);
  };
  const cancel = () => {
    const ids = [...pointers.keys()]; pointers.clear(); blocked = false;
    for (const id of ids) releaseCapture(id);
    if (ids.length && !disposed) lifecycle.up?.(undefined, true);
  };
  element.addEventListener("pointerdown", down); element.addEventListener("pointermove", motion);
  element.addEventListener("pointerup", release); element.addEventListener("pointercancel", release); element.addEventListener("lostpointercapture", release);
  cancel.dispose = () => {
    element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", motion);
    element.removeEventListener("pointerup", release); element.removeEventListener("pointercancel", release); element.removeEventListener("lostpointercapture", release);
    cancel(); disposed = true;
  };
  return cancel;
}
