import { installPrintLink } from "./apps/print/link.ts";
import { HsmController } from "./apps/hsm/controller.ts";
import { SlicedExecutor } from "./apps/hsm/recovery-executor.ts";
import { loadHsmDesign } from "./apps/hsm/design.ts";
import hsmPin from "../hsm-source.json";
import { MsController } from "./apps/ms/controller.ts";
import { loadMsDesign } from "./apps/ms/design.ts";
import msPin from "../ms-source.json";
import hsmSymbols from "./apps/hsm/images.json";
import { HM_VARIANT, hmImages, loadHmDesign } from "./apps/hm/variant.ts";
import hmPin from "../hm-source.json";
import {
  hsmImagesFor,
  hsmDesignFor,
  hsmUnitLabel,
  parseLettering,
} from "./apps/hsm/lettering.ts";
import {
  WorkshopClock,
  TEN_SECOND_TIMER,
  FIVE_SECOND_TIMER,
  formatTimer,
  formatLiveTimer,
  parseDuration,
} from "./apps/timer/clock.ts";
import { TimerController } from "./apps/timer/controller.ts";
import { TimerScheduler } from "./apps/timer/scheduler.ts";
import { timerMotion } from "./apps/timer/status.ts";
import { loadTimerRoute, loadFiveSecondRoute } from "./apps/timer/design.ts";
import { CounterRun } from "./apps/counter/run.mjs";
import { SequenceNumber } from "./apps/shared/sequence-number.ts";
import { loadCertifiedCounter } from "./apps/counter/certified.ts";
import {
  loadBlankTopCounter,
  modeSwitchAt,
  sharedRangeLabel,
} from "./apps/counter/blank-top.ts";
import blankTopPin from "../counter-blank-top-source.json";
import "./style.css";
import { loadAssets } from "@cubistry/cube-assets";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { CounterController } from "./apps/counter/controller.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { parseValue, shifted } from "./counter.mjs";
import {
  leadingZeroLabel,
  wrapFor,
} from "./apps/counter/print-options.ts";
const $ = (id) => document.getElementById(id);
$("hsm-lettering").value = parseLettering(
  new URLSearchParams(location.search).get("lettering"),
);
// The Unit select follows the sticker lettering: H / M / S or hour / min / sec.
const syncHsmUnitLabels = () => {
  // The H/M One-Cube Counter (lettering choice hidden) has the large symbols
  // only.
  const lettering = $("hsm-lettering").hidden
    ? "symbols"
    : parseLettering($("hsm-lettering").value);
  for (const option of $("hsm-letter").options)
    option.textContent = hsmUnitLabel(option.value, lettering);
};
syncHsmUnitLabels();
$("hsm-lettering").addEventListener("change", syncHsmUnitLabels);
const run = new CounterRun();
const sequenceNumber = new SequenceNumber();
const durations = [2000, 1000, 500, 250, 100, 50, 10];
// Default rotation stop per HSM unit (index into `durations`): 100 ms for every
// unit. Only the live clock keeps its slower H 500 ms / M 250 ms preferences.
// Changing the unit or entering the HSM counter applies it.
// Recovery searches run in slices that yield to the event loop (docs/HSM_COUNTER.md).
const recoveryExecutor = new SlicedExecutor();
const hsmDefaultStops = { H: 4, M: 4, S: 4 };
const speedLabels = [
  "2 s",
  "1 s",
  "500 ms",
  "250 ms",
  "100 ms",
  "50 ms",
  "10 ms",
];
let ready = false,
  value = 0,
  view,
  viewer,
  proof,
  certified;
let padded = true;
// The permanent Counter print: "titled" (default) or "blank-top". On the
// blank-top print, the Leading Zero checkbox (labeled "Leading zero mode
// (physical)" there) selects the physical mode (LZ or NZ).
let counterPrint = "titled",
  blankTop;
// Wrap as the user set it in this page session, or null until they toggle it;
// while null, Wrap follows the active print's default (on for blank-top).
let wrapChoice = null;
const isBlankTop = () => counterPrint === "blank-top";
const modeName = (leadingZero) =>
  leadingZero ? "leading zero (LZ)" : "no leading zero (NZ)";
