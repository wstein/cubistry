// SPDX-License-Identifier: AGPL-3.0-or-later
/** DOM mount of the English 7x7 calendar mode (research candidate, not certified). */
import { DEFAULT_WORD_OPTIONS, expansionNote, markProgress, notationForBlocks, notationHtml, notationLabel, orientationLabel, type Notation, type NotationPlan, type WordOptions } from "./notation.ts";
import type { Block } from "./blocks.ts";
import type { RotationPlacement } from "./deferral.ts";
import { revealPlayback, resetPlaybackVisibility } from "./playback-visibility.ts";
import type { ModeInstance } from "../registry.ts";
import { type DisplayTable, type Graph, namesWindowContains, parseDisplays, parseGraph, parseState, type Start } from "./graph.ts";
import { type Layout, LAYOUT_PARAM, NAMES_LOAD_NOTICE, NAMES_NOTICE, parseLayout } from "./layout.ts";
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
  type PageModel,
  type ChainRange,
} from "./month-view.ts";
import { FONT_STYLES, FontSelection, fontStyleById, loadCalendarFont, type LoadedFont } from "./fonts.ts";
import { drawFontSticker } from "./font-art.ts";
import { watchSheetTheme } from "./sheet-theme.ts";
import { SCHEMES, schemeById } from "./schemes.ts";
import type { Surface } from "./sticker-art.ts";
import { Calendar7Player, DEFAULT_SLICE, DEFAULT_SPEED, SPEEDS, type PlayerSnapshot, type StageView } from "./player.ts";

/** The 3D scene the mount drives (src/apps/calendar7/viewer.ts; a fake in the tests). */
export interface Stage extends StageView {
  /** Builds the cube of one print; `layout` selects the tile classes of the names layout (`band`, row 1 line). */
  configure(printing: Printing, pose: Pose, surface?: Surface, layout?: Layout): void;
  setLabel(text: string): void;
  /** Color scheme by id (src/apps/calendar7/schemes.ts); an unknown id gives the default. Optional: a fake stage may omit it. */
  setScheme?(id: string | null | undefined): void;
  setFont?(font: LoadedFont): void;
  resetView(): void;
  destroy(): void;
}

