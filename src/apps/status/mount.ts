// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The CI Quality Cube as a mode of the unified host (`index.html?app=ci`). It mounts the existing definition,
 * workflow, policy and controller (local simulation only: no external CI service, no token) and fills the dock slots,
 * status chip, primary action, readout and Nerd drawer through the `ModeShell`.
 */
import type { loadAssets } from "@cubistry/cube-assets";
import { stickerPoses } from "@cubistry/cube-mechanics";
import type { ModeInstance, MountContext } from "../registry.ts";
import type { PhysicalView } from "../shared/playback.ts";
import type { PrimaryActionHandle } from "../shell/slot-api.ts";
import { StatusController } from "./controller.ts";
import {
  FRONT,
  StatusWorkflow,
  validateStatusDefinition,
  valueSnapshot,
  type Snapshot,
  type StatusDefinition,
} from "./definition.ts";
import { SPEED_CHOICES, parseStatusParams, serializeStatusParams } from "./params.ts";
import type { QualityPolicy } from "./policy.ts";

export interface StatusViewer extends PhysicalView {
  setAnimationSpeed(speed: number, kind?: string): void;
  destroy(): void;
}

/** Everything the mount takes from the browser, so node tests can run it with fakes. */
export interface StatusEnv {
  doc: Pick<Document, "createElement">;
  /** The raw `definition.json`; the mount validates it. */
  definition: unknown;
  createViewer(host: HTMLElement): StatusViewer;
  /** Duration of one quarter turn at speed 1 (BASE_MOVE_DURATION_MS). */
  baseMoveMs: number;
  resolveAssets: typeof loadAssets;
  resolvePolicy(definition: StatusDefinition): Promise<QualityPolicy>;
  reload(): void;
  /** Writes the mode's own parameters into the address bar without a history entry. */
  replaceParams?(own: URLSearchParams, ownKeys: readonly string[]): void;
  wait(ms: number): Promise<void>;
}

/**
 * Test hooks only (tests/status-mode.test.mjs, tests/browser/status-cube-hosted.spec.mjs); nothing in the product reads
 * them. They are mutable module state like `statusController` in src/status.mjs and are cleared on dispose.
 */
export let statusController: StatusController | null = null;
export let statusDefinition: StatusDefinition | null = null;

const DEMO_STEP_MS = 500;

