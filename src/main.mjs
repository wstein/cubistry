import { installPrintLink } from "./apps/print/link.ts";
import { initHudIdle } from "./apps/shared/hud-idle.ts";
initHudIdle();
import { installIslandClearance } from "./apps/shared/island-clearance.ts";
installIslandClearance();
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
  resolveLetterFamily,
  hsmImagesForFamily,
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
import {
  MsTimerTenthCube,
  TENTH_WORD_IMAGE,
  DEFAULT_TENTH_STEP_INTERVAL,
  tenthAssetImages,
  tenthTurnSpeedForInterval,
} from "./apps/ms-timer/tenth.ts";
import { CounterRun } from "./apps/counter/run.mjs";
import { SequenceNumber } from "./apps/shared/sequence-number.ts";
import { loadCertifiedCounter } from "./apps/counter/certified.ts";
import {
  loadBlankTopCounter,
  modeSwitchAt,
  sharedRangeLabel,
} from "./apps/counter/blank-top.ts";
import blankTopPin from "../counter-blank-top-source.json";
import { urlAfterAppSwitch } from "./app-switch-url.mjs";
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
  hsmTargetDeadline = 0,
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
  msTargetDeadline = 0,
  msNextAt = 0;
const isMs = () => application === "ms-counter";
const msShift = (delta) => (value + delta + 60) % 60;
let tenthRunning = false,
  tenthTargetDeadline = 0,
  tenthNextAt = 0;
