/**
 * Three-tier HUD idle controller for immersive 3D canvas:
 * - Idle (> 10s of inactivity): panels become invisible (opacity: 0, pointer-events: none)
 * - Ambient (mouse move / activity on canvas): panels become translucent (opacity: 0.38)
 * - Hover / Focus: panels become crisp & readable (opacity: 0.9)
 */

export interface HudIdleOptions {
  readonly timeoutMs?: number;
}

export function installHudIdleController(options: HudIdleOptions = {}): {
  wake(): void;
  destroy(): void;
} {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { wake() {}, destroy() {} };
  }

  const timeoutMs = options.timeoutMs ?? 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function isProtected(): boolean {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) {
      if (
        active.closest(
          ".floating-hud, .floating-hud-appearance, aside.cube-appearance, .floating-island, .controls, .clock-control, .calendar-controls, .status-controls, .floating-glass-pill",
        )
      ) {
        return true;
      }
    }
    const hovered = document.querySelector(
      ".floating-hud:hover, .floating-hud-appearance:hover, aside.cube-appearance:hover, aside.controls:hover, aside.clock-control:hover, aside.calendar-controls:hover, aside.status-controls:hover, .floating-glass-pill:hover",
    );
    return Boolean(hovered);
  }

  function setIdle() {
    if (isProtected()) {
      scheduleIdle();
      return;
    }
    document.body.dataset.hudState = "idle";
  }

  function scheduleIdle() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(setIdle, timeoutMs);
  }

  function wake() {
    if (document.body.dataset.hudState !== "ambient") {
      document.body.dataset.hudState = "ambient";
    }
    scheduleIdle();
  }

  const events = [
    "mousemove",
    "mousedown",
    "touchstart",
    "touchmove",
    "keydown",
    "wheel",
    "pointermove",
  ] as const;

  for (const evt of events) {
    window.addEventListener(evt, wake, { passive: true });
  }

  // Initial state is ambient
  document.body.dataset.hudState = "ambient";
  scheduleIdle();

  return {
    wake,
    destroy() {
      if (timer) clearTimeout(timer);
      for (const evt of events) {
        window.removeEventListener(evt, wake);
      }
      delete document.body.dataset.hudState;
    },
  };
}

export function initHudIdle(timeoutMs = 2000): {
  wake(): void;
  destroy(): void;
} {
  return installHudIdleController({ timeoutMs });
}
