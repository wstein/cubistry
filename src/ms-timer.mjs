import "./style.css";
import "./clock.css";
import "./ms-timer.css";
import { loadAssets } from "@cubistry/cube-assets";
import { BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { ClockStage } from "./apps/clock/stage.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { loadMsDesign } from "./apps/ms/design.ts";
import { MsTimerCube } from "./apps/ms-timer/cube.ts";
import {
  MsTimerTenthCube,
  TENTH_MOVE_MS,
  TENTH_WORD_IMAGE,
} from "./apps/ms-timer/tenth.ts";
import { MsTimer } from "./apps/ms-timer/timer.ts";
import { PairController } from "./apps/pair/controller.ts";
import { ONE_SECOND_TIMER, formatMsTimer } from "./apps/timer/clock.ts";
import { timerMotion } from "./apps/timer/status.ts";
import { installPrintLink } from "./apps/print/link.ts";
import hsmWords from "./apps/hsm/images-words-pascal.json";
import msPin from "../ms-source.json";

const $ = (id) => document.getElementById(id);
const durations = [2000, 1000, 500, 250, 100, 50, 10];
const speedLabels = [
  "2 s",
  "1 s",
  "500 ms",
  "250 ms",
  "100 ms",
  "50 ms",
  "10 ms",
];
const MAX_TENTHS = ONE_SECOND_TIMER.maxSeconds * 10;
const format = (seconds) =>
  formatMsTimer(Math.round(seconds * 10), MAX_TENTHS);
const text = (id, value) => {
  if ($(id).textContent !== value) $(id).textContent = value;
};

let stage = null,
  timer = null,
  ready = false,
  failed = false,
  durationDirty = false;
const viewers = { minor: null, major: null, tenth: null };

function fail(e) {
  failed = true;
  timer?.clock.pause();
  timer?.scheduler.invalidate();
  $("error").textContent =
    "The cubes could not complete their legal turn sequence. Reload to recover.";
  console.error(e);
  ui();
}
const action = (fn) => {
  try {
    $("error").textContent = "";
    fn();
  } catch (e) {
    $("error").textContent = e.message;
  }
  ui();
};
const preferred = () => durations[Number($("rotation-speed").value)];

function speedUi() {
  text(
    "speed-label",
    `${speedLabels[Number($("rotation-speed").value)]} preferred per HTM move`,
  );
  $("rotation-speed").setAttribute(
    "aria-valuetext",
    $("speed-label").textContent,
  );
}

function ui() {
  if (!timer) return;
  const snapshot = timer.clock.snapshot();
  const idle = !failed && ready;
  const running = timer.running;
  const physical = timer.pair.value;
  text("timer-logical", timer.text);
  $("ms-timer-display").dataset.value = timer.shown;
  $("ms-timer-display").setAttribute("aria-busy", String(timer.busy));
  for (const [unit, id] of [
    ["major", "ms-minutes"],
    ["minor", "ms-seconds"],
  ]) {
    const cube = timer.pair[unit];
    $(id).dataset.value = String(cube.currentValue);
    $(id).setAttribute("aria-busy", String(cube.busy));
    text(
      id + "-state",
      `${String(cube.currentValue).padStart(2, "0")}${cube.busy ? " · Moving" : ""}`,
    );
  }
  if (timer.tenth) {
    $("ms-tenths").dataset.value = String(timer.tenth.currentValue);
    $("ms-tenths").setAttribute("aria-busy", String(timer.tenth.busy));
    text(
      "ms-tenths-state",
      `.${timer.tenth.currentValue}${timer.tenth.busy ? " · Moving" : ""}`,
    );
  }
  const cubeTarget = (cube) =>
    cube.busy ? (cube.progress.target ?? cube.currentValue) : cube.currentValue;
  const motion = timerMotion({
    physical,
    logical: snapshot.bucket,
    busy: timer.busy,
    activeTarget:
      cubeTarget(timer.pair.major) * timer.pair.minorModulus +
      cubeTarget(timer.pair.minor),
    anticipatedTarget: timer.scheduler.presentationTarget(snapshot),
    catchingUp: timer.warning === "Late",
  });
  $("timer-sync").dataset.state = motion;
  text(
    "timer-motion-label",
    { idle: "", moving: "Moving", synchronizing: "Synchronizing" }[motion] +
      (timer.warning
        ? `${motion === "idle" ? "" : " · "}${timer.warning}`
        : ""),
  );
  text(
    "timer-effective",
    motion === "idle" && !timer.warning
      ? ""
      : `${Math.round(timer.effective.major)} ms minutes · ${Math.round(timer.effective.minor)} ms seconds · ${Math.round(timer.effective.tenth)} ms 1/10s effective`,
  );
  const elapsed = timer.clock.elapsed;
  const phase = elapsed
    ? motion !== "idle"
      ? "Elapsed · settling"
      : timer.mode === "stopwatch"
        ? "Limit reached"
        : "Complete"
    : running
      ? "Running"
      : timer.started
        ? "Paused"
        : "Ready";
  text(
    "status",
    failed
      ? "Turn sequence stopped."
      : `${timer.mode === "countdown" ? "Countdown" : "Stopwatch"} · ${phase}`,
  );
  $("timer-start").disabled = !idle || (elapsed && !durationDirty);
  $("timer-start").textContent = running
    ? "Pause"
    : timer.started && !elapsed && !durationDirty
      ? "Resume"
      : "Start";
  $("timer-start").setAttribute("aria-pressed", String(running));
  $("timer-reset").disabled = !idle;
  $("timer-mode").disabled = !idle;
  $("timer-duration").disabled = !idle || running;
  $("timer-set").disabled = !idle || running;
  $("rotation-speed").disabled = !idle;
  $("timer-duration-setting").hidden = timer.mode === "stopwatch";
  $("timer-bounds").textContent =
    timer.mode === "stopwatch"
      ? `Stopwatch · 00:00.0–${format(ONE_SECOND_TIMER.maxSeconds)} · stops at the limit`
      : `00:00.0–${format(ONE_SECOND_TIMER.maxSeconds)} · tenth-second steps`;
}

function tick() {
  if (!ready || failed) return;
  try {
    timer.tick();
  } catch (e) {
    fail(e);
    return;
  }
  ui();
}

function setDurationOf(unit) {
  return (ms) => viewers[unit]?.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms);
}

