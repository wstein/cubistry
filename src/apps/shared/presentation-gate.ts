/** The parts of the document the gate uses, so it can run (and be tested) without a browser. */
export interface FullscreenEnv {
  root(): unknown;
  fullscreenElement(): unknown;
  /** False when the browser has no Fullscreen API: the presentation then runs in the window. */
  canRequest(): boolean;
  request(): Promise<void>;
  exit(): Promise<void>;
}

export interface PresentationGate {
  readonly active: boolean;
  /** Starts the presentation and asks for native fullscreen. A refused request keeps the presentation open. */
  enter(): Promise<void>;
  /** Ends the presentation and closes the fullscreen this gate opened. */
  leave(): Promise<void>;
  /** Call on `fullscreenchange`: leaving fullscreen from the browser ends the presentation. */
  nativeChange(): void;
}

/**
 * Presentation mode with native fullscreen. A fullscreen request that completes after the viewer left, or after a newer
 * request, must neither re-enter nor leave a stray fullscreen: every enter and leave takes a revision, and a request
 * that finds a newer revision only settles the fullscreen it caused. `onChange` runs when the mode starts or ends.
 */
export function createPresentationGate(env: FullscreenEnv, onChange: (active: boolean) => void): PresentationGate {
  let active = false;
  let owned = false;
  let observed = false;
  let revision = 0;
  const update = (value: boolean): void => {
    if (active === value) return;
    active = value;
    onChange(value);
  };
  return {
    get active() {
      return active;
    },
    async enter() {
      if (active) return;
      const current = ++revision;
      observed = Boolean(env.fullscreenElement());
      update(true);
      if (env.fullscreenElement() || !env.canRequest()) return;
      try {
        await env.request();
      } catch {
        return;
      }
      if (!active || current !== revision) {
        if (env.fullscreenElement() === env.root()) {
          if (active) owned = observed = true;
          else await env.exit();
        }
        return;
      }
      owned = observed = true;
    },
    async leave() {
      ++revision;
      const exitNative = owned && Boolean(env.fullscreenElement());
      owned = observed = false;
      update(false);
      if (!exitNative) return;
      try {
        await env.exit();
      } catch {
        /* the browser keeps fullscreen: the viewer leaves it with the browser's own control */
      }
    },
    nativeChange() {
      if (!active) return;
      if (env.fullscreenElement()) observed = true;
      else if (observed) {
        owned = observed = false;
        ++revision;
        update(false);
      }
    },
  };
}

export function documentFullscreenEnv(doc: Document = document): FullscreenEnv {
  return {
    root: () => doc.documentElement,
    fullscreenElement: () => doc.fullscreenElement,
    canRequest: () => typeof doc.documentElement.requestFullscreen === "function",
    request: () => doc.documentElement.requestFullscreen(),
    exit: () => doc.exitFullscreen(),
  };
}
