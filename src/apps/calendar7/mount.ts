// SPDX-License-Identifier: AGPL-3.0-or-later
/** DOM mount of the English 7x7 calendar mode (research candidate, not certified). */
import type { ModeInstance } from "../registry.ts";
import { parseDisplays, parseGraph, parseState } from "./graph.ts";
import { type Pose, type Printing, stateDigest } from "./engine.ts";
import {
  announce,
  buildModel,
  chainRange,
  chooseMonth,
  monthLabel,
  nodeIndex,
  pageHtml,
  playerHtml,
  type YearMonth,
} from "./month-view.ts";
import { Calendar7Player, DEFAULT_DEFER, DEFAULT_SLICE, DEFAULT_SPEED, type PlayerSnapshot, type StageView } from "./player.ts";

/** The 3D scene the mount drives (src/apps/calendar7/viewer.ts; a fake in the tests). */
export interface Stage extends StageView {
  configure(printing: Printing, pose: Pose): void;
  setLabel(text: string): void;
  resetView(): void;
  destroy(): void;
}

export interface MountEnv {
  /** Base URL of the site, ending in a slash. */
  base: string;
  fetchJson(url: string): Promise<unknown>;
  now(): Date;
  /** Current query string of the address bar, with the leading `?` or empty. */
  search(): string;
  /** Replaces the query of the address bar without a history entry. */
  replaceQuery(search: string): void;
  isCurrent(): boolean;
  /** The element the 3D scene is drawn into (the studio scene). Without it, and without `createStage`, there is no 3D view. */
  sceneHost?(): HTMLElement | null;
  createStage?(host: HTMLElement, rotationPanel: HTMLElement): Promise<Stage>;
  /** True when the user asked for reduced motion: a step then jumps to its end state. */
  reducedMotion?(): boolean;
}

const MY_PARAMS = ["year", "month"];

