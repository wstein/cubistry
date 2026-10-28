import {
  WorkshopClock,
  formatTimer,
  parseDuration,
} from "./apps/timer/clock.ts";
import { TimerController } from "./apps/timer/controller.ts";
import { loadTimerRoute } from "./apps/timer/design.ts";
import { CounterRun } from "./apps/counter/run.mjs";
import { loadCertifiedCounter } from "./apps/counter/certified.ts";
import "./style.css";
import { loadAssets } from "@cubistry/cube-assets";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { CounterController } from "./apps/counter/controller.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { parseValue, shifted } from "./counter.mjs";
const $ = (id) => document.getElementById(id);
const run = new CounterRun();
const durations = [2000, 1000, 500, 250, 100, 50];
const speedLabels = ["2 s", "1 s", "500 ms", "250 ms", "100 ms", "50 ms"];
let ready = false,
  value = 0,
  view,
  viewer,
  proof,
  certified;
let padded = true;
let application = "certified",
  timerRoute,
  timerStarted = false;
let durationDirty = false,
  configuredSeconds = 900;
const clock = new WorkshopClock();
const error = (message = "") => {
  $("error").textContent = message;
};
function save() {
  if (application === "timer") return;
  try {
    localStorage.setItem(
      "cubistry-counter-v2",
      JSON.stringify({
        value: view?.currentValue ?? value,
        label: "COUNTER",
        padded,
        application: "certified",
        moveDuration: durations[Number($("rotation-speed").value)],
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
function controlsUi() {
  for (const el of document.querySelectorAll(
    ".controls button,.controls input,.timer-controls button,.timer-controls input",
  ))
    el.disabled = !ready;
  $("application").disabled =
    !ready ||
    !!view?.busy ||
    run.running ||
    (application === "timer" && clock.running && !clock.elapsed);
  $("counter-controls").hidden = application === "timer";
  $("timer-controls").hidden = application !== "timer";
  $("timer-start").disabled = !ready || (clock.elapsed && !durationDirty);
  $("timer-start").textContent = clock.running
    ? "Pause"
    : timerStarted && !clock.elapsed && !durationDirty
      ? "Resume"
      : "Start";
  $("timer-start").setAttribute("aria-pressed", String(clock.running));
  $("timer-duration").disabled = !ready || clock.running;
  $("timer-set").disabled = !ready || clock.running;
  $("timer-mode").disabled = !ready;
  $("timer-speed").disabled = !ready;
  $("timer-duration-setting").hidden = clock.mode === "stopwatch";
  text(
    "timer-bounds",
    clock.mode === "stopwatch"
      ? "Completed 10-second intervals · limit 59:50"
      : "00:00–59:50 · 10-second steps",
  );
  if (application !== "timer") $("timer-sync").hidden = true;
  $("reset-session-moves").disabled =
    !ready ||
    !!view?.busy ||
    run.running ||
    (application === "timer" && clock.running && !clock.elapsed);
  $("format").disabled = !ready;

  const active = run.running || !!view?.busy;
  $("run").textContent = active ? "Stop" : "Run";
  $("run").setAttribute("aria-pressed", String(active));
  $("run").disabled = !ready || view?.progress.status === "stopping";
}
function action(fn) {
  try {
    error();
    fn();
  } catch (e) {
    error(e.message);
  }
}
function request(next) {
  value = next;
  view.request(next);
  controlsUi();
}
function stopRun() {
  run.stop();
  const active = view?.stopAfterCurrent();
  value = active ?? view?.currentValue ?? value;
  controlsUi();
}
function manual(next, updateInput = true) {
  if (!ready) return;
  run.stop();
  if (updateInput) $("value").value = String(next);
  request(next);
}
const onPhysicalState = (physical, busy, failure, progress) => {
  if (progress) {
    const meter = $("move-progress");
    meter.textContent = `${progress.completed} / ${progress.total} moves`;
    meter.setAttribute("aria-valuenow", String(progress.completed));
    meter.setAttribute("aria-valuemax", String(progress.total));
    meter.setAttribute(
      "aria-valuetext",
      `${progress.completed} of ${progress.total} moves committed`,
    );
    Object.assign(meter.dataset, {
      state: progress.status,
      target: String(progress.target ?? ""),
      queued: String(progress.queuedTarget ?? ""),
    });
    $("session-moves").textContent = String(progress.sessionTotal);
    $("session-moves").dataset.total = String(progress.sessionTotal);
  }
  $("cube").setAttribute("aria-busy", String(busy));
  $("cube").dataset.value =
    application === "timer" ? formatTimer(physical) : String(physical);
  $("cube").dataset.application = application;
  if (failure) {
    ready = false;
    run.stop();
    if (application === "timer") clock.pause();
    error(
      "The cube could not complete its legal turn sequence. Reload to recover.",
    );
  }
  if (application === "timer") {
    timerUi();
    controlsUi();
    return;
  }
  if (!busy) {
    value = physical;
    if (physical === run.target) run.stop();
    save();
  }
  $("status").textContent = failure
    ? "Turn sequence stopped."
    : run.running
      ? `Running to ${run.target} · Current ${physical}`
      : busy
        ? `Finishing ${progress?.target ?? value}…`
        : `Current ${physical}`;
  controlsUi();
};
try {
  viewer = new CubeViewer($("cube"));
} catch {
  error(
    "WebGL is unavailable. Enable hardware acceleration or try another browser.",
  );
  $("status").textContent = "3D rendering unavailable.";
}
// The viewer emits only actual camera movement, with a drag threshold to ignore clicks.
const hideHint = () => {
  $("viewer-hint").hidden = true;
};
$("cube").addEventListener("cube-camera-change", hideHint, { once: true });
setTimeout(hideHint, 10000);
$("jump-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => manual(parseValue($("value").value), false));
});
$("run").addEventListener("click", () =>
  action(() => {
    if (!ready) return;
    if (run.running || view.busy) {
      stopRun();
      $("status").textContent = view.busy
        ? `Finishing ${value} before stopping…`
        : `Current ${value}`;
      return;
    }
    const target = parseValue($("value").value);
    run.start(view.currentValue, target);
    controlsUi();
    $("status").textContent = run.running
      ? `Running to ${target} · Current ${view.currentValue}`
      : `Current ${view.currentValue}`;
  }),
);
for (const button of document.querySelectorAll("[data-delta]"))
  button.addEventListener("click", () =>
    action(() =>
      manual(shifted(value, Number(button.dataset.delta), $("wrap").checked)),
    ),
  );
$("reset-session-moves").addEventListener("click", () =>
  action(() => view.resetSessionMoves()),
);
// This screen-only field rule never selects a different permanent print or solver.
function formatUi() {
  if (application === "timer") {
    viewer.setFaceletImageOverride(null);
    return;
  }
  viewer.setFaceletImageOverride(
    $("format").checked
      ? null
      : {
          position: [-1, -1, 1],
          normal: [0, 0, 1],
          sourceAssetId: "0",
          replacementAssetId: "blank",
        },
  );
}
$("format").addEventListener("change", () =>
  action(() => {
    formatUi();
    padded = $("format").checked;
    save();
  }),
);
function speedUi() {
  const stop = Number($("rotation-speed").value);
  viewer?.setAnimationSpeed(BASE_MOVE_DURATION_MS / durations[stop]);
  $("speed-label").textContent = `${speedLabels[stop]} per HTM move`;
  $("rotation-speed").setAttribute(
    "aria-valuetext",
    $("speed-label").textContent,
  );
}
$("rotation-speed").addEventListener("input", () => {
  speedUi();
  save();
});
function tick() {
  if (!ready) return;
  if (application === "timer") {
    if (
      (clock.running || (timerStarted && clock.elapsed)) &&
      (view.currentValue !== clock.bucket || view.busy)
    ) {
      const desired = clock.bucket;
      if (
        view.progress.queuedTarget !== desired &&
        view.progress.target !== desired
      )
        view.request(desired);
    }
    timerUi();
    controlsUi();
    return;
  }
  const next = run.next(view.currentValue, view.busy);
  if (next !== null) request(next);
  controlsUi();
}
setInterval(tick, 50);
document.addEventListener("visibilitychange", tick);
window.addEventListener("pageshow", tick);
window.addEventListener("keydown", (event) => {
  if (
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(
      event.target.tagName,
    ) ||
    !ready ||
    application === "timer"
  )
    return;
  const steps = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
  if (event.key in steps) {
    event.preventDefault();
    action(() => manual(shifted(value, steps[event.key], $("wrap").checked)));
  }
});
function text(id, value) {
  if ($(id).textContent !== value) $(id).textContent = value;
}
function timerUi() {
  const logical = clock.bucket,
    physical = view?.currentValue ?? logical;
  text("timer-logical", formatTimer(logical));
  text("timer-physical", formatTimer(physical));
  const settling = !!view?.busy || physical !== logical;
  $("timer-sync").hidden = !settling;
  const phase = clock.elapsed
    ? settling
      ? "Elapsed · settling"
      : clock.mode === "stopwatch"
        ? "Limit reached"
        : "Complete"
    : clock.running
      ? "Running"
      : timerStarted
        ? "Paused"
        : "Ready";
  text(
    "status",
    `${clock.mode === "countdown" ? "Countdown" : "Stopwatch"} · ${phase}`,
  );
}
$("timer-duration").addEventListener("input", () => {
  durationDirty = true;
  controlsUi();
});
function applyDuration() {
  const seconds = parseDuration($("timer-duration").value);
  clock.configure(seconds);
  configuredSeconds = seconds;
  durationDirty = false;
  timerStarted = false;
  $("timer-duration").value = formatTimer(seconds / 10);
  view.request(clock.bucket);
}
$("timer-start").addEventListener("click", () =>
  action(() => {
    if (!ready || application !== "timer") return;
    if (clock.running) {
      clock.pause();
      view.request(clock.bucket);
    } else {
      if (clock.mode === "countdown" && (!timerStarted || durationDirty))
        applyDuration();
      timerStarted = true;
      clock.start();
    }
    tick();
    timerUi();
    controlsUi();
  }),
);
$("timer-reset").addEventListener("click", () =>
  action(() => {
    if (!ready || application !== "timer") return;
    clock.reset();
    timerStarted = false;
    durationDirty = false;
    $("timer-duration").value = formatTimer(configuredSeconds / 10);
    view.request(clock.bucket);
    timerUi();
    controlsUi();
  }),
);
$("timer-duration-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    if (!ready || application !== "timer" || clock.running) return;
    applyDuration();
    timerUi();
    controlsUi();
  });
});
$("timer-mode").addEventListener("change", () =>
  action(() => {
    if (!ready || application !== "timer") return;
    clock.setMode($("timer-mode").value);
    timerStarted = false;
    durationDirty = false;
    $("timer-duration").value = formatTimer(configuredSeconds / 10);
    view.request(clock.bucket);
    timerUi();
    controlsUi();
  }),
);
$("timer-speed").addEventListener("change", () =>
  action(() => {
    if (!ready || application !== "timer") return;
    clock.setSpeed(Number($("timer-speed").value));
    tick();
  }),
);
$("application").addEventListener("change", async () => {
  if (
    !ready ||
    view.busy ||
    run.running ||
    (application === "timer" && clock.running && !clock.elapsed)
  ) {
    $("application").value = application;
    return;
  }
  const requested = $("application").value,
    previous = view;
  ready = false;
  controlsUi();
  let candidate;
  try {
    const callback = (...args) => {
      if (view === candidate) onPhysicalState(...args);
    };
    const resolveAssets = (manifest, prints, signal) =>
      loadAssets(manifest, prints, signal, import.meta.env.BASE_URL);
    if (requested === "timer") {
      timerRoute ??= await loadTimerRoute(import.meta.env.BASE_URL);
      candidate = new TimerController(
        viewer,
        timerRoute,
        proof.assets,
        callback,
        resolveAssets,
      );
      await candidate.configure(90);
      clock.setMode("countdown");
      clock.configure(900);
      clock.setSpeed(1);
      $("timer-mode").value = "countdown";
      $("timer-speed").value = "1";
      configuredSeconds = 900;
      durationDirty = false;
      timerStarted = false;
      $("timer-duration").value = "15:00";
    } else {
      candidate = new CounterController(viewer, proof, callback, resolveAssets);
      await candidate.configure("COUNTER", true, value, certified);
    }
    previous.dispose();
    view = candidate;
    application = requested;
    $("rotation-speed").value = application === "timer" ? "3" : "4";
    speedUi();
    formatUi();
    ready = true;
    error();
    onPhysicalState(view.currentValue, view.busy, undefined, view.progress);
  } catch (e) {
    candidate?.dispose();
    ready = true;
    $("application").value = application;
    error(e.message);
  }
  controlsUi();
});
async function initialize() {
  if (!viewer) return;
  try {
    proof = await loadCounterDesign(undefined, import.meta.env.BASE_URL);
    view = new CounterController(
      viewer,
      proof,
      onPhysicalState,
      (manifest, prints, signal) =>
        loadAssets(manifest, prints, signal, import.meta.env.BASE_URL),
    );
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("cubistry-counter-v2"));
    } catch {
      /* Use the default print. */
    }
    if (
      saved &&
      Number.isInteger(saved.value) &&
      saved.value >= 0 &&
      saved.value <= 99
    ) {
      value = saved.value;
      $("format").checked = saved.padded !== false;
      // Migrate the former continuous multiplier to the closest discrete duration.
      const duration =
        saved.moveDuration ??
        (Number.isFinite(saved.speed) && saved.speed > 0
          ? BASE_MOVE_DURATION_MS / saved.speed
          : 100);
      $("rotation-speed").value = String(
        durations.reduce(
          (best, n, i) =>
            Math.abs(n - duration) < Math.abs(durations[best] - duration)
              ? i
              : best,
          4,
        ),
      );
    }
    speedUi();
    certified = await loadCertifiedCounter(proof, import.meta.env.BASE_URL);
    await view.configure("COUNTER", true, value, certified);
    formatUi();
    padded = $("format").checked;
    ready = true;
    $("value").value = String(value);
    controlsUi();
    save();
  } catch (e) {
    error("Counter setup failed: " + e.message);
    $("status").textContent = "Unable to load the verified fixed print.";
  }
}
controlsUi();
void initialize();