let pendingManifest = null;
const isTenth = () => application === "tenth-counter";
const tenthShift = (delta) => ((value + delta) % 10 + 10) % 10;
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
  if (isTimer() || isHsm() || isMs() || isTenth()) return;
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
    tenthRunning ||
    (isTimer() && clock.running && !clock.elapsed);
  $("counter-controls").hidden = isTimer() || isHsm() || isMs() || isTenth();
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
  $("tenth-controls").hidden = !isTenth();
  for (const el of $("tenth-controls").querySelectorAll("button,input,select"))
    el.disabled = !ready;
  $("tenth-run").textContent =
    tenthRunning || (isTenth() && view?.busy) ? "Stop" : "Run";
  $("tenth-run").setAttribute("aria-pressed", String(tenthRunning));
  if (isTenth()) {
    for (const btn of document.querySelectorAll("[data-tenth-target]")) {
      const active = Number(btn.dataset.tenthTarget) === value;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
  }
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
    tenthRunning ||
    (isTimer() && clock.running && !clock.elapsed);
  $("format").disabled =
    !ready ||
    isHsm() ||
    isMs() ||
    isTenth() ||
    (isBlankTop() && pendingSwitch() === null);
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
  try {
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
    tenthRunning = false;
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
  if (isTenth()) {
    if (!busy) {
      value = physical;
      if (pendingManifest) {
        const m = pendingManifest;
        pendingManifest = null;
        view.updateManifest?.(m).catch((e) => error(e.message));
      }
    }
    text(
      "status",
      failure
        ? "Turn sequence stopped."
        : `1/10s · .${physical} · ${tenthRunning ? "Running" : busy ? "Moving" : "Ready"}`,
    );
    text(
      "tenth-period",
      "Period-1 {L, D, B} closed cycle: 1 lap, 14 QTM moves, 50 ms/QTM, stationary 1/10 at r1c2",
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
  } catch (err) {
    console.error("onPhysicalState error:", err);
  }
};
try {
  viewer = new CubeViewer($("cube"));
  const tenthOptions = $("tenth-appearance-options");
  if (tenthOptions && viewer.appearanceControls?.panel) {
    for (const label of Array.from(tenthOptions.children)) {
      viewer.appearanceControls.panel.append(label);
    }
  }
} catch {
  error(
    "WebGL is unavailable. Enable hardware acceleration or try another browser.",
  );
  $("status").textContent = "3D rendering unavailable.";
}
let exitTimer = null;
function togglePresentation(enable) {
  const active = typeof enable === "boolean" ? enable : !document.body.classList.contains("presentation-mode");
  document.body.classList.toggle("presentation-mode", active);
  if (active) {
    document.body.classList.add("show-exit-btn");
    clearTimeout(exitTimer);
    exitTimer = setTimeout(() => {
      document.body.classList.remove("show-exit-btn");
    }, 2500);
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    document.body.classList.remove("show-exit-btn");
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
  viewer?.resetCamera?.();
}

window.addEventListener("mousemove", () => {
  if (document.body.classList.contains("presentation-mode")) {
    document.body.classList.add("show-exit-btn");
    clearTimeout(exitTimer);
    exitTimer = setTimeout(() => {
      document.body.classList.remove("show-exit-btn");
    }, 2500);
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("presentation-mode")) {
    togglePresentation(false);
  }
});
for (const hud of document.querySelectorAll(".floating-hud")) {
  const toggleBtn = hud.querySelector(".hud-toggle-btn");
  toggleBtn?.addEventListener("click", () => {
    hud.classList.toggle("is-minimized");
    toggleBtn.textContent = hud.classList.contains("is-minimized") ? "⚙" : "─";
  });
  const presBtn = hud.querySelector(".hud-presentation-btn");
  presBtn?.addEventListener("click", () => togglePresentation(true));
}
document.querySelector("#presentation-btn, .island-presentation-btn")?.addEventListener("click", () => togglePresentation(true));
$("exit-presentation-btn")?.addEventListener("click", () => togglePresentation(false));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("presentation-mode")) {
    togglePresentation(false);
  }
});
$("jump-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    const target = parseValue($("value").value);
    manual(target, false);
    syncSetupUrl({ val: String(target) });
  });
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
  if (isTimer() || isHsm() || isMs() || isBlankTop() || isTenth()) {
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
  syncSetupUrl({ pad: $("format").checked ? "1" : "0" });
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
    syncSetupUrl({ print: requested });
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
  if (isTenth()) {
    const interval = Number($("tenth-speed").value) || DEFAULT_TENTH_STEP_INTERVAL;
    const turnSpeed = tenthTurnSpeedForInterval(interval);
    viewer?.setAnimationSpeed(BASE_MOVE_DURATION_MS / turnSpeed);
    return;
  }
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
  syncSetupUrl({ speed: String(durations[Number($("rotation-speed").value)]) });
});
$("tenth-speed").addEventListener("change", () => {
  speedUi();
  if (tenthRunning) {
    const interval = Number($("tenth-speed").value) || DEFAULT_TENTH_STEP_INTERVAL;
    tenthTargetDeadline = Math.min(tenthTargetDeadline, performance.now() + interval);
    if (!view?.busy) tick();
  }
});
$("tenth-direction").addEventListener("change", () => {
  syncSetupUrl({ dir: $("tenth-direction").value === "-1" ? "down" : "up" });
  if (tenthRunning && !view?.busy) {
    tick();
  }
});
function getActiveManifest(
  display = $("tenth-display")?.value,
  marker = $("tenth-marker")?.value || "off",
  letterFont = $("tenth-letter-font")?.value || "same",
  currentApp = application,
) {
  const isClassicDefault = currentApp !== "tenth-counter";
  const hasExplicitFont = typeof location !== "undefined" && (new URLSearchParams(location.search).has("font") || new URLSearchParams(location.search).has("display"));
  const effectiveDisplay = (!hasExplicitFont && isClassicDefault && (!display || display === "dseg7"))
    ? "classic"
    : (display || (isClassicDefault ? "classic" : "dseg7"));
  const digitImages = tenthAssetImages(effectiveDisplay, marker, proof.assets.images);
  const family = resolveLetterFamily(letterFont, effectiveDisplay);
  const lettering = parseLettering($("hsm-lettering")?.value ?? "symbols");
  const letterImages = hsmImagesForFamily(lettering, family);

  if (currentApp === "hsm-counter" || currentApp === "ms-counter" || currentApp === "hm-one-cube" || currentApp === "tenth-counter") {
    const fontTenthWord = hsmImagesForFamily("words-pascal", family).find((i) => i.id === "T");
    const resolvedDigitImages = fontTenthWord
      ? digitImages.map((img) => (img.id === "T" ? fontTenthWord : img))
      : digitImages;
    const candidateImages = [
      ...resolvedDigitImages.filter((i) => /^[0-9]$/.test(i.id) || i.id === "blank" || i.id === "T"),
      ...(currentApp === "hm-one-cube" ? hmImages : currentApp === "tenth-counter" ? [] : letterImages),
    ];
    const seenIds = new Set();
    const uniqueImages = candidateImages.filter((img) => {
      if (seenIds.has(img.id)) return false;
      seenIds.add(img.id);
      return true;
    });
    return {
      ...proof.assets,
      fonts: [],
      documents: [],
      images: uniqueImages,
    };
  }

  // Preserve non-digit images (such as title-left and title-right for COUNTER print)
  // as well as proof.assets.fonts and proof.assets.documents.
  const nonDigitImages = proof.assets.images.filter(
    (img) => !/^[0-9]$/.test(img.id) && img.id !== "blank" && img.id !== "T",
  );

  return {
    ...proof.assets,
    images: [
      ...digitImages,
      ...nonDigitImages,
    ],
  };
}