export async function mountCalendar7(
  root: HTMLElement,
  params: URLSearchParams,
  env: MountEnv,
): Promise<ModeInstance | void> {
  const threeD = Boolean(env.sceneHost && env.createStage);
  root.innerHTML =
    '<div class="c7-live" role="status" aria-live="polite"></div>' +
    (threeD ? playerHtml(DEFAULT_SPEED) : "") +
    '<div class="c7-view"><p class="c7-loading">Loading the 7x7 calendar data…</p></div>';
  const view = root.querySelector(".c7-view") as HTMLElement;
  const live = root.querySelector(".c7-live") as HTMLElement;
  const [graphJson, displaysJson, stateJson] = await Promise.all([
    env.fetchJson(`${env.base}calendar7/graph.v1.json`),
    env.fetchJson(`${env.base}calendar7/displays.v1.json`),
    threeD ? env.fetchJson(`${env.base}calendar7/state.v1.json`) : undefined,
  ]);
  if (!env.isCurrent()) return;
  const graph = parseGraph(graphJson);
  const table = parseDisplays(displaysJson);
  const start = threeD ? parseState(stateJson) : null;
  const range = chainRange(graph);
  const d = env.now();
  const today: YearMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };
  let disposed = false;
  const alive = (): boolean => !disposed && env.isCurrent();

  // ---- 3D view (absent in the plain-HTML configuration) ----
  const q = (name: string): HTMLElement | null =>
    threeD ? (root.querySelector(`[data-c7="${name}"]`) as HTMLElement | null) : null;
  const sceneHost = threeD ? (env.sceneHost as () => HTMLElement | null)() : null;
  let stage: Stage | null = null;
  let player: Calendar7Player | null = null;
  let pending: Promise<void> | null = null;
  let wanted: number | null = null;
  let previous: PlayerSnapshot | null = null;
  const reduced = (): boolean => env.reducedMotion?.() ?? false;
  /** After a failed check the 3D view stays stopped until the page is reloaded. */
  let failed = false;
  /** aria-disabled, not disabled: a button that becomes inactive at the end of a step keeps the keyboard focus. */
  const setInactive = (el: HTMLElement | null, inactive: boolean): void => {
    if (!el) return;
    if (inactive) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  };

  const fail = (error: Error): void => {
    failed = true;
    wanted = null;
    player?.dispose();
    player = null;
    stage?.destroy();
    stage = null;
    root.setAttribute("data-c7-state", "failed");
    const box = q("error");
    if (box) {
      box.textContent = `The 3D view stopped: ${error.message}. The month sheet below is not affected. Reload the page to try again.`;
      box.hidden = false;
    }
    (q("player") as HTMLElement | null)?.removeAttribute("hidden");
    for (const name of ["play", "skip", "speed", "reset", "slice", "defer"]) q(name)?.setAttribute("disabled", "");
    live.textContent = "The 3D view stopped. The month sheet is still shown.";
    if (sceneHost) sceneHost.hidden = true;
    console.error(error);
  };

  const render = (snap: PlayerSnapshot): void => {
    if (failed) return;
    const playing = snap.status === "playing";
    const active = snap.total > 0;
    const motionOff = reduced();
    const play = q("play") as HTMLButtonElement | null;
    const skip = q("skip") as HTMLButtonElement | null;
    const speed = q("speed") as HTMLSelectElement | null;
    if (play) {
      play.textContent = playing ? "Pause" : "Play";
    }
    setInactive(play, !active || motionOff);
    setInactive(skip, !active || motionOff);
    if (speed) {
      speed.value = String(snap.speed);
      speed.disabled = motionOff;
    }
    const note = q("note");
    if (note) note.hidden = !motionOff;
    const target = graph.nodes[snap.index];
    const progress = q("progress");
    if (progress && target) {
      progress.textContent = active
        ? snap.phase === "alignment"
          ? `Turning to ${monthLabel(target)}: aligning the cube at the end (${snap.alignment})${snap.status === "paused" ? " (paused)" : ""}`
          : `Turning to ${monthLabel(target)}: block ${snap.done} of ${snap.total}${snap.status === "paused" ? " (paused)" : ""}`
        : `The cube shows ${monthLabel(target)}.`;
    }
    // The alignment is a free whole-cube rotation, shown apart from the move counts.
    const alignment = q("alignment");
    if (alignment) alignment.textContent = `Alignment: ${snap.alignment}`;
    if (target) stage?.setLabel(`7x7 calendar cube showing ${monthLabel(target)}`);
    if (!active && player) {
      root.setAttribute("data-c7-state", "idle");
      // Test hook and proof for readers: the digest of the pose the view shows, computed here, not copied from the graph.
      root.setAttribute("data-c7-digest", stateDigest((start as { printing: Printing }).printing, player.shownPose));
      root.setAttribute("data-c7-month", `${target.year}-${String(target.month).padStart(2, "0")}`);
      if (previous && previous.total > 0 && !motionOff) live.textContent = `The cube has turned to ${monthLabel(target)}.`;
    } else {
      root.setAttribute("data-c7-state", snap.status);
    }
    previous = snap;
  };

  /** Creates the stage and the player once; later calls wait for the same work. */
  const ensure = (): Promise<void> => {
    pending ??= (async () => {
      const host = sceneHost as HTMLElement;
      const panel = q("rotation") as HTMLElement;
      const made = await (env.createStage as NonNullable<MountEnv["createStage"]>)(host, panel);
      if (!alive()) {
        made.destroy();
        return;
      }
      stage = made;
      const s = start as NonNullable<typeof start>;
      made.configure(s.printing, s.pose);
      player = new Calendar7Player({
        graph,
        printing: s.printing,
        root: s.pose,
        view: made,
        reducedMotion: reduced,
        onChange: render,
        onError: fail,
        slice: (q("slice") as HTMLInputElement | null)?.checked ?? DEFAULT_SLICE,
        defer: (q("defer") as HTMLInputElement | null)?.checked ?? DEFAULT_DEFER,
      });
    })();
    return pending;
  };

  const syncStage = async (index: number | null): Promise<void> => {
    if (!threeD || failed) return;
    wanted = index;
    if (index === null) {
      if (sceneHost) sceneHost.hidden = true;
      (q("player") as HTMLElement | null)?.setAttribute("hidden", "");
      return;
    }
    // The space is reserved at once; the cube appears when the scene is built.
    (sceneHost as HTMLElement).hidden = false;
    (q("player") as HTMLElement).hidden = false;
    try {
      await ensure();
      if (!alive()) return;
      if (wanted === null || !player) return;
      player.go(wanted);
    } catch (error) {
      if (alive()) fail(error as Error);
    }
  };

  /** The static sentence about the deferred rotations belongs to the 3D view and to the option being on. */
  const syncAlignText = (): void => {
    const on = threeD && ((q("defer") as HTMLInputElement | null)?.checked ?? DEFAULT_DEFER);
    view.querySelectorAll?.("[data-align]").forEach((el) => ((el as HTMLElement).hidden = !on));
  };
  const show = (p: URLSearchParams, moveFocus: boolean): void => {
    const choice = chooseMonth(p, today, range);
    const model = buildModel(graph, table, choice, today);
    view.innerHTML = pageHtml(model);
    syncAlignText();
    live.textContent = announce(model);
    // The link that was clicked is gone after the re-render: keep the keyboard position at the new month.
    // No scroll: the cube above must stay in view while the step plays.
    if (moveFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true });
    if (threeD) {
      // A sheet exists exactly when the month is on the chain; the cube follows the same month.
      const k = choice.kind === "ok" ? nodeIndex(range, choice.ym) : -1;
      void syncStage(k >= 0 ? k : null);
    }
  };
  show(params, false);

  // Navigation links are plain `?app=calendar7&year=&month=` links; follow them without a reload.
  const onClick = (e: Event): void => {
    const a = (e.target as Element | null)?.closest?.("a.c7-nav") as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    e.preventDefault();
    const next = new URL(a.getAttribute("href") as string, "http://x/").searchParams;
    const keep = new URLSearchParams(env.search());
    for (const k of MY_PARAMS) keep.delete(k);
    for (const k of MY_PARAMS) if (next.has(k)) keep.set(k, next.get(k) as string);
    env.replaceQuery(`?${keep.toString()}`);
    show(next, true);
  };
  root.addEventListener("click", onClick);

  const onControl = (e: Event): void => {
    const el = (e.target as Element | null)?.closest?.("[data-c7]") as HTMLElement | null;
    if (!el || !root.contains(el) || !player || failed) return;
    if (el.getAttribute("aria-disabled") === "true") return;
    try {
      switch (el.getAttribute("data-c7")) {
        case "play":
          if (player.snapshot.status === "playing") player.pause();
          else player.play();
          break;
        case "skip":
          player.skip();
          break;
        case "reset":
          stage?.resetView();
          break;
        case "speed":
          player.setSpeed(Number((el as HTMLSelectElement).value));
          break;
        case "slice":
          player.setSlice((el as HTMLInputElement).checked);
          break;
        case "defer":
          player.setDefer((el as HTMLInputElement).checked);
          syncAlignText();
          break;
      }
    } catch (error) {
      fail(error as Error);
    }
  };
  if (threeD) {
    root.addEventListener("click", onControl);
    root.addEventListener("change", onControl);
  }

  return {
    dispose: () => {
      disposed = true;
      root.removeEventListener("click", onClick);
      if (threeD) {
        root.removeEventListener("click", onControl);
        root.removeEventListener("change", onControl);
      }
      player?.dispose();
      stage?.destroy();
      if (sceneHost) sceneHost.hidden = false;
    },
  };
}

/** The environment of a real page. */
export function browserMountEnv(base: string, isCurrent: () => boolean): MountEnv {
  return {
    base,
    fetchJson: async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    },
    now: () => new Date(),
    search: () => location.search,
    replaceQuery: (search) => history.replaceState(null, "", `${location.pathname}${search}${location.hash}`),
    isCurrent,
    sceneHost: () => document.getElementById("studio-scene"),
    reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    createStage: async (host, panel) => {
      // The sticker texts use the page font when it is available; drawing never waits for it longer than 1.5 s.
      try {
        const wait = new Promise((resolve) => setTimeout(resolve, 1500));
        await Promise.race([document.fonts.load('600 40px "Counter Sans"'), wait]);
      } catch {
        /* the fallback font is used */
      }
      // Three.js and the viewer are loaded only when a month of the chain is shown.
      const { Calendar7Viewer } = await import("./viewer.ts");
      return new Calendar7Viewer(host, panel);
    },
  };
}
