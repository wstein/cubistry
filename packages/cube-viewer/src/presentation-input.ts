/** Pointer routing shared by presentation owners; no puzzle or camera ownership. */
export function installPresentationDrag(
  element: HTMLElement,
  move: (dx: number, dy: number, elapsed: number) => void,
  threshold = 0,
): () => void {
  let drag: { id: number; x: number; y: number; startX: number; startY: number; time: number; active: boolean } | null = null;
  element.addEventListener("pointerdown", e => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
      time: e.timeStamp, active: threshold === 0 };
    element.setPointerCapture(e.pointerId);
  });
  element.addEventListener("pointermove", e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < threshold) return;
    drag.active = true;
    move(e.clientX - drag.x, e.clientY - drag.y, e.timeStamp - drag.time);
    drag.x = e.clientX; drag.y = e.clientY; drag.time = e.timeStamp;
  });
  const cancel = () => {
    const id = drag?.id;
    drag = null;
    if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  const release = (e: PointerEvent) => { if (drag?.id === e.pointerId) cancel(); };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", release);
  return cancel;
}
