// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The German A and English 3 date cubes as the mode `calendar` of the unified host (`index.html?app=calendar`). It
 * mounts the existing `CalendarViewer` (its own canvas, not the shared viewer), `CalendarController` and
 * `CalendarOptimizer`; the planner and its solver bundle are loaded only when the mode opens. The controls keep the
 * element ids of the former page `calendar.html`.
 */
import {
  civilDate,
  demand,
  findTarget,
  front,
  localDate,
  shiftDate,
  validateDesign,
  type CivilDate,
  type Design,
  type State,
} from "./model.ts";
import { CalendarController, type CalendarPort, type CalendarRoutePlanner } from "./controller.ts";
import type { ModeInstance, MountContext } from "../registry.ts";

export interface CalendarViewerLike extends CalendarPort {
  duration: number;
  readonly presentedState: State | null;
  readonly animating: boolean;
  resetReferenceView(): void;
  destroy(): void;
}

export interface CalendarOptimizerLike {
  readonly plan: CalendarRoutePlanner;
  readonly solverStatus: string;
  dispose(): void;
}

/** Everything the mount takes from the browser, so node tests can run it with fakes. */
export interface CalendarEnv {
  /** Element that receives the controls (the dock `#studio-controls` of the host). */
  controls: HTMLElement;
  /** Verified runtime of one print: `de-a`, `en-3-zero` or `en-3-unpadded`. Rejects with the reason shown to the user. */
  loadDesign(id: string): Promise<Design>;
  now(): number;
  /** Resolves when the fonts of the sticker artwork are usable; rejects otherwise. */
  fontsReady(): Promise<void>;
  createViewer(host: HTMLElement): CalendarViewerLike;
  createOptimizer(): CalendarOptimizerLike;
  /** Calls `fn` every `ms` until the returned function runs. */
  every(fn: () => void, ms: number): () => void;
  /** Calls `fn` when the page becomes visible again or is restored from the back/forward cache. */
  onResume(fn: () => void): () => void;
  /** Runs `fn` once after `ms`. */
  later(fn: () => void, ms: number): void;
  /** Points the print link of the host at the physical print (`de-a` or `en-3`). */
  setPrintDesign(design: string): void;
  /** Test and spec hooks (`__calendarController`, `__calendarViewer`); `undefined` removes the hook. */
  expose(name: string, value: unknown): void;
}

export interface CalendarInstance extends ModeInstance {
  /** Resets the viewpoint, called by the host when presentation mode changes. */
  resetCamera(): void;
}

type Print = "de-a" | "en-3";
const PADDING_OFF = ["0", "false", "off", "no"];
const IDS = ["design", "padding", "date", "live", "decrement", "increment"].map((n) => `calendar-${n}`);

/** The print named by `lang`, `language` or `design` (aliases of the former page); anything else is German A. */
export function printOf(params: URLSearchParams): Print {
  const value = (params.get("lang") || params.get("language") || params.get("design") || "").toLowerCase();
  return value === "en" || value === "en-3" || value === "english" ? "en-3" : "de-a";
}

export function runtimeId(print: Print, padded: boolean): string {
  return print === "de-a" ? "de-a" : padded ? "en-3-zero" : "en-3-unpadded";
}