$("rotation-speed").addEventListener("input", () => {
  speedUi();
  tick();
});
$("timer-duration").addEventListener("input", () => {
  durationDirty = true;
  ui();
});
$("timer-start").addEventListener("click", () =>
  action(() => {
    if (!ready || failed) return;
    if (timer.running) timer.pause();
    else {
      if (timer.mode === "countdown" && (!timer.started || durationDirty)) {
        void timer.set($("timer-duration").value);
        durationDirty = false;
        $("timer-duration").value = format(timer.configuredSeconds);
      }
      timer.start();
    }
    tick();
  }),
);
$("timer-reset").addEventListener("click", () =>
  action(() => {
    if (!ready || failed) return;
    void timer.reset();
    durationDirty = false;
    $("timer-duration").value = format(timer.configuredSeconds);
  }),
);
$("timer-duration-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    if (!ready || failed || timer.running) return;
    void timer.set($("timer-duration").value);
    durationDirty = false;
    $("timer-duration").value = format(timer.configuredSeconds);
  });
});
$("timer-mode").addEventListener("change", () =>
  action(() => {
    if (!ready || failed) return;
    void timer.setMode($("timer-mode").value);
    durationDirty = false;
    $("timer-duration").value = format(timer.configuredSeconds);
  }),
);
$("ms-timer-application").addEventListener("change", () =>
  location.assign(new URL($("ms-timer-application").value, location.href)),
);

async function initialize() {
  const disposables = [];
  try {
    const base = import.meta.env.BASE_URL;
    const [proof, design] = await Promise.all([
      loadCounterDesign(undefined, base),
      loadMsDesign(base, msPin.runtimeSHA256),
    ]);
    const manifest = {
      ...proof.assets,
      fonts: [],
      documents: [],
      images: [
        ...proof.assets.images.filter(
          (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
        ),
        ...hsmWords.filter((i) => i.id === "M" || i.id === "S"),
        TENTH_WORD_IMAGE,
      ],
    };
    const resolveAssets = (m, prints, signal) =>
      loadAssets(m, prints, signal, base);
    stage = new ClockStage($("ms-timer-scene"), 3);
    // Minutes on the left (index 0), seconds in the middle (index 1), 1/10s on the right (index 2).
    viewers.major = stage.createCube($("ms-minutes"), 0);
    viewers.minor = stage.createCube($("ms-seconds"), 1);
    viewers.tenth = stage.createCube($("ms-tenths"), 2);
    const unit = (letter, viewer) => (onState) =>
      new MsTimerCube(
        viewer,
        design.print,
        manifest,
        letter,
        (...args) => {
          onState(...args);
          if (args[2]) fail(args[2]);
        },
        resolveAssets,
      );
    const pair = new PairController({
      minorModulus: 60,
      majorModulus: 60,
      createMinor: unit("S", viewers.minor),
      createMajor: unit("M", viewers.major),
      onState: () => ui(),
    });
    const tenth = new MsTimerTenthCube(
      viewers.tenth,
      manifest,
      (...args) => {
        ui();
        if (args[2]) fail(args[2]);
      },
      resolveAssets,
    );
    disposables.push(pair, tenth);
    timer = new MsTimer({
      pair,
      tenth,
      preferred,
      setDuration: {
        minor: setDurationOf("minor"),
        major: setDurationOf("major"),
        tenth: setDurationOf("tenth"),
      },
      refresh: tick,
    });
    await Promise.all([
      pair.configure(ONE_SECOND_TIMER.defaultSeconds),
      tenth.configure(0),
    ]);
    disposables.length = 0;
    speedUi();
    setDurationOf("minor")(preferred());
    setDurationOf("major")(preferred());
    setDurationOf("tenth")(TENTH_MOVE_MS);
    $("timer-duration").value = format(timer.configuredSeconds);
    ready = true;
    ui();
    setInterval(tick, 50);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
  } catch (e) {
    for (const d of disposables) {
      try {
        d.dispose();
      } catch {
        /* Best effort: the page is stopping. */
      }
    }
    stage?.destroy();
    failed = true;
    $("error").textContent = "M/S Timer setup failed: " + e.message;
    text("status", "Unable to load the verified fixed prints.");
  }
}
void initialize();
installPrintLink(() => "hsm-words-pascal");
export { timer as msTimer, stage as msTimerStage };
