// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The Picture Cube as a mode of the unified host (`index.html?app=playground`). It mounts the 2x2 with the
 * same controller, designs, solver and pictures panel, and fills the dock slots (D9 of the Picture Cube host
 * plan), status chip, primary action, readout and Nerd drawer through the `ModeShell`.
 *
 * Lifecycle: all DOM is built inside `root` or the shell's regions; key handling goes through `shell.listen`; every
 * await checks `alive()` and a sequence number; `dispose()` cancels the controller, drops late loads and releases the
 * viewer only after a running legal turn settled. The size control is disabled while a turn, a solve or a load is
 * pending (D7) and writes the address bar with `replaceParams` (D8, never a new history entry).
 */
import type { LoadedAssets } from "@cubistry/cube-assets";
import { serializeMove } from "@cubistry/cube-mechanics";
import { parsePictureMode, type PictureMode } from "@cubistry/cube-viewer";
import type { ModeInstance, MountContext } from "../registry.ts";
import { ALLOWED_MOVES, UPLOAD_STYLE, createDesign, type Style } from "./model.ts";
import { PlaygroundController, type PlaygroundViewer } from "./controller.ts";
import type { PicturesHooks, UseUploadResult } from "./pictures.ts";
import { CUBE_SIZES, PLAYABLE_SIZES, resolveSize, sizeNote } from "./size.ts";
import type { SolverFactory } from "./solver.ts";
import { THEMES } from "./themes.ts";
import type { UploadedFaceSet } from "./upload.ts";

export interface PlaygroundHostViewer extends PlaygroundViewer {
  setAnimationSpeed(speed: number, kind?: string): void;
  resetCamera(): void;
  destroy(): void;
  /** True while a turn animates; the viewer cannot be destroyed then. */
  readonly animating: boolean;
  /** The picture mode that `?pictures=` named (Projected or Per sticker); undefined when the address names none. */
  setPictureModeFromUrl?(mode: PictureMode | undefined): void;
}

/** The handle of the pictures panel (pictures.ts `initPictures`). */
export interface PicturesHandle {
  styleChanged(style: Style): void;
  dispose(): void;
}

/** Everything the mount takes from the browser, so node tests can run it with fakes. */
export interface PlaygroundEnv {
  doc: Pick<Document, "createElement">;
  createViewer(host: HTMLElement): PlaygroundHostViewer;
  /** Duration of one quarter turn at speed 1 (BASE_MOVE_DURATION_MS). */
  baseMoveMs: number;
  /** Loads the images of a design; `local` carries the bytes of an upload. */
  loadAssets(design: ReturnType<typeof createDesign>, local?: UploadedFaceSet["local"]): Promise<LoadedAssets>;
  /** Defaults to the 2x2 table solver. */
  solverFactory?: SolverFactory;
  /** Builds the "Your pictures" panel inside `region`. */
  createPictures(region: HTMLElement, hooks: Pick<PicturesHooks, "useUpload">): PicturesHandle;
  /** The target of the face-turn key handler (the window in the browser). */
  keys: EventTarget;
  /** Writes the mode's own parameters into the address bar without a history entry. */
  replaceParams(own: URLSearchParams, ownKeys: readonly string[]): void;
  nextFrame(fn: () => void): void;
  /** Test hook (`__playgroundViewer`); `undefined` removes it. Absent in tests of the mount. */
  expose?(name: string, value: unknown): void;
}

type Session = { design: ReturnType<typeof createDesign>; assets: LoadedAssets };

const SPEED_MIN = 10,
  SPEED_MAX = 1000,
  SPEED_DEFAULT = 250;
const TEXT_TARGETS = ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"];