/** The stored route that a print and Leading Zero state select. */
const routeFor = (print, leadingZero) =>
  print === "blank-top"
    ? blankTop.routes[leadingZero ? "lz" : "nz"]
    : certified;
/** The switch word to the other mode at the current value, or null. */
function pendingSwitch() {
  if (!ready || !isBlankTop() || application !== "certified") return null;
  if (!view || view.busy || run.running || view.progress.status === "failed")
    return null;
  return modeSwitchAt(
    blankTop,
    view.config?.padded ? "nz" : "lz",
    view.currentValue,
  );
}
let hsmDesign,
  hmDesign,
  hsmRunning = false,
  hsmNextAt = 0,
  rememberedCounterValue = 0;
// The H/M One-Cube Counter is a second variant of the H/M/S counter: same
// controls, controller, planner and periods, with its own print and letters.
const isHsm = () =>
  application === "hsm-counter" || application === "hm-one-cube";
const isHm = () => application === "hm-one-cube";
// The M/S counter (research PR #138) walks the saved period of one print.
let msDesign,
  msRunning = false,
  msNextAt = 0;
const isMs = () => application === "ms-counter";
const msShift = (delta) => (value + delta + 60) % 60;
const hsmMaximum = () => Number($("hsm-range").value);
const hsmShift = (delta) =>
  (value + delta + hsmMaximum() + 1) % (hsmMaximum() + 1);
let application = "certified",
  timerRoute,
  fiveSecondRoute,
  timerStarted = false;
let durationDirty = false,
  configuredSeconds = 900;
let clock = new WorkshopClock();
const isTimer = () =>
  application === "timer" || application === "five-second-timer";