const CONTROLS = `
  <div class="hud-header">
    <h2 class="hud-title">Date</h2>
    <div class="hud-actions">
      <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">─</button>
    </div>
  </div>
  <div class="hud-body calendar-controls">
    <output id="calendar-digital" aria-label="Requested calendar date">—</output>
    <p id="calendar-zone" class="small"></p>
    <label for="calendar-design">Physical print</label>
    <select id="calendar-design" disabled>
      <option value="de-a">Deutsch · A</option>
      <option value="en-3">English · 3</option>
    </select>
    <p id="calendar-layout" class="small"></p>
    <label id="calendar-padding-label" hidden><input id="calendar-padding" type="checkbox" checked /> Leading zero</label>
    <label for="calendar-date">Inspect a date</label>
    <input type="date" id="calendar-date" min="0001-01-01" max="9999-12-31" disabled />
    <div class="calendar-day-buttons">
      <button id="calendar-decrement" aria-label="Previous day" disabled>−1 day</button>
      <button id="calendar-increment" aria-label="Next day" disabled>+1 day</button>
    </div>
    <p id="calendar-estimates" class="small" aria-label="Day transition move estimates"></p>
    <button id="calendar-live" class="primary" disabled>Today</button>
    <div class="calendar-move-counts">
      <span>Transition moves</span>
      <output id="calendar-moves" aria-label="Physical transition move progress">0 / 0 HTM · 0 / 0 cube rotations</output>
      <p id="calendar-route" class="small">Initial display</p>
      <p id="calendar-queue" class="small"></p>
    </div>
    <label for="calendar-speed">Rotation Speed</label>
    <select id="calendar-speed">
      <option value="500">500 ms</option>
      <option value="250" selected>250 ms</option>
      <option value="100">100 ms</option>
      <option value="50">50 ms</option>
      <option value="10">10 ms</option>
    </select>
    <p class="small sr-only">Drag to look around. Date changes follow legal turns, including whole-cube rotations. The fixed stickers never change.</p>
  </div>
  <p id="calendar-error" class="error" role="alert"></p>`;

const STAGE = `
  <div id="calendar-viewer" aria-busy="true"></div>
  <div id="calendar-front" class="sr-only" aria-label="Committed calendar face"></div>
  <p id="calendar-state" role="status">Preparing the fixed print…</p>`;

