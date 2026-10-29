export interface PresentationOptions {
  readonly app: "calendar" | "clock";
  readonly hide: readonly string[];
  readonly resetView: () => void;
}
/** Changes display layout and camera only; the running physical app stays mounted. */
export function installPresentation(options: PresentationOptions): {
  setReady(ready: boolean): void;
} {
  const main = document.querySelector("main");
  if (!main) throw Error("Presentation requires the application container");
  const tools = document.createElement("nav");
  tools.id = "presentation-tools";
  tools.className = "presentation-tools";
  tools.setAttribute("aria-label", "Display view");
  const toggle = document.createElement("button");
  toggle.id = "presentation-toggle";
  toggle.type = "button";
  toggle.textContent = "Present";
  toggle.setAttribute("aria-pressed", "false");
  const reset = document.createElement("button");
  reset.id = "presentation-reset";
  reset.type = "button";
  reset.textContent = "Reference view";
  const feedback = document.createElement("p");
  feedback.id = "presentation-feedback";
  feedback.className = "presentation-feedback sr-only";
  feedback.setAttribute("role", "status");
  tools.append(toggle, reset, feedback);
  main.prepend(tools);
  for (const selector of options.hide)
    for (const element of document.querySelectorAll<HTMLElement>(selector))
      element.dataset.presentationHide = "";
  document.body.dataset.presentationApp = options.app;
  let active = false,
    ownedFullscreen = false,
    observedFullscreen = false,
    revision = 0;
  const update = (value: boolean) => {
    active = value;
    document.body.dataset.presentation = String(value);
    toggle.textContent = value ? "Show controls" : "Present";
    toggle.setAttribute("aria-pressed", String(value));
    feedback.textContent = value
      ? "Presentation mode. Press Escape or Show controls to return."
      : "Controls restored.";
  };
  const leave = async () => {
    ++revision;
    const exitNative = ownedFullscreen && document.fullscreenElement;
    ownedFullscreen = false;
    observedFullscreen = false;
    update(false);
    if (exitNative) {
      try {
        await document.exitFullscreen();
      } catch {
        feedback.textContent =
          "Controls restored. Use the browser to leave fullscreen.";
      }
    }
    toggle.focus();
  };
  toggle.addEventListener("click", async () => {
    if (active) {
      await leave();
      return;
    }
    const current = ++revision;
    observedFullscreen = Boolean(document.fullscreenElement);
    update(true);
    if (document.fullscreenElement) return;
    if (!document.documentElement.requestFullscreen) {
      feedback.textContent =
        "Presentation mode. Fullscreen is unavailable in this browser.";
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      if (!active || current !== revision) {
        if (document.fullscreenElement === document.documentElement) {
          if (active) {
            ownedFullscreen = observedFullscreen = true;
            feedback.textContent =
              "Presentation mode. Press Escape or Show controls to return.";
          } else await document.exitFullscreen();
        }
        return;
      }
      ownedFullscreen = true;
      observedFullscreen = true;
    } catch {
      if (active && current === revision)
        feedback.textContent =
          "Presentation mode. Fullscreen is unavailable in this browser.";
    }
  });
  reset.addEventListener("click", () => {
    options.resetView();
    feedback.textContent = "Reference view restored.";
  });
  document.addEventListener("fullscreenchange", () => {
    if (!active) return;
    if (document.fullscreenElement) observedFullscreen = true;
    else if (observedFullscreen) {
      ownedFullscreen = false;
      observedFullscreen = false;
      ++revision;
      update(false);
      toggle.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      void leave();
    }
  });
  const setReady = (ready: boolean) => {
    toggle.disabled = reset.disabled = !ready;
  };
  setReady(false);
  return { setReady };
}