export interface MountEnv {
  /** Base URL of the site, ending in a slash. */
  base: string;
  fetchJson(url: string): Promise<unknown>;
  loadFont?(id: string): Promise<LoadedFont>;
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

/** The data of one layout: its graph, displays and (with a 3D view) the print and the pose of the chain root. */
interface Dataset {
  readonly layout: Layout;
  readonly graph: Graph;
  readonly table: DisplayTable;
  readonly start: Start | null;
  readonly range: ChainRange;
}

/** The URL parameter that picks the color scheme of the 3D view (`?scheme=paper-blue`); unknown values use the default. */
export const SCHEME_PARAM = "scheme";

/** The mounted mode: the dispose of every mode plus the in-memory scheme setter the catalog will call. */
export interface Calendar7Instance extends ModeInstance {
  setScheme(id: string | null): void;
}

export async function mountCalendar7(
  root: HTMLElement,
  params: URLSearchParams,
  env: MountEnv,
): Promise<Calendar7Instance | void> {
  const threeD = Boolean(env.sceneHost && env.createStage);
  root.innerHTML =
    '<div class="c7-live" role="status" aria-live="polite"></div>' +
    '<div class="c7-appearance-choices">' +
    `<div class="c7-font-choice"><label for="c7-font-style">Font style</label><select id="c7-font-style" data-c7-font>${FONT_STYLES.map(f => `<option value="${f.id}"${f.id === fontStyleById(params.get("font")).id ? " selected" : ""}>${f.label}</option>`).join("")}</select></div>` +
    (threeD ? `<div class="c7-layout-choice"><label for="c7-layout">Cube layout</label><select id="c7-layout" data-c7="layout"><option value="standard"${parseLayout(params.get(LAYOUT_PARAM)) === "standard" ? " selected" : ""}>Standard</option><option value="names"${parseLayout(params.get(LAYOUT_PARAM)) === "names" ? " selected" : ""}>Names (preview, May 2026 - Jan 2028)</option></select></div>` : "") +
    (threeD ? `<div class="c7-scheme-choice"><label for="c7-color-theme">Cube color theme</label><select id="c7-color-theme" data-c7="scheme">${SCHEMES.map(s => `<option value="${s.id}"${s.id === schemeById(params.get(SCHEME_PARAM)).id ? " selected" : ""}>${s.name}</option>`).join("")}</select></div>` : "") +
    '</div><p class="c7-font-status" role="status" data-c7-font-status></p>' +
    (threeD ? '<p class="c7-layout-notice" role="status" data-c7="layout-notice" hidden></p>' : "") +
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
  const standardGraph = parseGraph(graphJson);
  const standard: Dataset = {
    layout: "standard",
    graph: standardGraph,
    table: parseDisplays(displaysJson),
    start: threeD ? parseState(stateJson) : null,
    range: chainRange(standardGraph),
  };
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
  /** The data of the page shown, of the cube the player owns, and of the month the cube is wanted at. A different print is a different physical state: the player is rebuilt, never reused. */
  let shown: Dataset = standard;
  let played: Dataset = standard;
  let wantedData: Dataset = standard;
  /** The selected layout (control and URL); the layout in effect is `shown.layout` (the standard layout outside the names window). */
  let layoutMode: Layout = threeD ? parseLayout(params.get(LAYOUT_PARAM)) : "standard";
  const layoutSelect = q("layout") as HTMLSelectElement | null;
  if (layoutSelect?.value) layoutMode = parseLayout(layoutSelect.value);
  const layoutNotice = q("layout-notice");
  /** The names data: loaded once, only when the mode is selected; `namesFailed` after a failed load (the standard layout is shown). */
  let names: Dataset | null = null;
  let namesLoading: Promise<void> | null = null;
  let namesFailed = false;
  let currentParams: URLSearchParams = params;
  let showSeq = 0;
  let previous: PlayerSnapshot | null = null;
  let wordOptions: WordOptions = { ...DEFAULT_WORD_OPTIONS };
  let currentModel: PageModel | null = null;
  let selectedSpeed: number = DEFAULT_SPEED;
  let font: LoadedFont | null = null;
  let schemeId: string | null = params.get(SCHEME_PARAM);
  const schemeSelect = q("scheme") as HTMLSelectElement | null;
  if (schemeSelect?.value && SCHEMES.some(s => s.id === schemeSelect.value)) schemeId = schemeSelect.value;
  /** Test hook and proof for readers: the id of the scheme the 3D view uses (an unknown id shows as the default). */
  const publishScheme = (): void => {
    const id = schemeById(schemeId).id;
    root.setAttribute("data-c7-scheme", id);
    if (schemeSelect) schemeSelect.value = id;
  };
  if (threeD) publishScheme();
  const paintSheet = (): void => {
    if (!font || !currentModel?.cells) return;
    const chosen = font, cells = currentModel.cells;
    view.querySelectorAll<HTMLTableCellElement>(".c7-sheet td").forEach((td, index) => {
      const cell = cells[index], canvas = document.createElement("canvas"), label = document.createElement("span");
      // Keep the existing compact table rows; contain the square art without stretching its glyphs.
      const colors = getComputedStyle(td);
      const em = parseFloat(colors.fontSize) || 16;
      const height = td.getBoundingClientRect().height || em * 1.5;
      td.style.height = `${height / em}em`;
      canvas.width = canvas.height = 192;canvas.setAttribute("aria-hidden", "true");
      const ctx = canvas.getContext("2d");if (!ctx) return;
      drawFontSticker(ctx, cell.text, cell.ink, chosen, schemeById(schemeId), "sticker", { fill: colors.backgroundColor, ink: colors.color }, currentModel?.layout ?? "standard");
      label.className = "c7-cell-text";label.textContent = cell.text;
      td.replaceChildren(label, canvas);
    });
  };
  const applyScheme = (id: string | null): void => {
    if (!alive()) return;
    schemeId = id;
    if (threeD) publishScheme();
    stage?.setScheme?.(id);
    paintSheet();
  };
  const stopSheetTheme = env.loadFont ? watchSheetTheme(() => { if (alive()) paintSheet(); }) : null;
  const fontSelect = env.loadFont ? root.querySelector<HTMLSelectElement>("[data-c7-font]") : null;
  const fontStatus = root.querySelector<HTMLElement>("[data-c7-font-status]");
  const fontChoice = env.loadFont ? new FontSelection(env.loadFont, chosen => {
    if (!alive()) return;
    font = chosen;if (fontSelect) fontSelect.value = chosen.style.id;
    root.setAttribute("data-c7-font", chosen.style.id);
    stage?.setFont?.(chosen);paintSheet();
    if (!stage && currentModel?.choice.kind === "ok") void syncStage(nodeIndex(shown.range, currentModel.choice.ym), shown);
  }, message => { if (alive() && fontStatus) fontStatus.textContent = message; }) : null;
  const onFont = (): void => {
    if (fontSelect && fontChoice) void fontChoice.choose(fontSelect.value);
  };
  fontSelect?.addEventListener("change", onFont);
  let focusPlayback = false;
  let resizeObserver: ResizeObserver | null = null;
  let activeWord: { blocks: readonly Block[]; plan: NotationPlan; notation: Notation } | null = null;
  // Browser/autofill selections can exist before data and event handlers finish loading.
  const initialOrientation = (q("orientation") as HTMLSelectElement | null)?.value;
  const initialNotation = (q("notation") as HTMLSelectElement | null)?.value;
  wordOptions = {
    orientation: ["before", "after", "stored"].includes(initialOrientation ?? "") ? initialOrientation as RotationPlacement : DEFAULT_WORD_OPTIONS.orientation,
    notation: ["blocks", "layers", "raw"].includes(initialNotation ?? "") ? initialNotation as Notation : DEFAULT_WORD_OPTIONS.notation,
    slice: (q("slice") as HTMLInputElement | null)?.checked ?? DEFAULT_SLICE,
  };
  const initialSpeed = Number((q("speed") as HTMLSelectElement | null)?.value);
  if (SPEEDS.includes(initialSpeed as typeof SPEEDS[number])) selectedSpeed = initialSpeed;
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
    resizeObserver?.disconnect();
    if (sceneHost && typeof sceneHost.closest === "function") resetPlaybackVisibility(sceneHost, q("active-word"));
    const activeBox = q("active-word");
    if (activeBox) activeBox.innerHTML = "";
    const activePanel = q("active-step");
    if (activePanel) activePanel.hidden = true;
    activeWord = null;
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
    for (const name of ["play", "skip", "speed", "reset", "slice", "orientation", "notation", "scheme", "layout"]) q(name)?.setAttribute("disabled", "");
    live.textContent = "The 3D view stopped. The month sheet is still shown.";
    if (sceneHost) sceneHost.hidden = true;
    console.error(error);
  };