function tenthManifest(display, marker, letterFont, currentApp = "tenth-counter") {
  return getActiveManifest(display, marker, letterFont, currentApp);
}

async function updateStyle() {
  if (!ready) return;
  const manifest = getActiveManifest();
  if (view?.busy) {
    pendingManifest = manifest;
    return;
  }
  try {
    pendingManifest = null;
    await view.updateManifest?.(manifest);
    syncSetupUrl({
      font: $("tenth-display")?.value,
      marker: $("tenth-marker")?.value,
    });
  } catch (e) {
    error(e.message);
  }
}
$("tenth-display")?.addEventListener("change", updateStyle);
$("tenth-letter-font")?.addEventListener("change", updateStyle);
$("tenth-marker")?.addEventListener("change", updateStyle);
function tick() {
  if (!ready) return;
  if (isHsm()) {
    if (hsmRunning && !view.busy) {
      const now = performance.now();
      const turnDuration = durations[Number($("rotation-speed").value)] || 100;
      if (now >= hsmTargetDeadline - turnDuration) {
        if (now > hsmTargetDeadline) {
          hsmTargetDeadline = now + 1000;
        }
        const target = hsmShift(Number($("hsm-direction").value));
        view.setDeadline?.(target, hsmTargetDeadline, turnDuration);
        hsmTargetDeadline += 1000;
        request(target);
      }
    }
    return;
  }
  if (isMs()) {
    if (msRunning && !view.busy) {
      const now = performance.now();
      const turnDuration = durations[Number($("rotation-speed").value)] || 100;
      if (now >= msTargetDeadline - turnDuration) {
        if (now > msTargetDeadline) {
          msTargetDeadline = now + 1000;
        }
        const target = msShift(Number($("ms-direction").value));
        view.setDeadline?.(target, msTargetDeadline, turnDuration);
        msTargetDeadline += 1000;
        request(target);
      }
    }
    return;
  }
  if (isTenth()) {
    if (tenthRunning && !view.busy) {
      const now = performance.now();
      const interval = Number($("tenth-speed").value) || DEFAULT_TENTH_STEP_INTERVAL;
      const turnSpeed = tenthTurnSpeedForInterval(interval);
      viewer?.setAnimationSpeed(BASE_MOVE_DURATION_MS / turnSpeed);
      if (now >= tenthTargetDeadline - turnSpeed) {
        if (now > tenthTargetDeadline) {
          tenthTargetDeadline = now + interval;
        }
        const target = tenthShift(Number($("tenth-direction").value) || 1);
        view.setDeadline?.(target, tenthTargetDeadline, turnSpeed);
        tenthTargetDeadline += interval;
        request(target);
      }
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
    syncSetupUrl({ duration: $("timer-duration").value });
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
    syncSetupUrl({ mode: $("timer-mode").value });
    reconcileTimer();
    timerUi();
    controlsUi();
  }),
);
$("timer-speed").addEventListener("change", () =>
  action(() => {
    if (!ready || !isTimer()) return;
    clock.setSpeed(Number($("timer-speed").value));
    syncSetupUrl({ rate: $("timer-speed").value });
    tick();
  }),
);
const normalizeAppKey = (req) => {
  if (!req) return "certified";
  const stripped = req.replace(/\.html$/, "");
  if (stripped === "index" || stripped === "counter") return "certified";
  if (stripped === "status") return "status-cube";
  return stripped;
};

