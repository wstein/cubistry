import { CounterAuto } from "./apps/counter/auto.mjs";
import { loadCertifiedCounter } from "./apps/counter/certified.ts";
import "./style.css";
import { loadAssets } from "@cubistry/cube-assets";
import {
  CubeViewer,
  MIN_ANIMATION_SPEED,
  MAX_ANIMATION_SPEED,
} from "@cubistry/cube-viewer";
import { CounterController } from "./apps/counter/controller.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { MinuteTimer, parseValue, shifted } from "./counter.mjs";
const $ = (id) => document.getElementById(id),
  timer = new MinuteTimer(),
  auto = new CounterAuto();
let value = 0,
  ready = false;
let printConfig = { label: "COUNTER", padded: true, application: "certified" };
const error = (message) => {
  $("error").textContent = message || "";
};
function save() {
  try {
    localStorage.setItem(
      "cubistry-counter-v2",
      JSON.stringify({
        value,
        label: printConfig.label,
        padded: printConfig.padded,
        application: printConfig.application,
        speed: Number($("rotation-speed").value),
        timer: timer.serialize(),
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
function timerUi() {
  for (const el of document.querySelectorAll(
    ".controls button,.controls input",
  ))
    el.disabled = !ready;
  for (const id of ["application", "format"])
    $(id).disabled = !ready || !!view?.busy;
  $("auto").disabled = !ready;
  $("reset-session-moves").disabled = !ready || !!view?.busy;
  $("stop-turns").disabled =
    !ready || !view?.busy || view?.progress.status === "stopping";
  $("mode").textContent = auto.enabled
    ? "Auto"
    : timer.state === "running"
      ? "Counting down"
      : timer.state === "paused"
        ? "Timer paused"
        : "Manual";
  $("start").textContent = timer.state === "paused" ? "Resume" : "Start timer";
  $("start").disabled = !ready || timer.state === "running" || value === 0;
  $("pause").disabled = !ready || timer.state !== "running";
  $("timer-status").textContent =
    timer.state === "running"
      ? "Counting whole minutes. The clock keeps time while this tab is away."
      : timer.state === "paused"
        ? "Paused. Resume keeps the remaining part of the minute."
        : timer.state === "finished"
          ? "Break complete."
          : "Ready for " + value + " minute" + (value === 1 ? "" : "s") + ".";
}
function setValue(next, { manual = true } = {}) {
  if (!ready) return;
  if (manual) {
    timer.reset(next);
    if (auto.enabled)
      auto.start(
        next,
        printConfig.application === "countdown" ? -1 : 1,
        Date.now(),
      );
  }
  value = next;
  $("value").value = String(next);
  view.request(next);
  timerUi();
  save();
  error();
}
function action(fn) {
  try {
    fn();
    error();
  } catch (e) {
    error(e.message);
  }
}
let view, viewer;
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
    $("session-moves").textContent = `Session: ${progress.sessionTotal} moves`;
    $("session-moves").dataset.total = String(progress.sessionTotal);
    meter.dataset.state = progress.status;
    meter.dataset.target = String(progress.target ?? "");
    meter.dataset.queued = String(progress.queuedTarget ?? "");
  }
  $("reset-session-moves").disabled = !ready || busy;
  for (const id of ["application", "format"]) $(id).disabled = !ready || busy;
  $("stop-turns").disabled = !ready || !busy || progress?.status === "stopping";
  if (failure) {
    ready = false;
    timerUi();
    $("cube").setAttribute("aria-busy", "false");
    $("status").textContent = "Turn sequence stopped. Reload to recover.";
    error(
      "The cube could not complete its legal turn sequence. Reload to recover.",
    );
    return;
  }
  $("cube").setAttribute("aria-busy", String(busy));
  $("cube").dataset.value = String(physical);
  const message = busy
    ? progress?.status === "stopping"
      ? "Finishing " + progress.target + " before stopping…"
      : "Turning toward " +
        (progress?.target ?? value) +
        (progress?.queuedTarget != null
          ? " · next " + progress.queuedTarget
          : "…")
    : progress?.status === "stopped"
      ? "Stopped at " + physical + " · label restored"
      : "Showing " + physical + " · label restored";
  // The count changes once per committed token; don't repeat the same live status.
  if ($("status").textContent !== message) $("status").textContent = message;
};
try {
  viewer = new CubeViewer($("cube"));
} catch (e) {
  error(
    "WebGL is unavailable. Enable hardware acceleration or try another browser.",
  );
  $("status").textContent = "3D rendering unavailable.";
}
$("jump-form").addEventListener("submit", (e) => {
  e.preventDefault();
  action(() => setValue(parseValue($("value").value)));
});
for (const button of document.querySelectorAll("[data-delta]"))
  button.addEventListener("click", () =>
    action(() =>
      setValue(shifted(value, Number(button.dataset.delta), $("wrap").checked)),
    ),
  );
for (const [id, sign] of [
  ["add", 1],
  ["subtract", -1],
])
  $(id).addEventListener("click", () =>
    action(() => {
      const step = parseValue($("step").value);
      if (step === 0) throw Error("Use a step from 1 to 99.");
      setValue(shifted(value, sign * step, $("wrap").checked));
    }),
  );
$("start").addEventListener("click", () =>
  action(() => {
    if (!ready) return;
    stopAuto();
    timer.start(value);
    timerUi();
    save();
  }),
);
$("pause").addEventListener("click", () => {
  const next = timer.pause();
  if (next !== value) setValue(next, { manual: false });
  timerUi();
  save();
});
$("reset").addEventListener("click", () => {
  stopAuto();
  setValue(timer.reset());
});
$("reset-session-moves").addEventListener("click", () =>
  action(() => view?.resetSessionMoves()),
);
$("front").addEventListener("click", () => view?.resetCamera());
$("stop-turns").addEventListener("click", () =>
  action(() => {
    stopAuto();
    const target = view?.stopAfterCurrent();
    if (target == null) return;
    // Do not request again: that would reinstate the queue just cancelled.
    timer.reset(target);
    value = target;
    $("value").value = String(target);
    timerUi();
    save();
  }),
);
let proof, certified;
const initialValue = (app) => (app === "countdown" ? 10 : 0);
function applicationStatus() {
  $("application").options[0].textContent = printConfig.padded
    ? "Counter 00–99 (Certified)"
    : "Counter 0–99 (Blank tens)";
  $("application").options[1].textContent = printConfig.padded
    ? "Counter countdown 10–00 (Certified)"
    : "Counter countdown 10–0 (Blank tens)";
  $("application-status").textContent = !printConfig.padded
    ? "Original permanent print · no certified 339-HTM route."
    : "Certified adjacent route: 339 HTM / 99 steps, maximum 5 per edge. Setup excluded; arbitrary jumps differ.";
}
function stopAuto() {
  auto.stop();
  $("auto").checked = false;
  $("auto-status").textContent = "Auto off · fixed one-second cadence.";
}
async function selectedRoute() {
  if ($("format").value === "unpadded") return null;
  certified ??= await loadCertifiedCounter(proof, import.meta.env.BASE_URL);
  return certified;
}
async function changeApplication(formatChange = false) {
  if (!ready || view.busy) return;
  stopAuto();
  if (!formatChange) $("format").value = "padded";
  const app = $("application").value,
    padded = $("format").value === "padded";
  const previousState = view.state;
  ready = false;
  timerUi();
  try {
    const route = await selectedRoute(),
      initial = initialValue(app);
    await view.configure("COUNTER", padded, initial, route);
    printConfig = { label: "COUNTER", padded, application: app };
    timer.reset(initial);
    ready = true;
    setValue(initial);
    applicationStatus();
    $("status").textContent =
      `Application configured · showing ${initial} · new physical print/session`;
  } catch (e) {
    if (view.state === previousState) ready = true;
    $("application").value = printConfig.application;
    $("format").value = printConfig.padded ? "padded" : "unpadded";
    error(e.message);
  } finally {
    timerUi();
  }
}
$("application").addEventListener("change", () => void changeApplication());
$("format").addEventListener("change", () => void changeApplication(true));
$("auto").addEventListener("change", () => {
  if ($("auto").checked) {
    timer.reset(value);
    auto.start(
      value,
      printConfig.application === "countdown" ? -1 : 1,
      Date.now(),
    );
    $("auto-status").textContent =
      "Auto on · wall-clock steps every second; latest target only.";
  } else {
    stopAuto();
    const active = view?.stopAfterCurrent();
    if (active != null) {
      value = active;
      $("value").value = String(active);
    }
  }
  timerUi();
  save();
});
function speedUi() {
  const speed = Number($("rotation-speed").value);
  viewer?.setAnimationSpeed(speed);
  $("speed-label").textContent = `${Number(speed.toFixed(3))}×`;
}
$("rotation-speed").addEventListener("input", () => {
  speedUi();
  save();
});
function tick() {
  if (!ready) return;
  if (auto.enabled) {
    const next = auto.value(Date.now(), $("wrap").checked);
    if (next !== value) setValue(next, { manual: false });
    if (
      !$("wrap").checked &&
      ((printConfig.application === "countdown" && next === 0) ||
        (printConfig.application !== "countdown" && next === 99))
    )
      stopAuto();
    timerUi();
    save();
  } else if (timer.state === "running") {
    const next = timer.value();
    if (next !== value) setValue(next, { manual: false });
    timerUi();
    save();
  }
}
setInterval(tick, 100);
document.addEventListener("visibilitychange", tick);
window.addEventListener("pageshow", tick);
window.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || !ready)
    return;
  const steps = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
  if (e.key in steps) {
    e.preventDefault();
    setValue(shifted(value, steps[e.key], $("wrap").checked));
  }
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
      /* Start with the default print. */
    }
    if (
      saved &&
      Number.isInteger(saved.value) &&
      saved.value >= 0 &&
      saved.value <= 99
    ) {
      value = saved.value;

      $("format").value = saved.padded === false ? "unpadded" : "padded";
      $("application").value = ["certified", "countdown"].includes(
        saved.application,
      )
        ? saved.application
        : "certified";
      if (
        Number.isFinite(saved.speed) &&
        saved.speed >= MIN_ANIMATION_SPEED &&
        saved.speed <= MAX_ANIMATION_SPEED
      )
        $("rotation-speed").value = String(saved.speed);
      if (
        timer.restore(saved.timer) &&
        ["running", "paused", "finished"].includes(saved.timer.state)
      )
        value = timer.value();
    }
    await view.configure(
      "COUNTER",
      $("format").value === "padded",
      value,
      await selectedRoute(),
    );
    printConfig = {
      label: "COUNTER",
      padded: $("format").value === "padded",
      application: $("application").value,
    };
    ready = true;
    $("value").value = String(value);
    applicationStatus();
    speedUi();
    timerUi();
  } catch (e) {
    error("Counter setup failed: " + e.message);
    $("status").textContent = "Unable to load the verified fixed print.";
  }
}
timerUi();
void initialize();
