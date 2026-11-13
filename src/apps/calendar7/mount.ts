// SPDX-License-Identifier: AGPL-3.0-or-later
/** DOM mount of the English 7x7 calendar mode (research candidate, not certified). */
import { DEFAULT_WORD_OPTIONS, expansionNote, markProgress, notationForBlocks, notationHtml, notationLabel, orientationLabel, type Notation, type NotationPlan, type WordOptions } from "./notation.ts";
import type { Block } from "./blocks.ts";
import type { RotationPlacement } from "./deferral.ts";
import { revealPlayback, resetPlaybackVisibility } from "./playback-visibility.ts";
import type { ModeInstance } from "../registry.ts";
import { type BestEffortMonth, type DisplayTable, type Graph, namesWindowContains, parseBestEffort, parseDisplays, parseGraph, parseState, type Start } from "./graph.ts";
import { printNameWords, type Layout, DEMO_DISPLAY_ONLY_NOTICE, LAYOUT_PARAM } from "./layout.ts";
import { type AnyData, type AnyState, chooseAnyMonth, previewForDate, stateForDate, wrongStickerIndices } from "./anydate.ts";
import { anyDateModel, anyDatePageHtml } from "./anydate-view.ts";
import { MonthPicker } from "./month-picker.ts";
import { clonePose, type Pose, type Printing, stateDigest } from "./engine.ts";
import {
  announce,
  buildModel,
  chainRange,
  chooseMonth,
  monthLabel,
  nodeIndex,
  ymKey,
  pageHtml,
  playerHtml,
  type YearMonth,
  type PageModel,
  type ChainRange,
} from "./month-view.ts";
import { FONT_STYLES, FontSelection, fontStyleById, loadCalendarFont, type LoadedFont } from "./fonts.ts";
import { drawFontSticker } from "./font-art.ts";
import { watchSheetTheme } from "./sheet-theme.ts";
import { SCHEMES, parseBannerStyle, schemeById, type BannerStyle } from "./schemes.ts";
import { parsePlasticity } from "./names-plasticity.ts";
import type { Surface } from "./sticker-art.ts";
import { Calendar7Player, DEFAULT_SLICE, DEFAULT_SPEED, SPEEDS, type PlayerSnapshot, type StageView } from "./player.ts";

/** The 3D scene the mount drives (src/apps/calendar7/viewer.ts; a fake in the tests). */
export interface Stage extends StageView {
  /** Builds the cube of one print; `layout` selects the tile classes of the names layout (`band`, row 1 line). */
  configure(printing: Printing, pose: Pose, surface?: Surface, layout?: Layout, wrong?: readonly number[]): void;
  setLabel(text: string): void;
  /** The identity pose of the print (the names data): the home faces of the stickers, read by the Rubik-Tint scheme at the next `configure`; null when it is not known. Optional like `setScheme`. */
  setHomePose?(root: Pose | null): void;
  /** Color scheme by id (src/apps/calendar7/schemes.ts); an unknown id gives the default. Optional: a fake stage may omit it. */
  setScheme?(id: string | null | undefined): void;
  /** Banner style shape of the names layout; optional like `setScheme`. */
  setBannerStyle?(style: BannerStyle): void;
  setFont?(font: LoadedFont): void;
  /** Plasticity of the names layout, 0 to 1 (names-plasticity.ts). Optional: a fake stage may omit it. */
  setPlasticity?(value: number): void;
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
  /** Chain months the print cannot show exactly (the wrong cells of the cube). */
  readonly bestEffort: readonly BestEffortMonth[];
  readonly table: DisplayTable;
  readonly start: Start | null;
  readonly range: ChainRange;
}