const syncApplicationSelect = (appKey) => {
  const select = $("application");
  if (!select) return;
  const targetVal = appKey === "certified" ? "counter.html" : `${appKey}.html`;
  if ([...select.options].some((o) => o.value === targetVal)) {
    select.value = targetVal;
  } else if ([...select.options].some((o) => o.value === appKey)) {
    select.value = appKey;
  }
};

function syncSetupUrl(changes = {}) {
  if (msRunning || hsmRunning || tenthRunning || run.running || (isTimer() && clock?.running)) return;
  try {
    const nextUrl = new URL(location.href);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined) {
        nextUrl.searchParams.delete(k);
      } else {
        nextUrl.searchParams.set(k, v);
      }
    }
    history.replaceState(null, "", nextUrl);
  } catch {}
}

function applyInitialUrlParams(app) {
  const params = new URLSearchParams(location.search);

  const unitParam = params.get("unit") || params.get("letter");
  if (unitParam) {
    const u = unitParam.toUpperCase();
    if (app === "ms-counter" && (u === "M" || u === "S")) {
      $("ms-letter").value = u;
    } else if ((app === "hsm-counter" || app === "hm-one-cube") && ["H", "M", "S"].includes(u)) {
      if (app !== "hm-one-cube" || u !== "S") {
        $("hsm-letter").value = u;
      }
    }
  }

  const dirParam = params.get("dir") || params.get("direction");
  if (dirParam) {
    const d = ["down", "-1"].includes(dirParam.toLowerCase()) ? "-1" : "1";
    if ($("ms-direction")) $("ms-direction").value = d;
    if ($("hsm-direction")) $("hsm-direction").value = d;
    if ($("tenth-direction")) $("tenth-direction").value = d;
  }

  const rangeParam = params.get("range");
  if (rangeParam && $("hsm-range")) {
    if (["59", "23", "11"].includes(rangeParam)) {
      $("hsm-range").value = rangeParam;
    }
  }

  const speedParam = params.get("speed");
  if (speedParam) {
    const num = Number(speedParam);
    const speedIndex = durations.indexOf(num);
    if (speedIndex !== -1 && $("rotation-speed")) {
      $("rotation-speed").value = String(speedIndex);
      speedUi();
    }
  }

  const letteringParam = params.get("lettering");
  if (letteringParam && $("hsm-lettering")) {
    const l = parseLettering(letteringParam);
    $("hsm-lettering").value = l;
    syncHsmUnitLabels();
  }

  const fontParam = params.get("font") || params.get("display");
  if ($("tenth-display")) {
    if (fontParam) {
      const f = fontParam.toLowerCase();
      if (["dseg7", "dseg14", "noto-sans", "quicksand", "outfit", "classic"].includes(f)) {
        $("tenth-display").value = f;
      }
    } else if (app !== "tenth-counter") {
      $("tenth-display").value = "classic";
    }
  }

  const markerParam = params.get("marker");
  if (markerParam && $("tenth-marker")) {
    const m = markerParam.toLowerCase();
    if (["off", "auto", "all", "line-auto", "line-all"].includes(m)) {
      $("tenth-marker").value = m;
    }
  }

  const padParam = params.get("pad") ?? params.get("padding");
  if (padParam !== null && $("format")) {
    $("format").checked = !["0", "false", "off", "no"].includes(padParam.toLowerCase());
  }

  const timerMode = params.get("mode");
  if (timerMode && $("timer-mode")) {
    const m = timerMode.toLowerCase();
    if (["countdown", "stopwatch"].includes(m)) {
      $("timer-mode").value = m;
    }
  }

  const timerSpeed = params.get("rate") || params.get("timer-speed");
  if (timerSpeed && $("timer-speed")) {
    if (["1", "10", "20", "50", "100"].includes(timerSpeed)) {
      $("timer-speed").value = timerSpeed;
    }
  }
}

function checkAutoPresentation() {
  const sp = new URLSearchParams(location.search);
  const p = sp.get("presentation") ?? sp.get("kiosk");
  if (p === "1" || p === "true") {
    setTimeout(() => togglePresentation(true), 200);
  }
}