export async function mountStatus(
  root: HTMLElement,
  params: URLSearchParams,
  ctx: MountContext,
  env: StatusEnv,
): Promise<ModeInstance | void> {
  const { shell, isCurrent } = ctx;
  const definition = validateStatusDefinition(env.definition);
  const workflow = new StatusWorkflow(definition);
  const wanted = parseStatusParams(params, definition);
  const ownKeys = ["speed", ...definition.categories.map((c) => c.id)];
  let ready = false,
    fatal = false,
    disposed = false,
    commandError = "",
    demoGeneration = 0,
    demoRunning = false,
    turnMs: number = wanted.turnMs,
    controller: StatusController | null = null,
    viewer: StatusViewer | null = null,
    afterSettled: (() => void) | null = null,
    historyKey = "";
  const alive = (): boolean => !disposed && isCurrent();

  // ----- DOM
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = env.doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const host = make("div", undefined, "status-viewer");
  host.setAttribute("style", "width:100%;height:100%");
  host.setAttribute("aria-busy", "true");
  // The viewer docks its Appearance panel into the shell's view-controls region, as the scene of the other modes does.
  host.dataset.appearanceDock = "view-controls";
  const front = make("p", undefined, "status-front");
  front.className = "sr-only";
  front.setAttribute("aria-label", "Committed category and state words");
  root.append(host, front);

  const controls: HTMLButtonElement[] = [];
  const selects: HTMLSelectElement[] = [];
  const field = (id: string, label: string, options: readonly (readonly [string, string])[], onChange: (value: string) => void) => {
    const wrap = make("div");
    wrap.className = "shell-field";
    const lab = make("label", label);
    lab.setAttribute("for", id);
    const select = make("select", undefined, id);
    for (const [value, text] of options) {
      const option = make("option", text);
      option.setAttribute("value", value);
      select.append(option);
    }
    select.value = options[0][0];
    shell.listen(select, "change", () => onChange(select.value));
    wrap.append(lab, select);
    return { wrap, select };
  };
  const button = (id: string, text: string, onClick: () => void): HTMLButtonElement => {
    const b = make("button", text, id);
    b.setAttribute("type", "button");
    shell.listen(b, "click", onClick);
    return b;
  };

  const label = (snapshot: Snapshot): string =>
    snapshot
      .map((state, i) => `${definition.categories[i].label}: ${definition.states.find((s) => s.id === state)?.label}`)
      .join(" · ");

  function stopDemo(): void {
    demoGeneration++;
    demoRunning = false;
  }

  /** The address bar keeps `speed`; the category parameters are a one-time request and leave it once applied. */
  function syncUrl(): void {
    if (!alive()) return;
    env.replaceParams?.(serializeStatusParams({ turnMs, snapshot: definition.initial }, definition), ownKeys);
  }

  let primary: PrimaryActionHandle | null = null;
  const demoButton = button("status-demo", "Run demo", () => void runDemo());
  const burstButton = button("status-burst", "Send rapid sequence", () => {
    stopDemo();
    prepareDemo();
    for (const step of definition.demonstration) action(() => workflow.dispatch(step.category, step.event), false);
  });
  const finishButton = button("status-finish", "Finish active snapshot", () => {
    if (!ready || fatal) return;
    stopDemo();
    const active = controller?.stopAfterCurrent() ?? null;
    if (active !== null) workflow.selectSnapshot(valueSnapshot(active));
    commandError = "";
    show();
  });
  controls.push(demoButton, burstButton);

  const eventCategory = field(
    "status-event-category",
    "Event category",
    definition.categories.map((c) => [c.id, c.label] as const),
    () => {},
  );
  const eventChoice = field(
    "status-event",
    "Simulated agent event",
    definition.events.map((e) => [e.id, e.label] as const),
    () => {},
  );
  selects.push(eventCategory.select, eventChoice.select);

  const categorySelects = definition.categories.map((category, i) => {
    const f = field(
      `status-${category.id}`,
      category.label,
      definition.states.map((s) => [s.id, s.label] as const),
      (value) => action(() => workflow.select(category.id, value)),
    );
    f.select.value = definition.initial[i];
    selects.push(f.select);
    return f;
  });
  const speed = field(
    "status-speed",
    "Quarter-turn time",
    SPEED_CHOICES.map((ms) => [String(ms), `${ms} ms`] as const),
    (value) => {
      turnMs = Number(value);
      viewer?.setAnimationSpeed(env.baseMoveMs / turnMs, "quarter-turn");
      syncUrl();
    },
  );
  speed.select.value = String(turnMs);

  const eventBody = make("div");
  eventBody.className = "shell-stack";
  const row = make("div");
  row.className = "shell-btn-row";
  row.append(demoButton, burstButton);
  eventBody.append(eventCategory.wrap, eventChoice.wrap, row, finishButton);
  shell.setSlot(1, { label: "Simulated events", element: eventBody });
  shell.setSlot(2, { label: "Workflow", element: [...categorySelects.map((f) => f.wrap), speed.wrap] });
  primary = shell.setPrimaryAction({
    label: "Send event",
    disabled: true,
    onClick: () =>
      action(() => workflow.dispatch(eventCategory.select.value, eventChoice.select.value)),
  });
  // Short values only: the readout is set in large numerals. The snapshots are in the chip and the Nerd drawer.
  shell.setReadout([
    { role: "Moves", value: "0 / 0 HTM" },
    { role: "Session", value: "0" },
  ]);
  shell.setNerd({
    title: "Recent local events",
    render(body) {
      const facts = make("dl");
      const fact = (term: string, value: string): void => {
        facts.append(make("dt", term), make("dd", value));
      };
      fact("Last completed snapshot", controller?.state ? label(controller.currentStatus) : "Not configured");
      fact("Requested snapshot", label(workflow.requested));
      body.append(facts);
      const list = make("ol");
      list.setAttribute("aria-label", "Recent simulated workflow events");
      for (const message of workflow.history) list.append(make("li", message));
      body.append(list);
    },
  });

  // ----- state to view
  function show(): void {
    if (!alive() || !controller) return;
    const c = controller,
      p = c.progress;
    shell.updateReadout(0, `${p.completed} / ${p.total} HTM`);
    shell.updateReadout(1, String(p.sessionTotal));
    definition.categories.forEach((category, i) => {
      categorySelects[i].select.value = workflow.requested[i];
    });
    if (fatal) shell.setStatus("error", c.state ? "Playback failed. Reload to recover." : "Initialization failed. Reload to recover.");
    else if (!ready) shell.setStatus("sync", "Loading the fixed workflow print…");
    else if (c.busy) shell.setStatus("moving", "Moving toward the requested snapshot.");
    else if (workflow.fault) shell.setStatus("warn", workflow.fault);
    else shell.setStatus("done", `In sync · ${label(c.currentStatus)}`);
    host.setAttribute("aria-busy", String(c.busy));
    Object.assign(host.dataset, {
      current: c.state ? c.currentStatus.join(",") : "",
      requested: workflow.requested.join(","),
      sync: fatal ? "failed" : c.busy ? "moving" : "idle",
      sessionMoves: String(p.sessionTotal),
    });
    if (c.state) {
      const poses = stickerPoses(definition.print, c.state);
      front.textContent = FRONT.map((position) => {
        const s = poses.find((s) => s.n.join() === "0,0,1" && s.p.join() === position.join());
        if (!s) return "?";
        const category = definition.categories.find((k) => s.assetId.startsWith(`quality-${k.id}-`));
        const state = definition.states.find((t) => s.assetId === `quality-${category?.id}-${t.id}`);
        return `${category?.label ?? "?"} ${state?.word ?? "?"}${s.up.join() !== "0,1,0" ? " (turning)" : ""}`;
      }).join(" · ");
    }
    const key = [workflow.history.join("\n"), c.state ? c.currentStatus.join() : "", workflow.requested.join()].join("|");
    if (key !== historyKey) {
      historyKey = key;
      shell.refreshNerd();
    }
    shell.setError(commandError ? { text: commandError, onDismiss: () => (commandError = "") } : null);
    const off = !ready || fatal;
    for (const b of controls) b.disabled = off;
    for (const s of selects) s.disabled = off;
    finishButton.disabled = off || !c.busy;
    const demoLabel = demoRunning ? "Stop demo" : "Run demo";
    if (demoButton.textContent !== demoLabel) demoButton.textContent = demoLabel;
    demoButton.setAttribute("aria-pressed", String(demoRunning));
    primary?.update({ disabled: off });
  }

  function fail(error: unknown): void {
    fatal = true;
    stopDemo();
    commandError = (error as Error)?.message ?? "Quality application failed";
    host.setAttribute("aria-busy", "false");
    primary = null;
    shell.setPrimaryAction({ label: "Reload application", onClick: () => env.reload() });
    show();
  }

  function action(update: () => void, cancelDemo = true): void {
    if (!ready || fatal || !alive()) return;
    if (cancelDemo) stopDemo();
    try {
      update();
      commandError = "";
      controller?.requestStatus(workflow.requested);
    } catch (error) {
      commandError = (error as Error).message;
    }
    show();
  }

  function prepareDemo(): void {
    action(() => workflow.selectSnapshot(definition.initial), false);
  }

  async function runDemo(): Promise<void> {
    if (demoRunning) {
      stopDemo();
      show();
      return;
    }
    if (!ready || fatal) return;
    const generation = ++demoGeneration;
    demoRunning = true;
    prepareDemo();
    show();
    for (const step of definition.demonstration) {
      if (generation !== demoGeneration || fatal || !alive()) break;
      action(() => workflow.dispatch(step.category, step.event), false);
      await env.wait(DEMO_STEP_MS);
    }
    if (generation === demoGeneration && alive()) {
      demoRunning = false;
      show();
    }
  }

  // ----- teardown: the viewer cannot be destroyed while it animates, so a busy controller finishes its active
  // snapshot first and the release happens when it settles.
  function release(): void {
    afterSettled = null;
    try {
      if (statusController === controller) statusController = null;
      if (statusDefinition === definition) statusDefinition = null;
      controller?.dispose();
    } catch {
      // nothing left to release
    }
    viewer?.destroy();
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stopDemo();
    if (controller?.busy) {
      controller.stopAfterCurrent();
      afterSettled = release;
    } else release();
  }

  // ----- start
  viewer = env.createViewer(host);
  viewer.setAnimationSpeed(env.baseMoveMs / turnMs, "quarter-turn");
  controller = new StatusController(
    viewer,
    definition,
    (_value, busy, error) => {
      if (disposed) {
        if (!busy) afterSettled?.();
        return;
      }
      if (error) fail(error);
      else show();
    },
    env.resolveAssets,
    () => env.resolvePolicy(definition),
  );
  statusController = controller;
  statusDefinition = definition;
  show();
  try {
    await controller.configure();
  } catch (error) {
    if (!alive()) {
      dispose();
      return;
    }
    fail(error);
    return { dispose };
  }
  if (!alive()) {
    dispose();
    return;
  }
  ready = true;
  show();
  if (wanted.snapshot.some((state, i) => state !== definition.initial[i])) {
    action(() => workflow.selectSnapshot(wanted.snapshot));
  }
  syncUrl();
  return { dispose };
}
