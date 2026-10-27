import "./style.css";
import { CubeViewer } from "@cubistry/cube-viewer";
import { CounterController } from "./apps/counter/controller.ts";
import { validLabel, loadCounterDesign } from "./apps/counter/design.ts";
import { MinuteTimer, parseValue, shifted } from "./counter.mjs";
const $ = (id) => document.getElementById(id),
  timer = new MinuteTimer();
let value = 15,
  ready = false;
let printConfig = { label: "BREAK\nMINUTES", padded: true };
const error = (message) => {
  $("error").textContent = message || "";
};
function save() {
  try {
    localStorage.setItem(
      "cubistry-counter-v1",
      JSON.stringify({
        value,
        label: printConfig.label,
        padded: printConfig.padded,
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
  for (const id of ["label", "format"]) $(id).disabled = !ready;
  $("apply-print").disabled = !ready || !!view?.busy;
  $("stop-turns").disabled =
    !ready || !view?.busy || view?.progress.status === "stopping";
  $("mode").textContent =
    timer.state === "running"
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
  if (manual) timer.reset(next);
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
    meter.dataset.state = progress.status;
    meter.dataset.target = String(progress.target ?? "");
    meter.dataset.queued = String(progress.queuedTarget ?? "");
  }
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
  $("apply-print").disabled = busy || !ready;
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
$("reset").addEventListener("click", () => setValue(timer.reset()));
$("front").addEventListener("click", () => view?.resetCamera());
$("stop-turns").addEventListener("click", () =>
  action(() => {
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
let proof;
$("print-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ready || view.busy) return;
  const label = $("label").value.trim(),
    padded = $("format").value === "padded";
  if (!validLabel(label)) {
    error("Use one or two lines, up to 40 characters per line.");
    return;
  }
  const previousState = view.state;
  ready = false;
  $("apply-print").disabled = true;
  timerUi();
  try {
    await view.configure(label, padded, 15);
    printConfig = { label, padded };
    timer.reset(15);
    ready = true;
    setValue(15);
    $("status").textContent = "New fixed print applied · showing 15";
  } catch (e) {
    if (view.state === previousState) ready = true;
    error(e.message);
  } finally {
    $("apply-print").disabled = !ready;
    timerUi();
  }
});
function tick() {
  if (!ready) return;
  if (timer.state === "running") {
    const next = timer.value();
    if (next !== value) setValue(next, { manual: false });
    timerUi();
    save();
  }
}
setInterval(tick, 500);
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
    proof = await loadCounterDesign();
    view = new CounterController(viewer, proof, onPhysicalState);
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("cubistry-counter-v1"));
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
      if (typeof saved.label === "string" && validLabel(saved.label))
        $("label").value = saved.label;
      $("format").value = saved.padded === false ? "unpadded" : "padded";
      if (
        timer.restore(saved.timer) &&
        ["running", "paused", "finished"].includes(saved.timer.state)
      )
        value = timer.value();
    }
    await view.configure(
      $("label").value,
      $("format").value === "padded",
      value,
    );
    printConfig = {
      label: $("label").value,
      padded: $("format").value === "padded",
    };
    ready = true;
    $("value").value = String(value);
    $("apply-print").disabled = false;
    timerUi();
  } catch (e) {
    error("Counter setup failed: " + e.message);
    $("status").textContent = "Unable to load the verified fixed print.";
  }
}
timerUi();
void initialize();