function checkAutoRun(app) {
  const sp = new URLSearchParams(location.search);
  const shouldRun = sp.get("run") === "1" || sp.get("run") === "true" || sp.get("autoplay") === "1";
  if (!shouldRun) return;
  setTimeout(() => {
    if (!ready) return;
    if (app === "ms-counter" && !msRunning) $("ms-run")?.click();
    else if ((app === "hsm-counter" || app === "hm-one-cube") && !hsmRunning) $("hsm-run")?.click();
    else if (app === "tenth-counter" && !tenthRunning) $("tenth-run")?.click();
    else if ((app === "timer" || app === "five-second-timer") && !clock?.running) $("timer-run")?.click();
    else if (app === "certified" && !run.running) $("run")?.click();
  }, 400);
}

async function switchApplication(requested, { initial = false } = {}) {
  const targetKey = normalizeAppKey(requested);
  const externalMap = {
    "index.html?app=clock": "index.html?app=clock",
    "playground": "playground.html",
    "calendar": "calendar.html",
    "status-cube": "status.html",
    "ms-timer": "ms-timer.html",
    "picture3": "picture3.html",
  };
  if (externalMap[targetKey]) {
    location.assign(new URL(externalMap[targetKey], location.href));
    return;
  }
  if (application && application !== targetKey) {
    try {
      history.replaceState(null, "", urlAfterAppSwitch(location.href, application, targetKey, initial));
    } catch {}
  }
  if (application === "certified" && view) rememberedCounterValue = view.currentValue;
  const previous = view,
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
    applyInitialUrlParams(targetKey);
    if (targetKey === "hsm-counter" || targetKey === "hm-one-cube") {
      const hm = targetKey === "hm-one-cube";
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
      const valParam = new URLSearchParams(location.search).get("val") ?? new URLSearchParams(location.search).get("value");
      const maxVal = hsmMaximum();
      const initial = (valParam !== null && /^\d{1,2}$/.test(valParam) && Number(valParam) <= maxVal) ? Number(valParam) : 0;
      await candidate.configure(initial);
      value = initial;
      $("hsm-value").value = String(initial).padStart(2, "0");
    } else if (targetKey === "ms-counter") {
      candidate = await msController(callback);
      const valParam = new URLSearchParams(location.search).get("val") ?? new URLSearchParams(location.search).get("value");
      const initial = (valParam !== null && /^\d{1,2}$/.test(valParam) && Number(valParam) <= 59) ? Number(valParam) : 0;
      await candidate.configure(initial);
      value = initial;
      $("ms-value").value = String(initial).padStart(2, "0");
    } else if (targetKey === "tenth-counter") {
      candidate = new MsTimerTenthCube(
        viewer,
        tenthManifest(undefined, undefined, undefined, targetKey),
        callback,
        resolveAssets,
      );
      const valParam = new URLSearchParams(location.search).get("val") ?? new URLSearchParams(location.search).get("value");
      const initial = (valParam !== null && /^\d$/.test(valParam)) ? Number(valParam) : 0;
      await candidate.configure(initial);
      value = initial;
    } else if (targetKey === "timer" || targetKey === "five-second-timer") {
      const profile =
        targetKey === "five-second-timer"
          ? FIVE_SECOND_TIMER
          : TEN_SECOND_TIMER;
      const route =
        targetKey === "five-second-timer"
          ? (fiveSecondRoute ??= await loadFiveSecondRoute(
              import.meta.env.BASE_URL,
            ))
          : (timerRoute ??= await loadTimerRoute(import.meta.env.BASE_URL));
      candidate = new TimerController(
        viewer,
        route,
        getActiveManifest(undefined, undefined, undefined, targetKey),
        callback,
        resolveAssets,
      );
      const durParam = new URLSearchParams(location.search).get("duration");
      let initSeconds = profile.defaultSeconds;
      if (durParam) {
        if (/^\d+:\d{2}$/.test(durParam)) {
          const [m, s] = durParam.split(":").map(Number);
          initSeconds = m * 60 + s;
        } else if (/^\d+$/.test(durParam)) {
          initSeconds = Number(durParam);
        }
      }
      await candidate.configure(initSeconds / profile.stepSeconds);
      clock = new WorkshopClock(undefined, profile);
      timerScheduler.invalidate();
      const initialMode = $("timer-mode").value || "countdown";
      clock.setMode(initialMode);
      clock.configure(initSeconds);
      const initialSpeed = Number($("timer-speed").value) || 1;
      clock.setSpeed(initialSpeed);
      configuredSeconds = initSeconds;
      durationDirty = false;
      timerStarted = false;
      $("timer-duration").value = formatTime(
        initSeconds / profile.stepSeconds,
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
      await candidate.updateManifest(getActiveManifest(undefined, undefined, undefined, "certified"));
    }
    timerScheduler.invalidate();
    previous?.dispose();
    view = candidate;
    application = targetKey;
    try {
      const targetFile = targetKey === "certified" ? "counter.html" : `${targetKey}.html`;
      const nextUrl = new URL(targetFile, location.href);
      if (location.search) {
        const sp = new URLSearchParams(location.search);
        if (sp.has("application")) {
          sp.set("application", targetKey);
          nextUrl.search = sp.toString();
        }
      }
      history.replaceState(null, "", nextUrl);
      localStorage.setItem("cubistry_app", targetKey);
    } catch {}
    syncApplicationSelect(application);
    if (!isTimer()) value = view.currentValue;
    const timerName =
      targetKey === "five-second-timer" ? "5-Second Timer" : "60-Minute Timer";
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
    document.dispatchEvent(new Event("change"));
    checkAutoPresentation();
    checkAutoRun(targetKey);
  } catch (e) {
    candidate?.dispose();
    ready = true;
    syncApplicationSelect(application);
    // The previous controller keeps running: restore its controls exactly.
    restoreHsmUi(savedUi);
    error(e.message);
  }
  controlsUi();
}