export async function mountCalendar(
  root: HTMLElement,
  params: URLSearchParams,
  ctx: Pick<MountContext, "isCurrent">,
  env: CalendarEnv,
): Promise<CalendarInstance | void> {
  const { isCurrent } = ctx;
  let disposed = false,
    live = true,
    ready = false,
    failed = false,
    requested = "",
    date: CivilDate = localDate(env.now()),
    controller: CalendarController | null = null,
    viewer: CalendarViewerLike | null = null,
    optimizer: CalendarOptimizerLike | null = null;
  const cache = new Map<string, Design>(),
    stops: (() => void)[] = [],
    alive = () => !disposed && isCurrent();
  const print = printOf(params);

  // Fonts first: a stale mount must not leave a WebGL context behind.
  let fontError: unknown = null;
  try {
    await env.fontsReady();
  } catch (e) {
    fontError = e;
  }
  if (!isCurrent()) return;

  root.innerHTML = STAGE;
  env.controls.innerHTML = CONTROLS;
  const el = <T extends HTMLElement = HTMLElement>(id: string): T =>
    (env.controls.querySelector(`#${id}`) ?? root.querySelector(`#${id}`)) as T;
  const designSelect = el<HTMLSelectElement>("calendar-design"),
    paddingBox = el<HTMLInputElement>("calendar-padding"),
    dateInput = el<HTMLInputElement>("calendar-date"),
    liveBtn = el<HTMLButtonElement>("calendar-live");
  designSelect.value = print;
  const padParam = params.get("padding") ?? params.get("pad");
  if (padParam !== null) paddingBox.checked = !PADDING_OFF.includes(padParam.toLowerCase());
  const dateParam = params.get("date");
  if (dateParam && dateParam !== "today") {
    try {
      date = civilDate(dateParam);
      live = false;
    } catch {
      // An invalid date keeps today's local date.
    }
  }
  dateInput.value = date.iso;

  const currentPrint = (): Print => (designSelect.value === "de-a" ? "de-a" : "en-3");
  const currentId = () => runtimeId(currentPrint(), paddingBox.checked);
  const locale = () => (currentPrint() === "de-a" ? "de-DE" : "en-GB");
  const setText = (id: string, text: string) => {
    el(id).textContent = text;
  };

  async function load(id: string): Promise<Design> {
    const known = cache.get(id);
    if (known) return known;
    const design = validateDesign(await env.loadDesign(id));
    cache.set(id, design);
    return design;
  }

  function fail(error: unknown) {
    failed = true;
    ready = false;
    setText("calendar-error", (error as Error)?.message ?? "Calendar failed");
    setText("calendar-state", "Calendar stopped. Reload to recover.");
    for (const id of IDS) (el(id) as HTMLInputElement).disabled = true;
  }

  function showMoves() {
    if (!controller || !optimizer) return;
    const p = controller.progress;
    setText(
      "calendar-moves",
      p.planning
        ? "Planning legal route…"
        : `${p.completed.htm} / ${p.total.htm} HTM · ${p.completed.rotations} / ${p.total.rotations} cube rotations`,
    );
    el("calendar-moves").dataset.route = p.route;
    el("calendar-moves").dataset.solverStatus = optimizer.solverStatus;
    setText(
      "calendar-route",
      p.planning
        ? "Finding a shorter legal route…"
        : p.route === "optimized"
          ? "Optimized physical route"
          : p.route === "fallback"
            ? "Verified baseline route (shorter route unavailable)"
            : "Initial display",
    );
    setText("calendar-queue", p.queued ? "Latest requested date is queued." : "");
    if (!ready) return setText("calendar-estimates", "Preparing move estimates…");
    if (controller.busy) return setText("calendar-estimates", "Day estimates available after motion.");
    const design = cache.get(currentId());
    if (!design) return setText("calendar-estimates", "Preparing move estimates…");
    const cost = (direction: -1 | 1) => {
      try {
        const counts = controller!.estimate(findTarget(design, shiftDate(date, direction)));
        return counts ? `${counts.htm} HTM + ${counts.rotations} cube rotations` : "Calculated when selected";
      } catch {
        return "Date limit";
      }
    };
    setText("calendar-estimates", `−1 day: ${cost(-1)} · +1 day: ${cost(1)}`);
  }

  function controls() {
    const english = currentPrint() === "en-3";
    el("calendar-padding-label").hidden = !english;
    setText(
      "calendar-layout",
      english
        ? "Weekday · Month · Day. Adjacent day digits."
        : "Wochentag · Tag · Monat. Two-letter weekday, left-aligned.",
    );
    designSelect.disabled = !ready || Boolean(controller?.busy);
    paddingBox.disabled = !ready;
    dateInput.disabled = !ready;
    liveBtn.disabled = !ready;
    liveBtn.setAttribute("aria-pressed", String(live));
    (el("calendar-decrement") as HTMLButtonElement).disabled = !ready || date.iso === "0001-01-01";
    (el("calendar-increment") as HTMLButtonElement).disabled = !ready || date.iso === "9999-12-31";
    showMoves();
  }

  function changed(_target: unknown, busy: boolean, error?: unknown) {
    if (!alive()) return;
    if (error) return fail(error);
    el("calendar-viewer").setAttribute("aria-busy", String(busy));
    setText(
      "calendar-state",
      busy
        ? controller?.progress.planning
          ? "Planning legal date route…"
          : "Updating · physical date in motion"
        : live
          ? "Live · local date"
          : "Selected date",
    );
    if (!busy && viewer?.presentedState)
      setText("calendar-front", front(viewer.presentedState).map((s) => s.image || "blank").join(" · "));
    controls();
  }

  function showControl() {
    const d = new Date(0);
    d.setUTCFullYear(date.year, date.month - 1, date.day);
    setText(
      "calendar-digital",
      new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d),
    );
    setText("calendar-zone", Intl.DateTimeFormat().resolvedOptions().timeZone + (live ? " · Live" : " · Inspecting"));
  }

  async function update() {
    if (!ready || failed || !alive()) return;
    try {
      const id = currentId(),
        key = id + "/" + date.iso;
      showControl();
      if (key === requested) return changed(controller!.current, controller!.busy);
      requested = key;
      const design = await load(id);
      if (!alive() || !ready || key !== requested) return;
      controller!.request(findTarget(design, date));
      controls();
    } catch (e) {
      if (alive()) fail(e);
    }
  }

  // The controller drives the viewer through this port; after dispose a pending route stops at its next turn.
  const port: CalendarPort = {
    configure: (design, state) => viewer!.configure(design, state),
    animate: async (from, token, to) => {
      demand(alive(), "Calendar closed");
      await viewer!.animate(from, token, to);
    },
  };

  async function configure() {
    ready = false;
    requested = "";
    controls();
    try {
      const design = await load(currentId());
      if (!alive()) return;
      controller = new CalendarController(design, findTarget(design, date), port, changed, optimizer!.plan);
      env.expose("__calendarController", controller);
      ready = true;
      showControl();
      requested = currentId() + "/" + date.iso;
      changed(controller.current, false);
      controls();
      env.setPrintDesign(currentPrint());
    } catch (e) {
      if (alive()) fail(e);
    }
  }

  function inspectDate() {
    if (!ready || failed) return;
    try {
      const chosen = civilDate(dateInput.value);
      setText("calendar-error", "");
      date = chosen;
      live = false;
      void update();
      controls();
    } catch (e) {
      setText("calendar-error", (e as Error).message);
    }
  }
  function stepDate(direction: -1 | 1) {
    if (!ready || failed) return;
    try {
      date = shiftDate(date, direction);
      live = false;
      dateInput.value = date.iso;
      setText("calendar-error", "");
      void update();
      controls();
    } catch (e) {
      setText("calendar-error", (e as Error).message);
    }
  }

  const listen = (id: string, type: string, fn: (event: any) => void) => {
    const target = el(id);
    target.addEventListener(type, fn);
    stops.push(() => target.removeEventListener(type, fn));
  };
  listen("calendar-design", "change", () => {
    designSelect.disabled = true;
    void configure();
  });
  listen("calendar-padding", "change", () => void update());
  listen("calendar-date", "change", inspectDate);
  listen("calendar-date", "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      inspectDate();
    }
  });
  listen("calendar-decrement", "click", () => stepDate(-1));
  listen("calendar-increment", "click", () => stepDate(1));
  listen("calendar-live", "click", () => {
    setText("calendar-error", "");
    live = true;
    date = localDate(env.now());
    dateInput.value = date.iso;
    void update();
    controls();
  });
  listen("calendar-speed", "change", () => {
    if (viewer) viewer.duration = Number((el("calendar-speed") as HTMLSelectElement).value);
  });
  const hudToggle = env.controls.querySelector(".hud-toggle-btn") as HTMLElement | null;
  const toggle = () => {
    env.controls.classList.toggle("is-minimized");
    if (hudToggle) hudToggle.textContent = env.controls.classList.contains("is-minimized") ? "⚙" : "─";
  };
  hudToggle?.addEventListener("click", toggle);
  stops.push(() => hudToggle?.removeEventListener("click", toggle));

  function tick() {
    if (!ready || !live || failed || !alive()) return;
    const current = localDate(env.now());
    if (current.iso !== date.iso) {
      date = current;
      dateInput.value = date.iso;
      void update();
    }
  }

  const stop = () => {
    for (const fn of stops.splice(0)) fn();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    optimizer?.dispose();
    env.expose("__calendarController", undefined);
    env.expose("__calendarViewer", undefined);
    // A turn in progress finishes first: the viewer refuses to be destroyed while it animates.
    const release = () => {
      if (!viewer) return;
      if (viewer.animating) return env.later(release, 50);
      viewer.destroy();
      viewer = null;
    };
    release();
  };

  const instance: CalendarInstance = {
    dispose,
    resetCamera: () => {
      if (!disposed) viewer?.resetReferenceView();
    },
  };
  if (fontError) {
    fail(fontError);
    return instance;
  }
  optimizer = env.createOptimizer();
  viewer = env.createViewer(el("calendar-viewer"));
  env.expose("__calendarViewer", viewer);
  await configure();
  if (!isCurrent()) {
    dispose();
    return;
  }
  stops.push(env.every(tick, 1000), env.onResume(tick));
  return instance;
}