const formatTime = (bucket) => formatTimer(bucket, clock.profile);
const timerScheduler = new TimerScheduler(
  () => tick(),
  () => clock.snapshot(),
);
let effectiveMoveDuration = 250;
const error = (message = "") => {
  $("error").textContent = message;
};
function save() {
  if (isTimer() || isHsm() || isMs()) return;
  try {
    localStorage.setItem(
      "cubistry-counter-v2",
      JSON.stringify({
        value: view?.currentValue ?? value,
        label: "COUNTER",
        padded,
        print: counterPrint,
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
    hsmRunning ||
    msRunning ||
    (isTimer() && clock.running && !clock.elapsed);
  $("counter-controls").hidden = isTimer() || isHsm() || isMs();
  $("hsm-controls").hidden = !isHsm();
  for (const el of $("hsm-controls").querySelectorAll("button,input,select"))
    el.disabled = !ready;
  for (const id of [
    "hsm-letter",
    "hsm-lettering",
    "hsm-range",
    "hsm-direction",
  ])
    $(id).disabled = !ready || !!view?.busy || hsmRunning;
  $("hsm-run").textContent =
    hsmRunning || (isHsm() && view?.busy) ? "Stop" : "Run";
  $("hsm-run").setAttribute("aria-pressed", String(hsmRunning));
  $("ms-controls").hidden = !isMs();
  for (const el of $("ms-controls").querySelectorAll("button,input,select"))
    el.disabled = !ready;
  for (const id of ["ms-letter", "ms-direction"])
    $(id).disabled = !ready || !!view?.busy || msRunning;
  $("ms-run").textContent =
    msRunning || (isMs() && view?.busy) ? "Stop" : "Run";
  $("ms-run").setAttribute("aria-pressed", String(msRunning));
  $("timer-controls").hidden = !isTimer();
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
      ? `Cube: ${clock.profile.stepSeconds}-second steps · limit ${formatTime(clock.profile.maxSeconds / clock.profile.stepSeconds)}`
      : `00:00–${formatTime(clock.profile.maxSeconds / clock.profile.stepSeconds)} · ${clock.profile.stepSeconds}-second steps`,
  );
  $("timer-sync").hidden = !isTimer();
  $("reset-session-moves").disabled =
    !ready ||
    !!view?.busy ||
    run.running ||
    hsmRunning ||
    msRunning ||
    (isTimer() && clock.running && !clock.elapsed);
  $("format").disabled =
    !ready || isHsm() || isMs() || (isBlankTop() && pendingSwitch() === null);
  $("counter-print").disabled = !ready || !!view?.busy || run.running;
  $("mode-switch").hidden = !isBlankTop();
  text("setup-moves", String(view?.modeSwitch?.committed ?? 0));
  text("format-label", leadingZeroLabel(counterPrint));
  text(
    "format-note",
    isBlankTop()
      ? `On the blank-top print, this checkbox selects the physical mode: on is LZ (shows 00–09), off is NZ (a blank tens sticker for 0–9). It is enabled only while the cube is idle: at 0 the switch plays ${blankTop.modeSwitch.length} setup moves, at ${sharedRangeLabel(blankTop)} it plays none (both modes share the cube state there), and elsewhere it is disabled.`
      : "Leading Zero shows or hides only the leading 0. The layout, value, and moves stay the same.",
  );

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
  if (isHsm()) view.setMode(hsmMaximum(), Number($("hsm-direction").value));
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
    text("sequence-number", String(sequenceNumber.observe(progress) || "—"));
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
  $("cube").dataset.value = isTimer() ? formatTime(physical) : String(physical);
  $("cube").dataset.application = application;
  if (failure) {
    ready = false;
    run.stop();
    hsmRunning = false;
    msRunning = false;
    if (isTimer()) {
      clock.pause();
      timerScheduler.invalidate();
    }
    error(
      "The cube could not complete its legal turn sequence. Reload to recover.",
    );
  }
  if (isTimer()) {
    timerUi();
    controlsUi();
    return;
  }
  if (isHsm()) {
    if (!busy) value = physical;
    text(
      "status",
      failure
        ? "Turn sequence stopped."
        : `${view.letter} · ${String(physical).padStart(2, "0")} · ${hsmRunning ? "Running" : busy ? "Moving" : "Ready"}`,
    );
    controlsUi();
    return;
  }
  if (isMs()) {
    if (!busy) value = physical;
    const { lap, laps } = view.lap;
    text(
      "status",
      failure
        ? "Turn sequence stopped."
        : `${view.letter} · ${String(physical).padStart(2, "0")} · ${msRunning ? "Running" : busy ? "Moving" : "Ready"}`,
    );
    const msRun = view.period.run;
    text(
      "ms-period",
      `${view.msPrint.label} · ${view.letter} period: ${msRun.laps} lap${msRun.laps > 1 ? "s" : ""}, ${msRun.periodHTM} moves, at most ${msRun.maximumHTM} per step` +
        (laps > 1 && lap ? ` · lap ${lap} of ${laps}` : ""),
    );
    controlsUi();
    return;
  }
  if (!busy) {
    value = physical;
    if (physical === run.target) run.stop();
    save();
  }
  const switching = view?.modeSwitch?.active ? view.modeSwitch : null;
  $("status").textContent = failure
    ? "Turn sequence stopped."
    : switching
      ? `Switching to ${modeName(!view.config?.padded)} · ${switching.completed} / ${switching.total} setup moves`
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
// The compatibility event reports presentation or zoom changes, ignoring clicks.
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
  // The blank-top print shows its own physical blank; nothing is masked.
  if (isTimer() || isHsm() || isMs() || isBlankTop()) {
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
$("wrap").addEventListener("change", () => {
  wrapChoice = $("wrap").checked;
});
$("format").addEventListener("change", () => {
  if (isBlankTop()) {
    void switchMode($("format").checked);
    return;
  }
  action(() => {
    formatUi();
    padded = $("format").checked;
    save();
  });
});
/**
 * Blank-top only: switch the physical mode with an explicit, animated word
 * (at 0) or no turn (where both modes share the complete state). Refused
 * anywhere else; the checkbox then returns to the active mode.
 */
async function switchMode(leadingZero) {
  const moves = pendingSwitch();
  const active = view?.config?.padded ?? !leadingZero;
  if (moves === null || leadingZero === active) {
    $("format").checked = active;
    error(
      `Switch modes at 0, or at ${sharedRangeLabel(blankTop)} where both modes share the cube state.`,
    );
    controlsUi();
    return;
  }
  error();
  try {
    await view.switchRoute(routeFor("blank-top", leadingZero), moves);
    padded = leadingZero;
    save();
  } catch (e) {
    // A failed turn already reported "Reload to recover"; keep that message.
    if (ready) error(e.message);
  }
  $("format").checked = view.config?.padded ?? active;
  if (ready)
    $("status").textContent = `Current ${view.currentValue} · ${modeName(view.config?.padded)}`;
  controlsUi();
}
$("counter-print").addEventListener("change", async () => {
  const requested = $("counter-print").value;
  if (
    !ready ||
    view.busy ||
    run.running ||
    application !== "certified" ||
    requested === counterPrint
  ) {
    $("counter-print").value = counterPrint;
    return;
  }
  ready = false;
  controlsUi();
  try {
    if (requested === "blank-top")
      blankTop ??= await loadBlankTopCounter(
        proof,
        blankTopPin.runtimeSHA256,
        import.meta.env.BASE_URL,
      );
    const route = routeFor(requested, $("format").checked);
    const installed = view.currentValue;
    // An explicit new-print operation: the other permanent print is
    // installed in its canonical state for the current value.
    await view.configure("COUNTER", route.padded, installed, route);
    counterPrint = requested;
    $("wrap").checked = wrapFor(counterPrint, wrapChoice);
    padded = $("format").checked;
    value = installed;
    formatUi();
    ready = true;
    error();
    onPhysicalState(view.currentValue, view.busy, undefined, view.progress);
    $("status").textContent = `${requested === "blank-top" ? `Blank-top print, ${modeName(route.padded)}` : "COUNTER title print"} installed at ${installed}. Session moves restart at 0.`;
  } catch (e) {
    ready = true;
    $("counter-print").value = counterPrint;
    error(e.message);
  }
  controlsUi();
});
function speedUi() {
  const stop = Number($("rotation-speed").value);
  if (!isTimer() || !ready)
    viewer?.setAnimationSpeed(BASE_MOVE_DURATION_MS / durations[stop]);
  $("speed-label").textContent = isTimer()
    ? `${speedLabels[stop]} preferred`
    : `${speedLabels[stop]} per HTM move`;
  $("rotation-speed").setAttribute(
    "aria-valuetext",
    $("speed-label").textContent,
  );
}
$("rotation-speed").addEventListener("input", () => {
  speedUi();
  if (isTimer()) tick();
  save();
});
function tick() {
  if (!ready) return;
  if (isHsm()) {
    if (hsmRunning && !view.busy && performance.now() >= hsmNextAt) {
      hsmNextAt = performance.now() + 1000;
      request(hsmShift(Number($("hsm-direction").value)));
    }
    return;
  }
  if (isMs()) {
    if (msRunning && !view.busy && performance.now() >= msNextAt) {
      msNextAt = performance.now() + 1000;
      request(msShift(Number($("ms-direction").value)));
    }
    return;
  }
  if (isTimer()) {
    timerScheduler.tick(
      clock.snapshot(),
      view,
      durations[Number($("rotation-speed").value)],
      (duration) => {
        effectiveMoveDuration = duration;
        viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / duration);
      },
    );
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
    isTimer() ||
    isHsm() ||
    isMs()
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
  const snapshot = clock.snapshot();
  const logical = snapshot.bucket,
    physical = view?.currentValue ?? logical;
  text("timer-logical", formatLiveTimer(snapshot.liveSeconds));
  text("timer-physical", formatTime(physical));
  const motion = timerMotion({
    physical,
    logical,
    busy: !!view?.busy,
    activeTarget: view?.progress.target ?? null,
    anticipatedTarget: timerScheduler.presentationTarget(snapshot),
    catchingUp: timerScheduler.warning === "Late",
  });
  const settling = motion !== "idle";
  $("timer-sync").dataset.state = motion;
  text(
    "timer-motion-label",
    {
      idle: "",
      moving: "Moving",
      synchronizing: "Synchronizing",
    }[motion] +
      (timerScheduler.warning
        ? `${motion === "idle" ? "" : " · "}${timerScheduler.warning}`
        : ""),
  );
  $("timer-last-settled").hidden = motion !== "synchronizing";
  text("timer-effective", `${Math.round(effectiveMoveDuration)} ms effective`);
  $("timer-effective").hidden = motion === "idle" && !timerScheduler.warning;
  $("timer-sync").hidden = !isTimer();
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
function reconcileTimer() {
  timerScheduler.invalidate();
  viewer.setAnimationSpeed(
    BASE_MOVE_DURATION_MS / durations[Number($("rotation-speed").value)],
  );
  view.request(clock.bucket);
}
function applyDuration() {
  const seconds = parseDuration($("timer-duration").value, clock.profile);
  clock.configure(seconds);
  configuredSeconds = seconds;
  durationDirty = false;
  timerStarted = false;
  $("timer-duration").value = formatTime(seconds / clock.profile.stepSeconds);
  reconcileTimer();
}
$("timer-start").addEventListener("click", () =>
  action(() => {
    if (!ready || !isTimer()) return;
    if (clock.running) {
      clock.pause();
      reconcileTimer();
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
    if (!ready || !isTimer()) return;
    clock.reset();
    timerStarted = false;
    durationDirty = false;
    $("timer-duration").value = formatTime(
      configuredSeconds / clock.profile.stepSeconds,
    );
    reconcileTimer();
    timerUi();
    controlsUi();
  }),
);
$("timer-duration-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    if (!ready || !isTimer() || clock.running) return;
    applyDuration();
    timerUi();
    controlsUi();
  });
});
$("timer-mode").addEventListener("change", () =>
  action(() => {
    if (!ready || !isTimer()) return;
    clock.setMode($("timer-mode").value);
    timerStarted = false;
    durationDirty = false;
    $("timer-duration").value = formatTime(
      configuredSeconds / clock.profile.stepSeconds,
    );
    reconcileTimer();
    timerUi();
    controlsUi();
  }),
);
$("timer-speed").addEventListener("change", () =>
  action(() => {
    if (!ready || !isTimer()) return;
    clock.setSpeed(Number($("timer-speed").value));
    tick();
  }),
);
$("application").addEventListener("change", async () => {
  if (
    !ready ||
    view.busy ||
    run.running ||
    hsmRunning ||
    msRunning ||
    (isTimer() && clock.running && !clock.elapsed)
  ) {
    $("application").value = application;
    return;
  }
  if (
    ["live-clock", "calendar", "status-cube", "playground"].includes(
      $("application").value,
    )
  ) {
    location.assign(
      new URL(
        $("application").value === "playground"
          ? "playground.html"
          : $("application").value === "calendar"
            ? "calendar.html"
            : $("application").value === "status-cube"
              ? "status.html"
              : "clock.html",
        location.href,
      ),
    );
    return;
  }
  if (application === "certified") rememberedCounterValue = view.currentValue;
  const requested = $("application").value,
    previous = view,
    savedUi = hsmUiSnapshot();
  ready = false;
  controlsUi();
  let candidate;
  try {
    const callback = (...args) => {
      if (view === candidate) onPhysicalState(...args);
    };
    const resolveAssets = (manifest, prints, signal) =>
      loadAssets(manifest, prints, signal, import.meta.env.BASE_URL);
    if (requested === "hsm-counter" || requested === "hm-one-cube") {
      const hm = requested === "hm-one-cube";
      hsmVariantUi(hm);
      candidate = new HsmController(
        viewer,
        await hsmVariantDesign(hm),
        hsmAssets(hm),
        $("hsm-letter").value,
        callback,
        resolveAssets,
        recoveryExecutor,
      );
      // The selected range decides which saved counting period is installed.
      candidate.setMode(hsmMaximum(), Number($("hsm-direction").value));
      await candidate.configure();
    } else if (requested === "ms-counter") {
      candidate = await msController(callback);
      await candidate.configure();
    } else if (requested === "timer" || requested === "five-second-timer") {
      const profile =
        requested === "five-second-timer"
          ? FIVE_SECOND_TIMER
          : TEN_SECOND_TIMER;
      const route =
        requested === "five-second-timer"
          ? (fiveSecondRoute ??= await loadFiveSecondRoute(
              import.meta.env.BASE_URL,
            ))
          : (timerRoute ??= await loadTimerRoute(import.meta.env.BASE_URL));
      candidate = new TimerController(
        viewer,
        route,
        proof.assets,
        callback,
        resolveAssets,
      );
      await candidate.configure(profile.defaultSeconds / profile.stepSeconds);
      clock = new WorkshopClock(undefined, profile);
      timerScheduler.invalidate();
      clock.setMode("countdown");
      clock.configure(profile.defaultSeconds);
      clock.setSpeed(1);
      $("timer-mode").value = "countdown";
      $("timer-speed").value = "1";
      configuredSeconds = profile.defaultSeconds;
      durationDirty = false;
      timerStarted = false;
      $("timer-duration").value = formatTime(
        profile.defaultSeconds / profile.stepSeconds,
      );
    } else {
      candidate = new CounterController(viewer, proof, callback, resolveAssets);
      const route = routeFor(counterPrint, $("format").checked);
      await candidate.configure(
        "COUNTER",
        route.padded,
        rememberedCounterValue,
        route,
      );
    }
    timerScheduler.invalidate();
    previous.dispose();
    view = candidate;
    application = requested;
    if (!isTimer()) value = view.currentValue;
    const timerName =
      requested === "five-second-timer" ? "5-Second Timer" : "60-Minute Timer";
    text("timer-heading", timerName);
    $("timer-controls").setAttribute("aria-label", `${timerName} controls`);
    $("rotation-speed").value = isTimer()
      ? "3"
      : isHsm()
        ? String(hsmDefaultStops[$("hsm-letter").value] ?? 4)
        : isMs()
          ? String(hsmDefaultStops[$("ms-letter").value] ?? 4)
          : "4";
    speedUi();
    formatUi();
    ready = true;
    error();
    onPhysicalState(view.currentValue, view.busy, undefined, view.progress);
  } catch (e) {
    candidate?.dispose();
    ready = true;
    $("application").value = application;
    // The previous controller keeps running: restore its controls exactly.
    restoreHsmUi(savedUi);
    error(e.message);
  }
  controlsUi();
});
const hsmMarkup = {
  letter: $("hsm-letter").innerHTML,
  range: $("hsm-range").innerHTML,
  help: $("hsm-help").textContent,
};
/** Exact state of the shared H/S/M controls, to restore after a failed switch. */
function hsmUiSnapshot() {
  return {
    heading: $("hsm-heading").textContent,
    label: $("hsm-controls").getAttribute("aria-label"),
    hidden: $("hsm-lettering").hidden,
    letterOptions: $("hsm-letter").innerHTML,
    letter: $("hsm-letter").value,
    rangeOptions: $("hsm-range").innerHTML,
    range: $("hsm-range").value,
    lettering: $("hsm-lettering").value,
    help: $("hsm-help").textContent,
  };
}
function restoreHsmUi(s) {
  $("hsm-heading").textContent = s.heading;
  $("hsm-controls").setAttribute("aria-label", s.label);
  $("hsm-lettering").hidden = $("hsm-lettering-label").hidden = s.hidden;
  $("hsm-letter").innerHTML = s.letterOptions;
  $("hsm-letter").value = s.letter;
  $("hsm-range").innerHTML = s.rangeOptions;
  $("hsm-range").value = s.range;
  $("hsm-lettering").value = s.lettering;
  $("hsm-help").textContent = s.help;
  syncHsmUnitLabels();
}
const rangeLabels = { 59: "00–59", 23: "00–23", 11: "00–11" };
/** The H/M print offers M 00–59 and H 00–23 / 00–11 only. */
function hmRangeUi() {
  const ranges = HM_VARIANT.ranges[$("hsm-letter").value],
    keep = Number($("hsm-range").value);
  $("hsm-range").innerHTML = ranges
    .map((r) => `<option value="${r}">${rangeLabels[r]}</option>`)
    .join("");
  $("hsm-range").value = String(ranges.includes(keep) ? keep : ranges[0]);
}
/** Adapt the shared controls to the H/M/S (default) or the H/M variant. */
function hsmVariantUi(hm) {
  const letter = $("hsm-letter").value,
    range = $("hsm-range").value;
  $("hsm-heading").textContent = hm
    ? "H/M One-Cube Counter"
    : "H/M/S Counter";
  $("hsm-controls").setAttribute(
    "aria-label",
    hm ? "H/M one-cube counter controls" : "HSM counter controls",
  );
  $("hsm-lettering").hidden = $("hsm-lettering-label").hidden = hm;
  $("hsm-letter").innerHTML = hm
    ? HM_VARIANT.letters
        .map((l) => `<option value="${l}">${l}</option>`)
        .join("")
    : hsmMarkup.letter;
  $("hsm-letter").value = hm && !HM_VARIANT.letters.includes(letter) ? "H" : letter;
  if (hm) hmRangeUi();
  else {
    $("hsm-range").innerHTML = hsmMarkup.range;
    $("hsm-range").value = range;
  }
  $("hsm-help").textContent = hm
    ? "Counts one step per second, wrapping through 00. Upper-left stays blank. Counting steps take at most four moves (minutes at most three); a free jump (Set, Reset) takes at most seven. A new target replaces old work after the current turn. Changing the unit sets up a fresh 00 display."
    : hsmMarkup.help;
  syncHsmUnitLabels();
}
async function hsmVariantDesign(hm) {
  if (hm)
    return (hmDesign ??= await loadHmDesign(
      import.meta.env.BASE_URL,
      hmPin.runtimeSHA256,
    ));
  hsmDesign ??= await loadHsmDesign(
    import.meta.env.BASE_URL,
    hsmPin.runtimeSHA256,
  );
  return hsmDesignFor(hsmDesign, parseLettering($("hsm-lettering").value));
}
function hsmAssets(hm = isHm()) {
  return {
    ...proof.assets,
    fonts: [],
    documents: [],
    images: [
      ...proof.assets.images.filter(
        (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
      ),
      ...(hm
        ? hmImages
        : hsmImagesFor(parseLettering($("hsm-lettering").value))),
    ],
  };
}
function stopHsm() {
  hsmRunning = false;
  const active = view.stopAfterCurrent();
  value = active ?? view.currentValue;
  controlsUi();
}
$("hsm-run").addEventListener("click", () =>
  action(() => {
    if (!ready || !isHsm()) return;
    if (hsmRunning || view.busy) stopHsm();
    else {
      hsmRunning = true;
      hsmNextAt = performance.now();
      tick();
      controlsUi();
    }
  }),
);
for (const button of document.querySelectorAll("[data-hsm-delta]"))
  button.addEventListener("click", () =>
    action(() => {
      if (!ready || !isHsm()) return;
      stopHsm();
      request(hsmShift(Number(button.dataset.hsmDelta)));
    }),
  );
$("hsm-reset").addEventListener("click", () =>
  action(() => {
    if (ready && isHsm()) {
      stopHsm();
      request(0);
    }
  }),
);
$("hsm-set-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    if (!ready || !isHsm()) return;
    const raw = $("hsm-value").value.trim(),
      n = Number(raw);
    if (!/^\d{1,2}$/.test(raw) || n > hsmMaximum())
      throw Error(`Enter an integer from 00 to ${hsmMaximum()}.`);
    stopHsm();
    request(n);
  });
});
$("hsm-range").addEventListener("change", () =>
  action(() => {
    if (!ready || !isHsm() || hsmRunning || view.busy) return;
    if (value > hsmMaximum()) request(0);
  }),
);
for (const id of ["hsm-letter", "hsm-lettering"])
  $(id).addEventListener("change", async () => {
    if (!ready || !isHsm() || hsmRunning || view.busy) return;
    const previous = view,
      initial =
        id === "hsm-lettering" ? view.currentValue : 0,
      previousLettering =
        viewer.presentedPrint?.id === "hsm_counter_seconds_first_words"
          ? "words"
          : "symbols",
      // Taken after the user's choice, before the H/M range list follows it.
      savedUi = hsmUiSnapshot();
    ready = false;
    controlsUi();
    let candidate;
    try {
      if (isHm()) hmRangeUi();
      candidate = new HsmController(
        viewer,
        await hsmVariantDesign(isHm()),
        hsmAssets(),
        $("hsm-letter").value,
        (...args) => {
          if (view === candidate) onPhysicalState(...args);
        },
        (manifest, prints, signal) =>
          loadAssets(manifest, prints, signal, import.meta.env.BASE_URL),
        recoveryExecutor,
      );
      candidate.setMode(hsmMaximum(), Number($("hsm-direction").value));
      await candidate.configure(initial);
      previous.dispose();
      view = candidate;
      value = initial;
      if (id === "hsm-letter") {
        $("rotation-speed").value = String(
          hsmDefaultStops[$("hsm-letter").value] ?? 4,
        );
        speedUi();
      }
      ready = true;
      error();
      onPhysicalState(initial, false, undefined, view.progress);
    } catch (e) {
      candidate?.dispose();
      ready = true;
      restoreHsmUi({
        ...savedUi,
        letter: previous.letter,
        lettering:
          id === "hsm-lettering" ? previousLettering : savedUi.lettering,
      });
      error(e.message);
    }
    controlsUi();
  });
/** A new M/S controller for the selected unit on print S3 (not yet configured). */
async function msController(callback) {
  msDesign ??= await loadMsDesign(
    import.meta.env.BASE_URL,
    msPin.runtimeSHA256,
  );
  return new MsController(
    viewer,
    msDesign.print,
    {
      ...proof.assets,
      fonts: [],
      documents: [],
      images: [
        ...proof.assets.images.filter(
          (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
        ),
        ...hsmSymbols.filter((i) => i.id === "M" || i.id === "S"),
      ],
    },
    $("ms-letter").value,
    callback,
    (manifest, prints, signal) =>
      loadAssets(manifest, prints, signal, import.meta.env.BASE_URL),
  );
}
function stopMs() {
  msRunning = false;
  const active = view.stopAfterCurrent();
  value = active ?? view.currentValue;
  controlsUi();
}
$("ms-run").addEventListener("click", () =>
  action(() => {
    if (!ready || !isMs()) return;
    if (msRunning || view.busy) stopMs();
    else {
      msRunning = true;
      msNextAt = performance.now();
      tick();
      controlsUi();
    }
  }),
);
for (const button of document.querySelectorAll("[data-ms-delta]"))
  button.addEventListener("click", () =>
    action(() => {
      if (!ready || !isMs()) return;
      stopMs();
      request(msShift(Number(button.dataset.msDelta)));
    }),
  );
$("ms-reset").addEventListener("click", () =>
  action(() => {
    if (ready && isMs()) {
      stopMs();
      request(0);
    }
  }),
);
$("ms-set-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    if (!ready || !isMs()) return;
    const raw = $("ms-value").value.trim(),
      n = Number(raw);
    if (!/^\d{1,2}$/.test(raw) || n > 59)
      throw Error("Enter an integer from 00 to 59.");
    stopMs();
    request(n);
  });
});
$("ms-letter").addEventListener("change", async () => {
  if (!ready || !isMs() || msRunning || view.busy) return;
  const previous = view;
  ready = false;
  controlsUi();
  let candidate;
  try {
    candidate = await msController((...args) => {
      if (view === candidate) onPhysicalState(...args);
    });
    await candidate.configure(0);
    previous.dispose();
    view = candidate;
    value = 0;
    $("rotation-speed").value = String(
      hsmDefaultStops[$("ms-letter").value] ?? 4,
    );
    speedUi();
    ready = true;
    error();
    onPhysicalState(0, false, undefined, view.progress);
  } catch (e) {
    candidate?.dispose();
    ready = true;
    $("ms-letter").value = previous.letter;
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
    const requestedPrint =
      new URLSearchParams(location.search).get("print") ?? saved?.print;
    if (requestedPrint === "blank-top")
      try {
        blankTop = await loadBlankTopCounter(
          proof,
          blankTopPin.runtimeSHA256,
          import.meta.env.BASE_URL,
        );
        counterPrint = "blank-top";
      } catch (e) {
        error(`Blank-top print unavailable (${e.message}); showing the COUNTER title print.`);
      }
    $("counter-print").value = counterPrint;
    $("wrap").checked = wrapFor(counterPrint, wrapChoice);
    const route = routeFor(counterPrint, $("format").checked);
    await view.configure("COUNTER", route.padded, value, route);
    formatUi();
    padded = $("format").checked;
    ready = true;
    $("value").value = String(value);
    controlsUi();
    save();
    const requested = new URLSearchParams(location.search).get("application");
    if (
      [
        "hsm-counter",
        "hm-one-cube",
        "ms-counter",
        "timer",
        "five-second-timer",
      ].includes(requested)
    ) {
      $("application").value = requested;
      $("application").dispatchEvent(new Event("change"));
    }
  } catch (e) {
    error("Counter setup failed: " + e.message);
    $("status").textContent = "Unable to load the verified fixed print.";
  }
}
controlsUi();
void initialize();

installPrintLink(() => $("application").value === "hsm-counter" ? $("hsm-lettering").value === "words" ? "hsm-words" : "hsm-symbols" : null);