$("application").addEventListener("change", async () => {
  if (
    !ready ||
    view?.busy ||
    run.running ||
    hsmRunning ||
    msRunning ||
    tenthRunning ||
    (isTimer() && clock?.running && !clock?.elapsed)
  ) {
    syncApplicationSelect(application);
    return;
  }
  await switchApplication($("application").value);
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
    ? "Counts one step per second, wrapping through 00. Upper-left stays blank. Counting steps usually take at most four moves (minutes at most three), rarely five; after a jump to an arbitrary state the first steps may cost more. A free jump (Set, Reset) takes at most seven. A new target replaces old work after the current turn. Changing the unit sets up a fresh 00 display."
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
  return getActiveManifest(
    undefined,
    undefined,
    undefined,
    hm ? "hm-one-cube" : "hsm-counter",
  );
}
function stopHsm() {
  hsmRunning = false;
  view?.clearDeadline?.();
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
      hsmTargetDeadline = performance.now() + 1000;
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
      syncSetupUrl({ val: "00" });
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
    syncSetupUrl({ val: String(n).padStart(2, "0") });
  });
});
$("hsm-range").addEventListener("change", () =>
  action(() => {
    if (!ready || !isHsm() || hsmRunning || view.busy) return;
    syncSetupUrl({ range: $("hsm-range").value });
    if (value > hsmMaximum()) request(0);
  }),
);
$("hsm-direction")?.addEventListener("change", () => {
  syncSetupUrl({ dir: $("hsm-direction").value === "-1" ? "down" : "up" });
});
for (const id of ["hsm-letter", "hsm-lettering"])
  $(id).addEventListener("change", async () => {
    if (!ready || !isHsm() || hsmRunning || view.busy) return;
    syncSetupUrl({ [id === "hsm-letter" ? "unit" : "lettering"]: $(id).value });
    const previous = view,
      initial =
        id === "hsm-lettering" ? view.currentValue : 0,
      previousLettering =
        viewer.presentedPrint?.id === "hsm_counter_seconds_first_words_pascal"
          ? "words-pascal"
          : viewer.presentedPrint?.id === "hsm_counter_seconds_first_words"
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
  view?.clearDeadline?.();
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
      msTargetDeadline = performance.now() + 1000;
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
      syncSetupUrl({ val: "00" });
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
    syncSetupUrl({ val: String(n).padStart(2, "0") });
  });
});
$("ms-direction")?.addEventListener("change", () => {
  syncSetupUrl({ dir: $("ms-direction").value === "-1" ? "down" : "up" });
});
function stopTenth() {
  tenthRunning = false;
  view?.clearDeadline?.();
  const active = view.stopAfterCurrent();
  value = active ?? view.currentValue;
  controlsUi();
}
$("tenth-run").addEventListener("click", () =>
  action(() => {
    if (!ready || !isTenth()) return;
    if (tenthRunning || view.busy) stopTenth();
    else {
      tenthRunning = true;
      const interval = Number($("tenth-speed").value) || DEFAULT_TENTH_STEP_INTERVAL;
      tenthTargetDeadline = performance.now() + interval;
      tick();
      controlsUi();
    }
  }),
);
for (const button of document.querySelectorAll("[data-tenth-delta]"))
  button.addEventListener("click", () =>
    action(() => {
      if (!ready || !isTenth()) return;
      stopTenth();
      request(tenthShift(Number(button.dataset.tenthDelta)));
    }),
  );