  const render = (snap: PlayerSnapshot): void => {
    if (snap.index < 0) return; // Settings may change before the first pose is installed.
    if (failed) return;
    root.setAttribute("data-c7-phase", snap.phase);
    const playing = snap.status === "playing";
    const active = snap.phase !== "idle";
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
    const graph = played.graph;
    const target = graph.nodes[snap.index];
    const progress = q("progress");
    const panel = q("active-step");
    const hadPlaybackFocus = Boolean(panel?.contains?.(root.ownerDocument?.activeElement ?? null));
    const wordBox = q("active-word");
    if (panel) panel.hidden = !active;
    if (active && player && target) {
      const blocks = player.stepBlocks;
      if (!activeWord || activeWord.blocks !== blocks) {
        const plan = notationForBlocks(blocks, wordOptions.notation);
        activeWord = { blocks, plan, notation: wordOptions.notation };
        if (wordBox) wordBox.innerHTML = notationHtml(plan);
        const title = q("active-title");
        if (title) title.textContent = `${monthLabel(graph.nodes[snap.from])} → ${monthLabel(target)} · ${plan.moves} moves · ${notationLabel(activeWord.notation)}`;
        const note = q("active-note");
        if (note) note.textContent = expansionNote(activeWord.notation);
      }
      const plan = activeWord.plan;
      const done = plan.completedMoves[snap.done];
      const free = plan.groups[snap.done]?.free;
      if (progress) progress.textContent = snap.phase === "orientation"
        ? `Turning to ${monthLabel(target)}: orienting before moves (free)`
        : snap.phase === "alignment"
          ? `Turning to ${monthLabel(target)}: aligning the cube at the end (free)`
          : `Turning to ${monthLabel(target)}: ${free ? "whole-cube rotation (free)" : `move ${done + 1} of ${plan.moves}`}${snap.status === "paused" ? " (paused)" : ""}`;
      if (wordBox?.querySelectorAll) markProgress(wordBox, snap.done, snap.phase === "blocks", true);
    } else {
      if (progress && target) progress.textContent = `The cube shows ${monthLabel(target)}.`;
      if (activeWord && wordBox) wordBox.innerHTML = "";
      activeWord = null;
    }
    const alignment = q("alignment");
    if (alignment) {
      alignment.hidden = !active;
      alignment.textContent = player ? orientationLabel(player.stepAlignment, snap.orientation) : "";
    }
    view.querySelectorAll?.(".c7-word-panel").forEach((el) => ((el as HTMLElement).hidden = active));
    if (active && player && sceneHost && focusPlayback) {
      const controls = q("player"), box = q("active-word");
      if (controls && box && typeof sceneHost.getBoundingClientRect === "function") revealPlayback(sceneHost, controls, box);
      q("active-title")?.focus({ preventScroll: true });
      focusPlayback = false;
    } else if (!active && sceneHost) {
      if (typeof sceneHost.closest === "function") resetPlaybackVisibility(sceneHost, q("active-word"));
      if (hadPlaybackFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true });
      if (snap.index === wanted) focusPlayback = false;
    }
    setInactive(q("reset"), !player);
    if (target) stage?.setLabel(`7x7 calendar cube showing ${monthLabel(target)}`);
    if (!active && player) {
      root.setAttribute("data-c7-state", "idle");
      // Test hook and proof for readers: the digest of the pose the view shows, computed here, not copied from the graph.
      root.setAttribute("data-c7-digest", stateDigest((played.start as { printing: Printing }).printing, player.shownPose));
      root.setAttribute("data-c7-month", `${target.year}-${String(target.month).padStart(2, "0")}`);
      if (previous && previous.total > 0 && !motionOff) live.textContent = `The cube has turned to ${monthLabel(target)}.`;
    } else {
      root.setAttribute("data-c7-state", snap.status);
    }
    previous = snap;
  };

  /** Creates the stage once; later calls wait for the same work. */
  const ensure = (): Promise<void> => {
    pending ??= (async () => {
      const host = sceneHost as HTMLElement;
      const panel = q("rotation") as HTMLElement;
      const made = await (env.createStage as NonNullable<MountEnv["createStage"]>)(host, panel);
      if (!alive()) {
        made.destroy();
        return;
      }
      if (failed) {
        made.destroy();
        return;
      }
      stage = made;
      made.setScheme?.(schemeId);
      if (font) made.setFont?.(font);
      const port = host.closest?.(".shell-stage");
      if (port && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (!alive() || failed || player?.snapshot.phase === "idle") return;
          const controls = q("player"), box = q("active-word");
          if (controls && box) revealPlayback(host, controls, box);
        });
        resizeObserver.observe(port);
      }
    })();
    return pending;
  };

  /**
   * Builds the cube and the player of `data` unless they already belong to it. A different layout is a different print
   * (another state file, another graph): the cube is rebuilt from that print at the month wanted, the old player is
   * dropped, and nothing of the old pose is carried over.
   */
  const bind = (data: Dataset): void => {
    const made = stage;
    if (!made || (player && played === data)) return;
    const s = data.start as NonNullable<Dataset["start"]>;
    player?.dispose();
    player = null;
    activeWord = null;
    previous = null;
    const wordBox = q("active-word"), activePanel = q("active-step");
    if (wordBox) wordBox.innerHTML = "";
    if (activePanel) activePanel.hidden = true;
    root.setAttribute("data-c7-state", "building");
    played = data;
    made.configure(s.printing, s.pose, "face", data.layout);
    player = new Calendar7Player({
      graph: data.graph,
      printing: s.printing,
      root: s.pose,
      view: made,
      reducedMotion: reduced,
      onChange: render,
      onError: fail,
      slice: wordOptions.slice,
      orientation: wordOptions.orientation,
    });
    player.setSpeed(selectedSpeed);
  };

  const syncStage = async (index: number | null, data: Dataset = shown): Promise<void> => {
    if (!threeD || failed) return;
    wanted = index;
    wantedData = data;
    if (index === null) {
      if (sceneHost) sceneHost.hidden = true;
      (q("player") as HTMLElement | null)?.setAttribute("hidden", "");
      return;
    }
    if (fontChoice && !font) return;
    // The space is reserved at once; the cube appears when the scene is built.
    (sceneHost as HTMLElement).hidden = false;
    (q("player") as HTMLElement).hidden = false;
    try {
      await ensure();
      if (!alive()) return;
      if (failed) return;
      if (wanted === null) return;
      bind(wantedData);
      if (!player) return;
      player.go(wanted);
    } catch (error) {
      if (alive()) fail(error as Error);
    }
  };

  const refreshPreviews = (): void => {
    if (!currentModel) return;
    view.innerHTML = pageHtml(currentModel, wordOptions);
    paintSheet();
    const active = player && player.snapshot.phase !== "idle";
    view.querySelectorAll?.(".c7-word-panel").forEach((el) => ((el as HTMLElement).hidden = Boolean(active)));
  };
  /** Loads the names data once, only when the names layout is selected. A failure is remembered: the standard layout is shown with a notice. */
  const loadNames = (): Promise<void> => {
    const dir = `${env.base}calendar7/names/`;
    namesLoading ??= Promise.all([env.fetchJson(`${dir}graph.v1.json`), env.fetchJson(`${dir}displays.v1.json`), env.fetchJson(`${dir}state.v1.json`)])
      .then(([g, d, st]) => {
        const graph = parseGraph(g);
        names = { layout: "names", graph, table: parseDisplays(d), start: parseState(st), range: chainRange(graph) };
      })
      .catch(() => {
        namesFailed = true;
      });
    return namesLoading;
  };
  /**
   * The month shown is the month of the URL (`year` and `month`), else today's month. The names layout is in effect only
   * when it is selected, its data is loaded and that month is inside its window; otherwise the standard layout is shown
   * (with a notice when the names layout was selected).
   */
  const apply = (p: URLSearchParams, moveFocus: boolean): void => {
    focusPlayback = moveFocus;
    const wantedMonth = chooseMonth(p, today, standard.range);
    let data: Dataset = standard;
    let note = "";
    if (layoutMode === "names") {
      if (!names) note = NAMES_LOAD_NOTICE;
      else if (wantedMonth.kind === "invalid" || namesWindowContains(names.table, wantedMonth.ym.year, wantedMonth.ym.month)) data = names;
      else note = NAMES_NOTICE;
    }
    const choice = chooseMonth(p, today, data.range);
    shown = data;
    const model = buildModel(data.graph, data.table, choice, today, data.layout);
    currentModel = model;
    if (threeD) {
      // Test hooks and proof for readers: the layout in effect and the layout selected.
      root.setAttribute("data-c7-layout", data.layout);
      root.setAttribute("data-c7-layout-mode", layoutMode);
    }
    if (layoutNotice) {
      layoutNotice.textContent = note;
      layoutNotice.hidden = note === "";
    }
    refreshPreviews();
    live.textContent = announce(model);
    // The link that was clicked is gone after the re-render: keep the keyboard position at the new month.
    // No scroll: the cube above must stay in view while the step plays.
    if (moveFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true });
    if (threeD) {
      // A sheet exists exactly when the month is on the chain; the cube follows the same month.
      const k = choice.kind === "ok" ? nodeIndex(data.range, choice.ym) : -1;
      void syncStage(k >= 0 ? k : null, data);
    }
  };
  const show = (p: URLSearchParams, moveFocus: boolean): void => {
    currentParams = p;
    const seq = ++showSeq;
    if (layoutMode === "names" && !names && !namesFailed) {
      live.textContent = "Loading the names layout…";
      void loadNames().then(() => {
        if (alive() && seq === showSeq) apply(p, moveFocus);
      });
      return;
    }
    apply(p, moveFocus);
  };
  onFont();
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
    if (!el || !root.contains(el) || !alive() || failed) return;
    if (el.getAttribute("aria-disabled") === "true") return;
    try {
      switch (el.getAttribute("data-c7")) {
        case "layout": {
          if (e.type !== "change") break;
          layoutMode = parseLayout((el as HTMLSelectElement).value);
          (el as HTMLSelectElement).value = layoutMode;
          const query = new URLSearchParams(env.search());
          query.set(LAYOUT_PARAM, layoutMode);
          env.replaceQuery(`?${query.toString()}`);
          show(currentParams, false);
          break;
        }
        case "scheme": {
          if (e.type !== "change") break;
          applyScheme((el as HTMLSelectElement).value);
          const query = new URLSearchParams(env.search());
          query.set(SCHEME_PARAM, schemeById(schemeId).id);
          env.replaceQuery(`?${query.toString()}`);
          break;
        }
        case "play":
          if (player?.snapshot.status === "playing") player.pause();
          else player?.play();
          break;
        case "skip":
          player?.skip();
          break;
        case "reset":
          stage?.resetView();
          break;
        case "speed":
          selectedSpeed = Number((el as HTMLSelectElement).value);
          if (!SPEEDS.includes(selectedSpeed as typeof SPEEDS[number])) throw new RangeError("unknown speed");
          player?.setSpeed(selectedSpeed);
          break;
        case "slice":
          wordOptions = { ...wordOptions, slice: (el as HTMLInputElement).checked };
          player?.setSlice(wordOptions.slice);
          refreshPreviews();
          break;
        case "orientation":
          {
            const value = (el as HTMLSelectElement).value;
            if (!["before", "after", "stored"].includes(value)) throw new RangeError("unknown orientation");
            wordOptions = { ...wordOptions, orientation: value as RotationPlacement };
          }
          player?.setOrientation(wordOptions.orientation);
          refreshPreviews();
          break;
        case "notation": {
          const notation = (el as HTMLSelectElement).value;
          if (!["blocks", "layers", "raw"].includes(notation)) throw new RangeError("unknown notation");
          wordOptions = { ...wordOptions, notation: notation as Notation };
          refreshPreviews();
          break;
        }
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
    /** Chooses the color scheme of the 3D view by id (in memory only; unknown id: default). */
    setScheme: applyScheme,
    dispose: () => {
      disposed = true;
      stopSheetTheme?.();
      fontChoice?.dispose();fontSelect?.removeEventListener("change", onFont);
      root.removeEventListener("click", onClick);
      if (threeD) {
        root.removeEventListener("click", onControl);
        root.removeEventListener("change", onControl);
      }
      resizeObserver?.disconnect();
      if (sceneHost?.closest) resetPlaybackVisibility(sceneHost, q("active-word"));
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
    loadFont: id => loadCalendarFont(id, base),
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
      // Three.js and the viewer are loaded only when a month of the chain is shown.
      const { Calendar7Viewer } = await import("./viewer.ts");
      return new Calendar7Viewer(host, panel);
    },
  };
}
