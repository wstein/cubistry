import "./style.css";
import "./status.css";
import raw from "./apps/status/definition.json";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { loadAssets } from "@cubistry/cube-assets";
import { stickerPoses } from "@cubistry/cube-mechanics";
import {
  StatusWorkflow,
  validateStatusDefinition,
  FRONT,
  valueSnapshot,
} from "./apps/status/definition.ts";
import { QualityPolicy } from "./apps/status/policy.ts";
import { StatusController } from "./apps/status/controller.ts";
const $ = (id) => document.getElementById(id);
export let statusController = null;
export let statusDefinition = null;
let workflow,
  viewer,
  ready = false,
  fatal = false,
  commandError = "",
  demoGeneration = 0,
  demoRunning = false;
const label = (snapshot) =>
  snapshot
    .map(
      (state, i) =>
        `${statusDefinition.categories[i].label}: ${statusDefinition.states.find((s) => s.id === state).label}`,
    )
    .join(" · ");
function stopDemo() {
  demoGeneration++;
  demoRunning = false;
}
function controls() {
  for (const element of document.querySelectorAll("[data-quality-control]"))
    element.disabled = !ready || fatal;
  $("status-finish").disabled = !ready || fatal || !statusController?.busy;
  $("status-demo").textContent = demoRunning ? "Stop demo" : "Run demo";
  $("status-demo").setAttribute("aria-pressed", String(demoRunning));
}
function show() {
  if (!workflow || !statusController) return;
  const c = statusController,
    p = c.progress;
  $("status-current").textContent = c.state
    ? label(c.currentStatus)
    : "Not configured";
  $("status-requested").textContent = label(workflow.requested);
  statusDefinition.categories.forEach((category, i) => {
    $(`status-${category.id}`).value = workflow.requested[i];
  });
  $("status-fault").textContent = workflow.fault ?? "";
  $("status-moves").textContent =
    `${p.completed} / ${p.total} HTM · Session ${p.sessionTotal}`;
  $("status-sync").textContent = fatal
    ? c.state
      ? "Playback failed. The last committed pose is retained; reload to recover."
      : "Initialization failed. Reload to recover."
    : c.busy
      ? "Moving toward the requested snapshot."
      : "In sync · " + label(c.currentStatus);
  $("status-viewer").setAttribute("aria-busy", String(c.busy));
  Object.assign($("status-viewer").dataset, {
    current: c.state ? c.currentStatus.join(",") : "",
    requested: workflow.requested.join(","),
    sync: fatal ? "failed" : c.busy ? "moving" : "idle",
    sessionMoves: String(p.sessionTotal),
  });
  if (c.state) {
    const poses = stickerPoses(statusDefinition.print, c.state);
    $("status-front").textContent = FRONT.map((position) => {
      const s = poses.find(
        (s) => s.n.join() === "0,0,1" && s.p.join() === position.join(),
      );
      if (!s) return "?";
      const category = statusDefinition.categories.find((c) =>
        s.assetId.startsWith(`quality-${c.id}-`),
      );
      const state = statusDefinition.states.find(
        (t) => s.assetId === `quality-${category?.id}-${t.id}`,
      );
      return `${category?.label ?? "?"} ${state?.word ?? "?"}${s.up.join() !== "0,1,0" ? " (turning)" : ""}`;
    }).join(" · ");
  }
  $("status-history").replaceChildren(
    ...workflow.history.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
  $("status-error").textContent = commandError;
  controls();
}
function fail(error) {
  fatal = true;
  stopDemo();
  commandError = error?.message ?? "Quality application failed";
  $("status-error").textContent = commandError;
  $("status-sync").textContent = "Application stopped. Reload to recover.";
  $("status-reload").hidden = false;
  $("status-viewer").setAttribute("aria-busy", "false");
  if (statusController) show();
  else controls();
}
function action(update, cancelDemo = true) {
  if (!ready || fatal) return;
  if (cancelDemo) stopDemo();
  try {
    update();
    commandError = "";
    statusController.requestStatus(workflow.requested);
  } catch (error) {
    commandError = error.message;
  }
  show();
}
$("status-send").addEventListener("click", () =>
  action(() =>
    workflow.dispatch(
      $("status-event-category").value,
      $("status-event").value,
    ),
  ),
);
function prepareDemo() {
  action(() => workflow.selectSnapshot(statusDefinition.initial), false);
}
$("status-burst").addEventListener("click", () => {
  stopDemo();
  prepareDemo();
  for (const step of statusDefinition.demonstration)
    action(() => workflow.dispatch(step.category, step.event), false);
});
$("status-demo").addEventListener("click", async () => {
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
  for (const step of statusDefinition.demonstration) {
    if (generation !== demoGeneration || fatal) break;
    action(() => workflow.dispatch(step.category, step.event), false);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (generation === demoGeneration) {
    demoRunning = false;
    show();
  }
});
$("status-finish").addEventListener("click", () => {
  if (!ready || fatal) return;
  stopDemo();
  const active = statusController.stopAfterCurrent();
  if (active !== null) workflow.selectSnapshot(valueSnapshot(active));
  commandError = "";
  show();
});
$("status-speed").addEventListener("change", () =>
  viewer?.setAnimationSpeed(
    BASE_MOVE_DURATION_MS / Number($("status-speed").value),
    "quarter-turn",
  ),
);
$("status-reload").addEventListener("click", () => location.reload());
async function initialize() {
  try {
    statusDefinition = validateStatusDefinition(raw);
    workflow = new StatusWorkflow(statusDefinition);
    for (const category of statusDefinition.categories) {
      const select = $(`status-${category.id}`);
      for (const state of statusDefinition.states)
        select.add(new Option(state.label, state.id));
      select.addEventListener("change", () =>
        action(() => workflow.select(category.id, select.value)),
      );
      $("status-event-category").add(new Option(category.label, category.id));
    }
    for (const event of statusDefinition.events)
      $("status-event").add(new Option(event.label, event.id));
    viewer = new CubeViewer($("status-viewer"));
    viewer.setAnimationSpeed(
      BASE_MOVE_DURATION_MS / Number($("status-speed").value),
      "quarter-turn",
    );
    statusController = new StatusController(
      viewer,
      statusDefinition,
      (_value, _busy, error) => {
        if (error) fail(error);
        else show();
      },
      (manifest, prints) =>
        loadAssets(manifest, prints, undefined, import.meta.env.BASE_URL),
      () => QualityPolicy.load(statusDefinition, import.meta.env.BASE_URL),
    );
    await statusController.configure();
    ready = true;
    show();
  } catch (error) {
    fail(error);
  }
}
void initialize();