export async function mountPlayground(
  root: HTMLElement,
  params: URLSearchParams,
  ctx: MountContext,
  env: PlaygroundEnv,
): Promise<ModeInstance | void> {
  const { shell, isCurrent } = ctx;
  const choice = resolveSize(params.get("size"));
  let disposed = false,
    controller: PlaygroundController | null = null,
    viewer: PlaygroundHostViewer | null = null,
    pendingDesign: Style | null = null,
    designRequest = 0,
    uploadSeq = 0,
    uploadsPending = 0,
    retired: LoadedAssets[] = [],
    nerdKey = "";
  const alive = (): boolean => !disposed && isCurrent();
  const sessions = new Map<string, Session>();
  const loading = new Map<string, Promise<Session | undefined>>();

  // ----- DOM
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = env.doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const button = (id: string, text: string, onClick?: () => void): HTMLButtonElement => {
    const b = make("button", text, id);
    b.setAttribute("type", "button");
    if (onClick) shell.listen(b, "click", onClick);
    return b;
  };
  const fieldOf = (id: string, text: string, input: HTMLElement): HTMLElement => {
    const wrap = make("div");
    wrap.className = "shell-field";
    const lab = make("label", text);
    lab.setAttribute("for", id);
    wrap.append(lab, input);
    return wrap;
  };
  const host = make("div", undefined, "playground-cube");
  host.setAttribute("style", "width:100%;flex:1 1 0;min-height:0");
  host.setAttribute("aria-label", "Physical picture puzzle");
  host.setAttribute("aria-busy", "true");
  // The viewer docks its Appearance panel into the shell's view-controls region, as the scene of the other modes does.
  host.dataset.appearanceDock = "view-controls";
  host.dataset.size = String(choice.size);
  // The "Your pictures" content region: headings and the long forms, not dock slots (D9).
  const region = make("section", undefined, "playground-pictures");
  region.className = "pg-region";
  region.setAttribute("aria-label", "Your pictures");
  region.inert = true; // the panel waits for the puzzle, like the other controls
  root.append(host, region);

  // ----- slot 3: size control, Undo, Redo
  const sizeGroup = make("div", undefined, "playground-size-control");
  sizeGroup.className = "size-control";
  sizeGroup.setAttribute("role", "radiogroup");
  sizeGroup.setAttribute("aria-label", "Cube size");
  sizeGroup.setAttribute("aria-describedby", "playground-size-note");
  const sizeButtons = new Map<number, HTMLButtonElement>();
  for (const n of CUBE_SIZES) {
    const b = make("button", `${n}×${n}`, `playground-size-${n}`);
    b.setAttribute("type", "button");
    b.setAttribute("role", "radio");
    b.dataset.size = String(n);
    if (!PLAYABLE_SIZES.includes(n)) {
      b.disabled = true;
      b.title = "Not playable yet";
    } else
      shell.listen(b, "click", () => {
        if (b.disabled || !alive()) return;
        showSize(n);
        env.replaceParams(new URLSearchParams({ size: String(n) }), ["size"]);
      });
    sizeButtons.set(n, b);
    sizeGroup.append(b);
  }
  function showSize(size: number): void {
    for (const [n, b] of sizeButtons) {
      b.setAttribute("aria-checked", String(n === size));
      b.tabIndex = n === size ? 0 : -1;
    }
    host.dataset.size = String(size);
  }
  const sizeNoteEl = make("p", choice.note || sizeNote(), "playground-size-note");
  sizeNoteEl.className = "size-note";
  sizeNoteEl.setAttribute("role", "status");
  showSize(choice.size);
  const undoButton = button("playground-undo", "↶ Undo", () => controller?.undo());
  const redoButton = button("playground-redo", "Redo ↷", () => controller?.redo());
  const historyRow = make("div");
  historyRow.className = "shell-btn-row";
  historyRow.append(undoButton, redoButton);
  shell.setSlot(3, { label: "Size and history", element: [sizeGroup, sizeNoteEl, historyRow] });

  // ----- slot 1: scramble and cancel; the primary action is the exact solve
  const seed = make("input", undefined, "playground-seed");
  Object.entries({ type: "number", min: "0", max: "4294967295", step: "1", required: "" }).forEach(([k, v]) => seed.setAttribute(k, v));
  seed.value = "42";
  const count = make("input", undefined, "playground-count");
  Object.entries({ type: "number", min: "1", max: "100", step: "1", required: "" }).forEach(([k, v]) => count.setAttribute(k, v));
  count.value = "20";
  const scrambleButton = make("button", "Scramble", "playground-scramble");
  scrambleButton.setAttribute("type", "submit");
  const cancelButton = button("playground-cancel", "Cancel", () => controller?.cancel());
  const scrambleForm = make("form", undefined, "playground-scramble-form");
  scrambleForm.className = "shell-stack";
  scrambleForm.append(fieldOf("playground-seed", "Seed", seed), fieldOf("playground-count", "Moves", count), scrambleButton, cancelButton);
  shell.listen(scrambleForm, "submit", (e) => {
    e.preventDefault();
    controller?.scramble(Number(seed.value), Number(count.value));
  });
  shell.setSlot(1, { label: "Scramble", element: scrambleForm });
  const primary = shell.setPrimaryAction({ label: "Solve exact target", disabled: true, onClick: () => controller?.solve() });

  // ----- slot 2: the 18 legal face turns and the notation field
  const faceButtons = make("div", undefined, "playground-face-buttons");
  faceButtons.className = "face-buttons";
  faceButtons.setAttribute("role", "group");
  faceButtons.setAttribute("aria-label", "Legal face turns");
  const manual: (HTMLButtonElement | HTMLInputElement)[] = [];
  for (const move of ALLOWED_MOVES) {
    const token = serializeMove(move);
    const b = button(`playground-move-${token.replace("'", "p")}`, token, () => controller?.manual(token));
    b.dataset.move = token;
    b.setAttribute("aria-label", `Turn ${token}`);
    manual.push(b);
    faceButtons.append(b);
  }
  const notation = make("input", undefined, "playground-notation");
  Object.entries({ placeholder: "R U R' U'", autocomplete: "off", spellcheck: "false", maxlength: "4096" }).forEach(([k, v]) => notation.setAttribute(k, v));
  const applyButton = make("button", "Apply", "playground-apply");
  applyButton.setAttribute("type", "submit");
  const notationForm = make("form", undefined, "playground-notation-form");
  notationForm.className = "shell-stack";
  notationForm.append(fieldOf("playground-notation", "Move notation", notation), applyButton, make("small", "R L U D F B · add ' for inverse, 2 for half turn."));
  shell.listen(notationForm, "submit", (e) => {
    e.preventDefault();
    controller?.manual(notation.value);
  });
  manual.push(notation, applyButton);
  shell.setSlot(2, { label: "Turns", element: [faceButtons, notationForm] });

  // ----- slot 4: move time
  const speed = make("input", undefined, "playground-speed");
  Object.entries({ type: "range", min: String(SPEED_MIN), max: String(SPEED_MAX), step: "10" }).forEach(([k, v]) => speed.setAttribute(k, v));
  speed.value = String(SPEED_DEFAULT);
  const speedValue = make("output", `${SPEED_DEFAULT} ms`, "playground-speed-value");
  const speedRow = fieldOf("playground-speed", "Quarter turn", speed);
  speedRow.append(speedValue, make("small", "Half turns take twice as long."));
  function applySpeed(): void {
    viewer?.setAnimationSpeed(env.baseMoveMs / Number(speed.value), "quarter-turn");
    speedValue.textContent = `${speed.value} ms`;
  }
  shell.listen(speed, "input", applySpeed);
  shell.setSlot(4, { label: "Move time", element: speedRow });

  // ----- slot 5: design choice, new session, camera
  const design = make("select", undefined, "playground-design");
  const options: [string, string][] = [
    ["picture", "Landscape pictures"],
    ["pastel", "Pastel Garden"],
    ...THEMES.map((t): [string, string] => [t.id, t.name]),
    ["classic", "Classic colors"],
    [UPLOAD_STYLE, "Your pictures (upload below)"],
  ];
  for (const [value, text] of options) {
    const option = make("option", text);
    option.setAttribute("value", value);
    if (value === UPLOAD_STYLE) option.disabled = true;
    design.append(option);
  }
  design.value = "picture";
  const uploadOption = design.children[options.length - 1] as HTMLOptionElement;
  const newSession = button("playground-new-session", "Start new session", () => {
    if (controller) controller.newSession(sessions.get(controller.snapshot.style) as Session);
  });
  const resetView = button("playground-reset-view", "Reset view", () => viewer?.resetCamera());
  const sessionHelp = make("p", "Changing the design starts a new physical puzzle session after the active turn. It clears the history.");
  shell.setSlot(5, { label: "Design", element: [fieldOf("playground-design", "Design", design), newSession, resetView, sessionHelp] });

  shell.setReadout([
    { role: "Moves", value: "0 / 0 HTM" },
    { role: "Turns", value: "0" },
    { role: "Exact", value: "Loading" },
    { role: "Rotation", value: "Loading" },
  ]);
  shell.setNerd({
    title: "Solver and history",
    render(body) {
      const s = controller?.snapshot;
      const facts = make("dl");
      const fact = (term: string, value: string): void => {
        facts.append(make("dt", term), make("dd", value));
      };
      fact("Solver", s?.solverStatus ?? "Idle");
      fact("Exact physical target", s ? (s.frozen ? "Unknown" : s.exact ? "Solved" : "Unsolved") : "Loading");
      fact("Up to whole-cube rotation", s ? (s.frozen ? "Unknown" : s.rotationEquivalent ? "Solved" : "Unsolved") : "Loading");
      fact("Design", s?.style ?? "picture");
      body.append(facts);
      const list = make("ol");
      list.setAttribute("aria-label", "Committed moves");
      (s?.history ?? []).forEach((entry, i) => {
        const li = make("li", serializeMove(entry.move));
        li.title = `${i + 1}. ${entry.source}`;
        li.dataset.future = String(i >= s!.cursor);
        list.append(li);
      });
      body.append(list);
    },
  });

  // ----- pictures panel: uploads come back through useUpload
  const pictures = env.createPictures(region, { useUpload });

  // ----- designs
  const loadSession = (style: Style): Promise<Session | undefined> => {
    if (sessions.has(style)) return Promise.resolve(sessions.get(style));
    if (style === UPLOAD_STYLE) return Promise.reject(Error("no pictures have been uploaded"));
    if (!loading.has(style)) {
      const d = createDesign(style);
      loading.set(
        style,
        env
          .loadAssets(d)
          .then((assets) => {
            if (disposed) assets.dispose();
            else sessions.set(style, { design: d, assets });
            return sessions.get(style);
          })
          .finally(() => loading.delete(style)),
      );
    }
    return loading.get(style) as Promise<Session | undefined>;
  };

  async function chooseDesign(style: Style): Promise<void> {
    const request = ++designRequest;
    if (sessions.has(style)) {
      pendingDesign = null;
      controller?.newSession(sessions.get(style) as Session);
      update();
      return;
    }
    pendingDesign = style;
    update();
    try {
      const session = await loadSession(style);
      if (request !== designRequest || !session || !alive()) return;
      pendingDesign = null;
      controller?.newSession(session);
      update();
    } catch (error) {
      if (request !== designRequest || !alive()) return;
      pendingDesign = null;
      update();
      shell.setError({ text: `Unable to load this design: ${(error as Error).message}` });
    }
  }
  shell.listen(design, "change", () => {
    pictures.styleChanged(design.value as Style);
    void chooseDesign(design.value as Style);
  });

  /** Makes an upload the "Your pictures" design, or removes it (null); resolves to { ok } or { ok: false, error }. */
  async function useUpload(next: UploadedFaceSet | null): Promise<UseUploadResult> {
    const seq = ++uploadSeq;
    if (!next) {
      const old = sessions.get(UPLOAD_STYLE);
      sessions.delete(UPLOAD_STYLE);
      if (old) retired.push(old.assets);
      uploadOption.disabled = true;
      if (design.value === UPLOAD_STYLE || controller?.snapshot.style === UPLOAD_STYLE) {
        design.value = "picture";
        designRequest++;
        pendingDesign = null;
        if (controller) controller.newSession(sessions.get("picture") as Session);
      }
      pictures.styleChanged(design.value as Style);
      return { ok: true };
    }
    let session: Session;
    uploadsPending++;
    update();
    try {
      const d = createDesign(UPLOAD_STYLE, next.set);
      session = { design: d, assets: await env.loadAssets(d, next.local) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "the pictures could not be loaded" };
    } finally {
      uploadsPending--;
      update();
    }
    if (seq !== uploadSeq || disposed) {
      session.assets.dispose();
      return { ok: false, error: "these pictures were replaced before they finished loading" };
    }
    const old = sessions.get(UPLOAD_STYLE);
    if (old) retired.push(old.assets);
    sessions.set(UPLOAD_STYLE, session);
    uploadOption.disabled = false;
    design.value = UPLOAD_STYLE;
    await chooseDesign(UPLOAD_STYLE);
    pictures.styleChanged(UPLOAD_STYLE);
    return { ok: true };
  }

  // ----- state to view
  function update(): void {
    if (disposed) return;
    const s = controller?.snapshot;
    const hold = !s || s.busy || s.frozen || pendingDesign !== null || uploadsPending > 0;
    for (const [n, b] of sizeButtons) b.disabled = !PLAYABLE_SIZES.includes(n) || hold;
    if (!s) return;
    retired = retired.filter((assets) => {
      if (assets === controller?.sessionAssets) return true;
      assets.dispose();
      return false;
    });
    const solved = !s.frozen && s.exact;
    if (s.frozen) shell.setStatus("error", s.message);
    else if (pendingDesign) shell.setStatus("sync", "Loading the picture set…");
    else if (s.busy) shell.setStatus("moving", s.message);
    else shell.setStatus(solved ? "done" : "ready", s.message);
    host.setAttribute("aria-busy", String(s.busy || pendingDesign !== null));
    Object.assign(host.dataset, {
      ready: "true",
      exact: s.frozen ? "unknown" : String(s.exact),
      equivalent: s.frozen ? "unknown" : String(s.rotationEquivalent),
      cursor: String(s.cursor),
      style: s.style,
      solver: s.solverStatus,
      turning: String(s.turning),
      frozen: String(s.frozen),
    });
    const word = (ok: boolean): string => (s.frozen ? "Unknown" : ok ? "Solved" : "Unsolved");
    shell.updateReadout(0, `${s.cursor} / ${s.history.length} HTM`);
    shell.updateReadout(1, String(s.turns));
    shell.updateReadout(2, word(s.exact));
    shell.updateReadout(3, word(s.rotationEquivalent));
    for (const el of manual) el.disabled = hold;
    undoButton.disabled = hold || s.cursor === 0;
    redoButton.disabled = hold || s.cursor === s.history.length;
    scrambleButton.disabled = newSession.disabled = s.frozen || pendingDesign !== null;
    primary.update({ disabled: s.frozen || pendingDesign !== null });
    design.disabled = s.frozen;
    design.value = pendingDesign ?? s.style;
    cancelButton.disabled = !s.busy || s.frozen;
    const key = [s.solverStatus, s.cursor, s.history.length, s.style, s.exact, s.rotationEquivalent, s.frozen].join("|");
    if (key !== nerdKey) {
      nerdKey = key;
      shell.refreshNerd();
    }
  }

  // ----- keyboard: face turns away from text fields, Escape cancels a running word
  shell.listen(env.keys, "keydown", (event) => {
    const e = event as KeyboardEvent;
    if (!controller || disposed) return;
    if (e.key === "Escape") {
      if (controller.snapshot.busy) controller.cancel();
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey || TEXT_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "")) return;
    if (/^[rludfb]$/i.test(e.key)) {
      e.preventDefault();
      if (pendingDesign) return;
      controller.manual(e.key.toUpperCase() + (e.shiftKey ? "'" : ""));
    }
  });

  // ----- teardown: the viewer cannot be destroyed while it animates, so the release waits for the legal turn.
  function release(): void {
    if (viewer?.animating) {
      env.nextFrame(release);
      return;
    }
    viewer?.destroy();
    env.expose?.("__playgroundViewer", undefined);
    viewer = null;
    for (const s of sessions.values()) s.assets.dispose();
    sessions.clear();
    for (const assets of retired) assets.dispose();
    retired = [];
    pictures.dispose();
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    designRequest++;
    uploadSeq++;
    controller?.cancel();
    release();
  }

  // ----- start
  try {
    await loadSession("picture");
  } catch (error) {
    if (!alive()) {
      dispose();
      return;
    }
    host.setAttribute("aria-busy", "false");
    shell.setStatus("error", `Unable to start: ${(error as Error).message}. Reload to try again.`);
    shell.updateReadout(2, "Unavailable");
    shell.updateReadout(3, "Unavailable");
    for (const el of [...manual, undoButton, redoButton, scrambleButton, newSession]) el.disabled = true;
    return { dispose };
  }
  if (!alive()) {
    dispose();
    return;
  }
  viewer = env.createViewer(host);
  env.expose?.("__playgroundViewer", viewer);
  // An explicit `pictures=` value is an explicit choice (it beats a stored one); none or an unknown value leaves the default.
  viewer.setPictureModeFromUrl?.(parsePictureMode(params.get("pictures")));
  applySpeed();
  region.inert = false;
  controller = new PlaygroundController(viewer, sessions.get("picture") as Session, update, env.solverFactory);
  update();
  return { dispose };
}
