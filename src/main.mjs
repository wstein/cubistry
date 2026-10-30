import { installPrintLink } from "./apps/print/link.ts";
import { HsmController } from "./apps/hsm/controller.ts";
import { loadHsmDesign } from "./apps/hsm/design.ts";
import hsmPin from "../hsm-source.json";
import {
  hsmImagesFor,
  hsmDesignFor,
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
import "./style.css";
import { loadAssets } from "@cubistry/cube-assets";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { CounterController } from "./apps/counter/controller.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { parseValue, shifted } from "./counter.mjs";
const $ = (id) => document.getElementById(id);
$("hsm-lettering").value = parseLettering(
  new URLSearchParams(location.search).get("lettering"),
);
const run = new CounterRun();
const sequenceNumber = new SequenceNumber();
const durations = [2000, 1000, 500, 250, 100, 50, 10];
// Default rotation stop per HSM unit (index into `durations`): H 500 ms,
// M 250 ms, S 100 ms. Changing the unit or entering the HSM counter applies it.
const hsmDefaultStops = { H: 2, M: 3, S: 4 };
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
let hsmDesign,
  hsmRunning = false,
  hsmNextAt = 0,
  rememberedCounterValue = 0;
const isHsm = () => application === "hsm-counter";
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
  if (isTimer() || isHsm()) return;
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
    hsmRunning ||
    (isTimer() && clock.running && !clock.elapsed);
  $("counter-controls").hidden = isTimer() || isHsm();
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
    (isTimer() && clock.running && !clock.elapsed);
  $("format").disabled = !ready || isHsm();

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
  if (isTimer() || isHsm()) {
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
    isHsm()
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
    if (requested === "hsm-counter") {
      hsmDesign ??= await loadHsmDesign(
        import.meta.env.BASE_URL,
        hsmPin.runtimeSHA256,
      );
      candidate = new HsmController(
        viewer,
        hsmDesignFor(hsmDesign, parseLettering($("hsm-lettering").value)),
        hsmAssets(),
        $("hsm-letter").value,
        callback,
        resolveAssets,
      );
      // The selected range decides which saved counting period is installed.
      candidate.setMode(hsmMaximum(), Number($("hsm-direction").value));
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
      await candidate.configure(
        "COUNTER",
        true,
        rememberedCounterValue,
        certified,
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
    error(e.message);
  }
  controlsUi();
});
function hsmAssets() {
  return {
    ...proof.assets,
    fonts: [],
    documents: [],
    images: [
      ...proof.assets.images.filter(
        (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
      ),
      ...hsmImagesFor(parseLettering($("hsm-lettering").value)),
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
  $(id).addEventListener("change", async (event) => {
    if (!ready || !isHsm() || hsmRunning || view.busy) return;
    const previous = view,
      initial =
        event.currentTarget.id === "hsm-lettering" ? view.currentValue : 0,
      previousLettering =
        viewer.presentedPrint?.id === "hsm_counter_seconds_first_words"
          ? "words"
          : "symbols";
    ready = false;
    controlsUi();
    let candidate;
    try {
      candidate = new HsmController(
        viewer,
        hsmDesignFor(hsmDesign, parseLettering($("hsm-lettering").value)),
        hsmAssets(),
        $("hsm-letter").value,
        (...args) => {
          if (view === candidate) onPhysicalState(...args);
        },
        (manifest, prints, signal) =>
          loadAssets(manifest, prints, signal, import.meta.env.BASE_URL),
      );
      candidate.setMode(hsmMaximum(), Number($("hsm-direction").value));
      await candidate.configure(initial);
      previous.dispose();
      view = candidate;
      value = initial;
      if (event.currentTarget.id === "hsm-letter") {
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
      $("hsm-letter").value = previous.letter;
      $("hsm-lettering").value = previousLettering;
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
    const requested = new URLSearchParams(location.search).get("application");
    if (["hsm-counter", "timer", "five-second-timer"].includes(requested)) {
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