/** The URL parameter that picks the color scheme of the 3D view (`?scheme=paper-blue`); unknown values use the default. */
export const SCHEME_PARAM = "scheme";
/** The URL parameter that overrides the month banner shape (`?banner=underline`); absent or unknown: the theme default. */
export const BANNER_PARAM = "banner";
/** The URL parameter that sets the plasticity of the names layout (`?plasticity=0.6`, 0 to 1; absent: the default). */
export const PLASTICITY_PARAM = "plasticity";

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
  // Former layout URLs address the same physical print; preserve all other query values.
  if (params.has(LAYOUT_PARAM) || (params.has(BANNER_PARAM) && parseBannerStyle(params.get(BANNER_PARAM)) === "theme")) {
    params = new URLSearchParams(params);
    params.delete(LAYOUT_PARAM);
    if (parseBannerStyle(params.get(BANNER_PARAM)) === "theme") params.delete(BANNER_PARAM);
    const currentQuery = new URLSearchParams(env.search());
    currentQuery.delete(LAYOUT_PARAM);
    if (parseBannerStyle(params.get(BANNER_PARAM)) === "theme") currentQuery.delete(BANNER_PARAM);
    env.replaceQuery(currentQuery.size ? `?${currentQuery.toString()}` : "");
  }
  root.innerHTML =
    '<div class="c7-live" role="status" aria-live="polite"></div>' +
    '<div class="c7-date-choice" data-c7-month-picker></div>' +
    '<div class="c7-appearance-choices">' +
    `<div class="c7-font-choice"><label for="c7-font-style">Font style</label><select id="c7-font-style" data-c7-font>${FONT_STYLES.map(f => `<option value="${f.id}"${f.id === fontStyleById(params.get("font")).id ? " selected" : ""}>${f.label}</option>`).join("")}</select></div>` +
    (threeD ? `<div class="c7-scheme-choice"><label for="c7-color-theme">Cube color theme</label><select id="c7-color-theme" data-c7="scheme">${SCHEMES.map(s => `<option value="${s.id}"${s.id === schemeById(params.get(SCHEME_PARAM)).id ? " selected" : ""}>${s.name}</option>`).join("")}</select></div>` : "") +
    (threeD ? `<div class="c7-banner-choice"><label for="c7-banner-style">Banner style</label><select id="c7-banner-style" data-c7="banner">${[["theme", "Theme default"], ["rounded", "Rounded"], ["square", "Hard edges"], ["underline", "Underline"], ["boxed", "Boxed"], ["rounded-box", "Rounded box"]].map(([value, label]) => `<option value="${value}"${value === parseBannerStyle(params.get(BANNER_PARAM)) ? " selected" : ""}>${label}</option>`).join("")}</select></div>` : "") +
    '</div><p class="c7-font-status" role="status" data-c7-font-status></p>' +
    (threeD ? '<p class="c7-layout-notice" role="status" data-c7="layout-notice" hidden></p>' : "") +
    (threeD ? playerHtml(DEFAULT_SPEED) : "") +
    '<div class="c7-view"><p class="c7-loading">Loading the 7x7 calendar data…</p></div>';
  const view = root.querySelector(".c7-view") as HTMLElement;
  const live = root.querySelector(".c7-live") as HTMLElement;
  // The canonical data: the long chain on print C (docs/CALENDAR7_CHAIN_C.md). Fetched when the mode opens, never bundled.
  const [graphJson, displaysJson, stateJson, bestEffortJson] = await Promise.all([
    env.fetchJson(`${env.base}calendar7/chain-c/graph.v1.json`),
    env.fetchJson(`${env.base}calendar7/chain-c/displays.v1.json`),
    env.fetchJson(`${env.base}calendar7/chain-c/state.v1.json`),
    env.fetchJson(`${env.base}calendar7/chain-c/best-effort.v1.json`),
  ]);
  if (!env.isCurrent()) return;
  const canonicalGraph = parseGraph(graphJson);
  const canonical: Dataset = {
    layout: "names",
    graph: canonicalGraph,
    bestEffort: parseBestEffort(bestEffortJson),
    table: parseDisplays(displaysJson),
    start: parseState(stateJson),
    range: chainRange(canonicalGraph),
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
  let shown: Dataset = canonical;
  let played: Dataset = canonical;
  let wantedData: Dataset = canonical;
  const layoutNotice = q("layout-notice");
  /** True while the page shows a month from the fixed preview print without a move sequence; `anyWanted` is the state the cube shows then (null: no cube). */
  let anyActive = false;
  let anyWanted: Extract<AnyState, { kind: "state" | "best-effort" }> | null = null;
  /** The wrong stickers the cube was built with (best effort); another set means another build. */
  let anyWrongKey = "";
  /** True while the cube is configured with the fixed preview print for the any-date display (the player is then disposed). */
  let anyBound = false;
  /** The wrong stickers the cube was built with while the player owns it (best-effort chain month); "" for none. */
  let stageWrong = "";
  let anyBoundStart: Start | null = null;
  let activeAnyData: AnyData | null = null;
  let anyLabel = "";
  let currentParams: URLSearchParams = params;
  let monthPicker: MonthPicker | null = null;
  let previous: PlayerSnapshot | null = null;
  let wordOptions: WordOptions = { ...DEFAULT_WORD_OPTIONS };
  let currentModel: PageModel | null = null;
  let selectedSpeed: number = DEFAULT_SPEED;
  let font: LoadedFont | null = null;
  let schemeId: string | null = params.get(SCHEME_PARAM);
  let bannerStyle = parseBannerStyle(params.get(BANNER_PARAM));
  const bannerSelect = q("banner") as HTMLSelectElement | null;
  if (threeD) root.setAttribute("data-c7-banner", bannerStyle);
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
      drawFontSticker(ctx, cell.text, cell.ink, chosen, schemeById(schemeId), "sticker", { fill: colors.backgroundColor, ink: colors.color }, currentModel?.layout ?? "standard", undefined, canonical.start ? printNameWords(canonical.start.printing) : undefined);
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
    if (!stage && anyActive) void syncAny();
    else if (!stage && currentModel?.choice.kind === "ok") void syncStage(nodeIndex(shown.range, currentModel.choice.ym), shown);
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
    for (const name of ["play", "skip", "speed", "reset", "slice", "orientation", "notation", "scheme", "banner"]) q(name)?.setAttribute("disabled", "");
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
      // The wrong cell is set only when the cube rests in the month it was asked for; a pass through it on the way to another month clears it.
      setWrong(snap.index, snap.index !== wanted);
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
      made.setBannerStyle?.(bannerStyle);
      made.setPlasticity?.(parsePlasticity(params.get(PLASTICITY_PARAM)));
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
    anyBound = false;
    anyBoundStart = null;
    made.setHomePose?.(data.layout === "names" ? s.pose : null); // the root pose of the standard print is a setup, not the solved cube
    made.configure(s.printing, s.pose, "face", data.layout);
    stageWrong = "";
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

  /** Rebuilds the cube at the pose it shows when the wrong cells of node `index` differ from those it was built with (the cube is idle). */
  const setWrong = (index: number, clear = false): void => {
    const made = stage, p = player;
    if (!made || !p) return;
    const node = played.graph.nodes[index];
    const entry = clear ? undefined : played.bestEffort.find((b) => b.year === node.year && b.month === node.month);
    const wrong = entry ? wrongStickerIndices(p.shownPose, entry.wrong) : [];
    const key = wrong.join(",");
    if (key === stageWrong) return;
    const s = played.start as NonNullable<Dataset["start"]>;
    stageWrong = key;
    made.configure(s.printing, clonePose(p.shownPose), "face", played.layout, wrong);
  };

  const syncStage = async (index: number | null, data: Dataset = shown): Promise<void> => {
    if (!threeD || failed) return;
    wanted = index;
    wantedData = data;
    if (index === null) {
      player?.dispose();
      player = null;
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
      // Leaving a best-effort month: the cube is rebuilt without its wrong cell before the step starts (only between moves).
      if (stageWrong !== "" && player.snapshot.phase === "idle" && player.snapshot.index !== wanted) setWrong(player.snapshot.index, true);
      player.go(wanted);
    } catch (error) {
      if (alive()) fail(error as Error);
    }
  };

  const refreshPreviews = (): void => {
    if (!currentModel) return;
    view.innerHTML = anyActive ? anyDatePageHtml(currentModel) : pageHtml(currentModel, wordOptions);
    const shown = currentModel.choice;
    monthPicker?.setValue(shown.kind === "invalid" ? null : shown.ym);
    paintSheet();
    const active = player && player.snapshot.phase !== "idle";
    view.querySelectorAll?.(".c7-word-panel").forEach((el) => ((el as HTMLElement).hidden = Boolean(active)));
  };
  /** Shows the fixed preview print (display only) for the month of `p`; the cube shows the state of the month's configuration, or no cube when there is none. */
  const applyAny = (p: URLSearchParams, moveFocus: boolean, data: AnyData): void => {
    player?.dispose();
    player = null;
    previous = null;
    activeWord = null;
    activeAnyData = data;
    const choice = chooseAnyMonth(p, today);
    const state = choice.kind === "ok" ? stateForDate(data, choice.ym.year, choice.ym.month) : null;
    const model = { ...anyDateModel(choice, state, today, canonical.range, printNameWords(data.start.printing)), longChain: true };
    anyActive = true;
    anyWanted = state?.kind === "state" || state?.kind === "best-effort" ? state : null;
    currentModel = model;
    if (threeD) {
      root.setAttribute("data-c7-layout", "names");
      root.setAttribute("data-c7-layout-mode", "names");
      root.setAttribute("data-c7-any", state ? state.kind : "invalid");
      root.setAttribute("data-c7-state", anyWanted ? "building" : "idle");
      if (choice.kind === "ok") root.setAttribute("data-c7-month", ymKey(choice.ym));
    }
    anyLabel = choice.kind === "ok" ? monthLabel(choice.ym) : "";
    if (layoutNotice) {
      layoutNotice.textContent = DEMO_DISPLAY_ONLY_NOTICE;
      layoutNotice.hidden = false;
    }
    refreshPreviews();
    live.textContent = announce(model);
    if (moveFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true });
    if (threeD) void syncAny();
  };
  /** The cube of the any-date display: the fixed preview print, the pose of the month's configuration, no player and no moves. */
  const syncAny = async (): Promise<void> => {
    if (!threeD || failed) return;
    wanted = null; // a chain month that is still waiting for the stage is dropped
    const target = anyWanted;
    const data = activeAnyData;
    const controls = q("player") as HTMLElement;
    if (!target || !data) {
      (sceneHost as HTMLElement).hidden = true;
      controls.hidden = true;
      return;
    }
    if (fontChoice && !font) return;
    (sceneHost as HTMLElement).hidden = false;
    controls.hidden = true;
    try {
      await ensure();
      if (!alive()) return;
      if (failed || anyWanted !== target || activeAnyData !== data) return;
      const made = stage as Stage;
      const wrong = target.kind === "best-effort" ? wrongStickerIndices(target.pose, target.wrong) : [];
      const wrongKey = wrong.map(i => `${i}:${target.pose.up.subarray(3 * i, 3 * i + 3).join(",")}`).join("|");
      if (!anyBound || anyBoundStart !== data.start || anyWrongKey !== wrongKey) {
        player?.dispose();
        player = null;
        activeWord = null;
        previous = null;
        const wordBox = q("active-word"), activePanel = q("active-step");
        if (wordBox) wordBox.innerHTML = "";
        if (activePanel) activePanel.hidden = true;
        made.setHomePose?.(data.start.pose);
        made.configure(data.start.printing, clonePose(target.pose), "face", "names", wrong);
        anyBound = true;
        anyBoundStart = data.start;
        anyWrongKey = wrongKey;
      }
      made.show(target.pose);
      made.setLabel(`7x7 calendar cube showing ${anyLabel}, display only`);
      root.setAttribute("data-c7-state", "idle");
      root.setAttribute("data-c7-digest", stateDigest(data.start.printing, target.pose));
    } catch (error) {
      if (alive()) fail(error as Error);
    }
  };
  /** One print for every date: play the checked chain where present, otherwise show a front preview without moves. */
  const show = (p: URLSearchParams, moveFocus: boolean): void => {
    currentParams = p;
    focusPlayback = moveFocus;
    const choice = chooseAnyMonth(p, today);
    if (choice.kind === "ok" && !namesWindowContains(canonical.table, choice.ym.year, choice.ym.month))
      return applyAny(p, moveFocus, previewForDate(canonical.start as Start, choice.ym.year, choice.ym.month));
    anyActive = choice.kind === "invalid";
    anyWanted = null;
    activeAnyData = null;
    shown = canonical;
    currentModel = choice.kind === "ok"
      ? buildModel(canonical.graph, canonical.table, chooseMonth(p, today, canonical.range), today, "names", true, canonical.bestEffort)
      : { ...anyDateModel(choice, null, today, canonical.range), longChain: true };
    if (threeD) {
      root.setAttribute("data-c7-layout", "names");
      root.setAttribute("data-c7-layout-mode", "names");
      root.setAttribute("data-c7-any", choice.kind === "invalid" ? "invalid" : "off");
      if (choice.kind === "invalid") root.setAttribute("data-c7-state", "idle");
    }
    if (layoutNotice) { layoutNotice.textContent = ""; layoutNotice.hidden = true; }
    refreshPreviews();
    live.textContent = announce(currentModel);
    if (moveFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true });
    if (threeD) void syncStage(choice.kind === "ok" ? nodeIndex(canonical.range, choice.ym) : null, canonical);
  };
  const pickerHost = root.querySelector<HTMLElement>("[data-c7-month-picker]");
  // A test fake that does not model this host has no ownerDocument; the real page and the picker tests do.
  if (pickerHost?.ownerDocument) {
    monthPicker = new MonthPicker(pickerHost, null, {
      today,
      onSelect: (ym) => {
        if (!alive()) return;
        const next = new URLSearchParams({ year: String(ym.year), month: String(ym.month) });
        const current = chooseAnyMonth(currentParams, today);
        if (current.kind === "ok" && current.ym.year === ym.year && current.ym.month === ym.month) return;
        const keep = new URLSearchParams(env.search());
        keep.delete(LAYOUT_PARAM);
        for (const k of MY_PARAMS) keep.set(k, next.get(k) as string);
        env.replaceQuery(`?${keep.toString()}`);
        show(next, false);
      },
    });
  }
  onFont();
  show(params, false);

  // Navigation links are plain `?app=calendar7&year=&month=` links; follow them without a reload.
  const onClick = (e: Event): void => {
    const a = (e.target as Element | null)?.closest?.("a.c7-nav") as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    e.preventDefault();
    const next = new URL(a.getAttribute("href") as string, "http://x/").searchParams;
    const keep = new URLSearchParams(env.search());
    keep.delete(LAYOUT_PARAM);
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
        case "banner": {
          if (e.type !== "change") break;
          bannerStyle = parseBannerStyle((el as HTMLSelectElement).value);
          if (bannerSelect) bannerSelect.value = bannerStyle;
          root.setAttribute("data-c7-banner", bannerStyle);
          stage?.setBannerStyle?.(bannerStyle);
          const query = new URLSearchParams(env.search());
          query.delete(LAYOUT_PARAM);
          if (bannerStyle === "theme") query.delete(BANNER_PARAM); else query.set(BANNER_PARAM, bannerStyle);
          env.replaceQuery(`?${query.toString()}`);
          break;
        }
        case "banner": {
          if (e.type !== "change") break;
          bannerStyle = parseBannerStyle((el as HTMLSelectElement).value);
          if (bannerSelect) bannerSelect.value = bannerStyle;
          root.setAttribute("data-c7-banner", bannerStyle);
          stage?.setBannerStyle?.(bannerStyle);
          const query = new URLSearchParams(env.search());
          if (bannerStyle === "theme") query.delete(BANNER_PARAM); else query.set(BANNER_PARAM, bannerStyle);
          env.replaceQuery(`?${query.toString()}`);
          break;
        }
        case "scheme": {
          if (e.type !== "change") break;
          applyScheme((el as HTMLSelectElement).value);
          const query = new URLSearchParams(env.search());
          query.delete(LAYOUT_PARAM);
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
      monthPicker?.dispose();
      activeAnyData = null;
      anyWanted = null;
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
