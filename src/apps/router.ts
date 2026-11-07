import { urlAfterAppSwitch } from "../app-switch-url.mjs";
import { createModeSwitcher, type IsCurrent } from "./chronocube/mode-switch.ts";
import type { AppMode, AppRegistry } from "./registry.ts";

/** The single URL key of the application: `index.html?app=<id>`. */
export const APP_PARAM = "app";

/** The parts of `window` the router uses, so it can run (and be tested) without a browser. */
export interface RouterEnv {
  href(): string;
  push(url: string): void;
  replace(url: string): void;
  /** Registers a back/forward listener and returns the function that removes it. */
  onPop(listener: () => void): () => void;
}

export function browserEnv(): RouterEnv {
  return {
    href: () => location.href,
    push: (url) => history.pushState(null, "", url),
    replace: (url) => history.replaceState(null, "", url),
    onPop: (listener) => {
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
  };
}

/** Reads the app id from a query string. An unknown or missing id resolves to `fallback` with `known: false`. */
export function parseAppRoute(search: string, registry: AppRegistry, fallback: string): { id: string; known: boolean } {
  const id = new URLSearchParams(search).get(APP_PARAM);
  return id && registry.has(id) ? { id, known: true } : { id: fallback, known: false };
}

export interface RouterOptions {
  registry: AppRegistry;
  /** Host element passed to every mount. */
  root: HTMLElement | object;
  /** Id used when the URL names no registered app. */
  fallback: string;
  env?: RouterEnv;
  /** Runs for the incoming mode after the previous mode was disposed and before its mount. */
  onBefore?: (mode: AppMode) => void;
  /** Runs when the mode finished mounting and is still the latest switch. */
  onMounted?: (mode: AppMode) => void;
  onError?: (err: Error, id: string) => void;
  onCleanupError?: (err: Error) => void;
}

export function createRouter(options: RouterOptions) {
  const { registry, root, fallback, onBefore, onMounted } = options;
  const env = options.env ?? browserEnv();
  let current: string | null = null;
  let target: string = fallback;
  const switcher = createModeSwitcher(
    (err) => options.onError?.(err, target),
    (err) => options.onCleanupError?.(err),
  );
  let stopPop: (() => void) | null = null;

  /** Mounts `id`; `history` says how the URL follows: pushed, replaced, or left alone. */
  async function show(id: string, history: "push" | "replace" | "none"): Promise<boolean> {
    const mode = registry.get(id) as AppMode;
    const next = new URL(env.href());
    next.searchParams.set(APP_PARAM, id);
    const url = urlAfterAppSwitch(next.href, current, id);
    const here = new URL(env.href());
    if (history !== "none" && url !== here.pathname + here.search + here.hash) {
      if (history === "push") env.push(url);
      else env.replace(url);
    }
    const params = new URLSearchParams(new URL(url, env.href()).search);
    params.delete(APP_PARAM);
    target = id;
    const ok = await switcher.switchTo(
      async (isCurrent: IsCurrent) => {
        const instance = await mode.mount(root as HTMLElement, params, { isCurrent });
        return () => instance?.dispose();
      },
      () => {
        current = id;
        onBefore?.(mode);
      },
    );
    if (ok && current === id) onMounted?.(mode);
    return ok;
  }

  return {
    /** Mounts the app named by the current URL and starts following back/forward. */
    async start(): Promise<boolean> {
      stopPop?.();
      stopPop = env.onPop(() => {
        void show(parseAppRoute(new URL(env.href()).search, registry, fallback).id, "none");
      });
      const route = parseAppRoute(new URL(env.href()).search, registry, fallback);
      return show(route.id, route.known ? "none" : "replace");
    },
    /** Switches to `id` without a reload. App-scoped parameters of the previous app are dropped. */
    go(id: string): Promise<boolean> {
      return show(registry.has(id) ? id : fallback, "push");
    },
    current: () => current,
    dispose(): void {
      stopPop?.();
      stopPop = null;
      void switcher.switchTo(async () => null);
      current = null;
    },
  };
}