for (const button of document.querySelectorAll("[data-tenth-target]"))
  button.addEventListener("click", () =>
    action(() => {
      if (!ready || !isTenth()) return;
      stopTenth();
      request(Number(button.dataset.tenthTarget));
      syncSetupUrl({ val: String(button.dataset.tenthTarget) });
    }),
  );
$("ms-letter").addEventListener("change", async () => {
  if (!ready || !isMs() || msRunning || view.busy) return;
  syncSetupUrl({ unit: $("ms-letter").value });
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
    const pathAppMap = {
      timer: "timer",
      "five-second-timer": "five-second-timer",
      "tenth-counter": "tenth-counter",
      "hsm-counter": "hsm-counter",
      "ms-counter": "ms-counter",
      "hm-one-cube": "hm-one-cube",
      counter: "certified",
    };
    const pathMatch = location.pathname.match(/\/([^/]+)\.html$/);
    const pathApp = pathMatch ? pathAppMap[pathMatch[1]] : undefined;
    const defaultApp = document.body.dataset.defaultApplication;
    const requested = normalizeAppKey(
      new URLSearchParams(location.search).get("application") ||
        defaultApp ||
        pathApp ||
        (location.pathname.endsWith(".html") &&
        !location.pathname.endsWith("/counter.html") &&
        !location.pathname.endsWith("/index.html")
          ? undefined
          : localStorage.getItem("cubistry_app")) ||
        "certified",
    );
    if (
      requested !== "certified" &&
      [
        "hsm-counter",
        "hm-one-cube",
        "ms-counter",
        "timer",
        "five-second-timer",
        "ms-timer",
        "tenth-counter",
      ].includes(requested)
    ) {
      syncApplicationSelect(requested);
      await switchApplication(requested, { initial: true });
      return;
    }
    view = new CounterController(
      viewer,
      proof,
      onPhysicalState,
      (manifest, prints, signal) =>
        loadAssets(manifest, prints, signal, import.meta.env.BASE_URL),
    );
    certified = await loadCertifiedCounter(proof, import.meta.env.BASE_URL);
    applyInitialUrlParams("certified");
    const valParam = new URLSearchParams(location.search).get("val") ?? new URLSearchParams(location.search).get("value");
    if (valParam !== null && /^\d{1,2}$/.test(valParam) && Number(valParam) <= 99) {
      value = Number(valParam);
    }
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
    await view.updateManifest(getActiveManifest(undefined, undefined, undefined, "certified"));
    formatUi();
    padded = $("format").checked;
    ready = true;
    $("value").value = String(value);
    controlsUi();
    save();
    checkAutoPresentation();
    checkAutoRun("certified");
  } catch (e) {
    error("Counter setup failed: " + e.message);
    $("status").textContent = "Unable to load the verified fixed print.";
  }
}
controlsUi();
void initialize();

installPrintLink(() => {
  if (application === "tenth-counter" || $("application").value?.includes("tenth-counter")) return "ms-timer-tenth";
  if (application !== "hsm-counter" && !$("application").value?.includes("hsm-counter")) return null;
  const v = $("hsm-lettering").value;
  return v === "words-pascal"
    ? "hsm-words-pascal"
    : v === "words"
      ? "hsm-words"
      : "hsm-symbols";
});
