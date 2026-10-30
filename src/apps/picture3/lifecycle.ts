/** A cached page retains its unsaved photos, puzzle and event handlers.
 * Only permanent navigation owns destructive editor/renderer disposal. */
export function bindPictureLifecycle(target: EventTarget, callbacks: { suspend(): void; resume(): void; dispose(): void }): () => void {
  let closed = false;
  const hide = (event: Event) => {
    if (closed) return;
    if ((event as PageTransitionEvent).persisted) callbacks.suspend();
    else { closed = true; callbacks.dispose(); }
  };
  const show = (event: Event) => { if (!closed && (event as PageTransitionEvent).persisted) callbacks.resume(); };
  target.addEventListener("pagehide", hide); target.addEventListener("pageshow", show);
  return () => { target.removeEventListener("pagehide", hide); target.removeEventListener("pageshow", show); };
}
