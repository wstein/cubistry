import "./chronocube.css";
import { ClockStage } from "./apps/clock/stage.ts";
import { LiveClockScheduler, clockText } from "./apps/clock/scheduler.ts";
import { ClockMoveStatistics, formatMean } from "./apps/clock/statistics.ts";
import { HsmController } from "./apps/hsm/controller.ts";
import { loadHsmDesign } from "./apps/hsm/design.ts";
import hsmPin from "../hsm-source.json";
import { MsController } from "./apps/ms/controller.ts";
import { loadMsDesign } from "./apps/ms/design.ts";
import msPin from "../ms-source.json";
import { HM_VARIANT, hmImages, loadHmDesign } from "./apps/hm/variant.ts";
import hmPin from "../hm-source.json";
import {
  hsmImagesForFamily,
  resolveLetterFamily,
  parseLettering,
} from "./apps/hsm/lettering.ts";
import {
  MsTimerTenthCube,
  tenthAssetImages,
  TENTH_MOVE_MS,
  DEFAULT_TENTH_STEP_INTERVAL,
  tenthTurnSpeedForInterval,
} from "./apps/ms-timer/tenth.ts";
import { PairController } from "./apps/pair/controller.ts";
import { MsTimerCube } from "./apps/ms-timer/cube.ts";
import { MsTimer } from "./apps/ms-timer/timer.ts";
import {
  WorkshopClock,
  ONE_SECOND_TIMER,
  FIVE_SECOND_TIMER,
  formatTimer,
  formatMsTimer,
  parseMsDuration,
} from "./apps/timer/clock.ts";
import { TimerController } from "./apps/timer/controller.ts";
import { loadTimerRoute, loadFiveSecondRoute } from "./apps/timer/design.ts";
import { timerMotion } from "./apps/timer/status.ts";
import { CounterController } from "./apps/counter/controller.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { loadCertifiedCounter } from "./apps/counter/certified.ts";
import { loadBlankTopCounter } from "./apps/counter/blank-top.ts";
import blankTopPin from "../counter-blank-top-source.json";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { loadAssets } from "@cubistry/cube-assets";

import { buildStudioManifest } from "./apps/chronocube/manifest.ts";

const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;

// Mode definitions and metadata
const MODES = {
  clock: {
    title: "Live H–M–S Clock",
    subtitle: "One current time. Three physical cubes (Hours · Minutes · Seconds).",
    count: 3,
    badge: "H · M · S",
  },
  "ms-timer": {
    title: "M/S Timer & Stopwatch",
    subtitle: "Minutes, seconds, and tenth-second precision timer.",
    count: 3,
    badge: "Min · Sec · 1/10s",
  },
  "hm-clock": {
    title: "H–M Wall Clock",
    subtitle: "Two physical cubes for hours and minutes.",
    count: 2,
    badge: "H · M",
  },
  tenth: {
    title: "1/10-Second Counter",
    subtitle: "Fast single-cube tenth-second counter (0–9).",
    count: 1,
    badge: "1/10 Sec (0–9)",
  },
  counter: {
    title: "Counter 0–99",
    subtitle: "Certified 2-digit twisty puzzle counter.",
    count: 1,
    badge: "0–99 Counter",
  },
  timer: {
    title: "60-Minute Workshop Timer",
    subtitle: "Physical countdown with real-time settlement.",
    count: 1,
    badge: "60-Min Timer",
  },
  "five-second-timer": {
    title: "5-Second Precision Timer",
    subtitle: "5-second countdown with verified route.",
    count: 1,
    badge: "5-Sec Timer",
  },
  "hsm-counter": {
    title: "H/M/S Counter 00–59",
    subtitle: "Single-cube 00–59 counter with H, M, S unit stickers.",
    count: 1,
    badge: "H/M/S (00–59)",
  },
  "ms-counter": {
    title: "M/S Counter 00–59",
    subtitle: "Single-cube 00–59 counter with min / sec stickers.",
    count: 1,
    badge: "M/S (00–59)",
  },
  "hm-one-cube": {
    title: "H/M One-Cube Counter",
    subtitle: "Single physical cube with hours and minutes.",
    count: 1,
    badge: "H/M One-Cube",
  },
};

// Global Appearance state (persisted across mode switches)
let currentDisplay = localStorage.getItem("cubistry_digit_font") || "noto-sans";
let currentMarker = localStorage.getItem("cubistry_marker_mode") || "line-auto";
let currentLetterFont = localStorage.getItem("cubistry_letter_font") || "same";
let currentLettering = localStorage.getItem("cubistry_lettering") || "words-pascal";

// Active runtime state
let activeMode = null;
let activeStage = null;
let activeViewer = null;
let activeCleanup = null;
let proofData = null;

// Preload counter design for shared asset manifest
async function ensureProof() {
  if (!proofData) {
    proofData = await loadCounterDesign(undefined, base);
  }
  return proofData;
}

export function buildManifest(display, marker, letterFont, lettering = "words-pascal") {
  return buildStudioManifest(
    display,
    marker,
    letterFont,
    lettering,
    proofData?.assets?.images ?? [],
    proofData?.assets?.fonts ?? [],
    proofData?.assets?.documents ?? [],
  );
}

const resolveAssets = (m, prints, signal) => loadAssets(m, prints, signal, base);

// Mount Appearance panel into host stage
function setupAppearancePanel(container, onUpdate) {
  const panel = container.querySelector(".cube-appearance");
  if (!panel) return;
  if (panel.querySelector("#studio-display-font")) return;

  const fieldset = document.createElement("div");
  fieldset.className = "studio-appearance-fields";
  fieldset.style.marginTop = "8px";
  fieldset.style.display = "flex";
  fieldset.style.flexDirection = "column";
  fieldset.style.gap = "6px";

  // 1. Digit Font
  const displayLabel = document.createElement("label");
  displayLabel.textContent = "Display font";
  const displaySelect = document.createElement("select");
  displaySelect.id = "studio-display-font";
  displaySelect.innerHTML = `
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `;
  displaySelect.value = currentDisplay;
  displayLabel.append(displaySelect);

  // 2. Letter Font
  const letterLabel = document.createElement("label");
  letterLabel.textContent = "Letter font";
  const letterSelect = document.createElement("select");
  letterSelect.id = "studio-letter-font";
  letterSelect.innerHTML = `
    <option value="same">Same as display font</option>
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `;
  letterSelect.value = currentLetterFont;
  letterLabel.append(letterSelect);

  // 3. Orientation Marker
  const markerLabel = document.createElement("label");
  markerLabel.textContent = "Orientation marker";
  const markerSelect = document.createElement("select");
  markerSelect.id = "studio-marker-mode";
  markerSelect.innerHTML = `
    <option value="off">Off (clean stickers)</option>
    <option value="line-auto">Thin underline (6 / 9 only)</option>
    <option value="line-all">Thin underline (all digits)</option>
    <option value="dot-auto">Dot: Auto (0, 2, 5, 6, 8, 9)</option>
    <option value="dot-all">Dot: All digits (0–9)</option>
  `;
  markerSelect.value = currentMarker;
  markerLabel.append(markerSelect);

  fieldset.append(displayLabel, letterLabel, markerLabel);
  panel.append(fieldset);

  let updating = false;
  const handleChange = async () => {
    if (updating) return;
    updating = true;
    try {
      currentDisplay = displaySelect.value;
      currentLetterFont = letterSelect.value;
      currentMarker = markerSelect.value;
      localStorage.setItem("cubistry_digit_font", currentDisplay);
      localStorage.setItem("cubistry_letter_font", currentLetterFont);
      localStorage.setItem("cubistry_marker_mode", currentMarker);
      const nextManifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
      await onUpdate(nextManifest);
    } catch (e) {
      console.warn("Appearance update queued or deferred:", e);
    } finally {
      updating = false;
    }
  };

  displaySelect.addEventListener("change", handleChange);
  letterSelect.addEventListener("change", handleChange);
  markerSelect.addEventListener("change", handleChange);
}

function renderStudioHud(title, bodyHtml) {
  const container = $("studio-controls");
  const wasMinimized = container.classList.contains("is-minimized");
  container.innerHTML = `
    <div class="hud-header">
      <h2 class="hud-title">${title}</h2>
      <div class="hud-actions">
        <button type="button" class="hud-btn hud-presentation-btn" title="Toggle presentation mode">⛶ Presentation</button>
        <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">${wasMinimized ? "⚙" : "─"}</button>
      </div>
    </div>
    <div class="hud-body">
      ${bodyHtml}
    </div>
  `;
  const toggleBtn = container.querySelector(".hud-toggle-btn");
  toggleBtn?.addEventListener("click", () => {
    container.classList.toggle("is-minimized");
    toggleBtn.textContent = container.classList.contains("is-minimized") ? "⚙" : "─";
  });
  const presBtn = container.querySelector(".hud-presentation-btn");
  presBtn?.addEventListener("click", () => togglePresentation(true));
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
  activeStage?.resetCamera?.();
  activeViewer?.resetCamera?.();
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
$("exit-presentation-btn")?.addEventListener("click", () => togglePresentation(false));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("presentation-mode")) {
    togglePresentation(false);
  }
});

// -------------------------------------------------------------
// Mode 1: Live H-M-S Clock (3 cubes)
// -------------------------------------------------------------
async function initClockMode() {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "3");
  cardsContainer.innerHTML = `
    <article class="clock-card">
      <h2>Hours</h2>
      <div id="clock-hours" data-unit="H" aria-busy="true"></div>
      <p id="hours-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Minutes</h2>
      <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
      <p id="minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Seconds</h2>
      <div id="clock-seconds" data-unit="S" aria-busy="true"></div>
      <p id="seconds-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `;

  renderStudioHud("Live Time", `
    <div class="clock-digital">
      <output id="clock-digital" aria-label="Current local time">--:--:--</output>
      <span id="clock-status" class="small" role="status">Preparing…</span>
    </div>
    <label for="clock-lettering">Sticker lettering</label>
    <select id="clock-lettering">
      <option value="symbols">Large H / M / S</option>
      <option value="words-pascal" selected>Small Hour / Min / Sec</option>
      <option value="words">Small hour / min / sec</option>
    </select>
    <section class="clock-stats" role="status" aria-label="Clock moves" style="margin-top: 16px;">
      <table class="clock-move-table">
        <caption>Committed moves this session</caption>
        <thead>
          <tr>
            <th scope="col">Cube</th>
            <th scope="col">Total HTM</th>
            <th scope="col">Rotations</th>
            <th scope="col">Last</th>
            <th scope="col">Max</th>
            <th scope="col">Average</th>
          </tr>
        </thead>
        <tbody>
          <tr data-unit="H">
            <th scope="row">Hours</th>
            <td id="hours-session-moves">0</td>
            <td id="hours-session-rotations">0</td>
            <td id="hours-last-moves">—</td>
            <td id="hours-max-moves">—</td>
            <td id="hours-mean-moves">—</td>
          </tr>
          <tr data-unit="M">
            <th scope="row">Minutes</th>
            <td id="minutes-session-moves">0</td>
            <td id="minutes-session-rotations">0</td>
            <td id="minutes-last-moves">—</td>
            <td id="minutes-max-moves">—</td>
            <td id="minutes-mean-moves">—</td>
          </tr>
          <tr data-unit="S">
            <th scope="row">Seconds</th>
            <td id="seconds-session-moves">0</td>
            <td id="seconds-session-rotations">0</td>
            <td id="seconds-last-moves">—</td>
            <td id="seconds-max-moves">—</td>
            <td id="seconds-mean-moves">—</td>
          </tr>
        </tbody>
      </table>
      <button id="reset-clock-moves" class="quiet clock-stats-reset" type="button" style="margin-top: 8px;">
        Reset session moves
      </button>
    </section>
  `);

  $("clock-lettering").value = currentLettering;

  const stage = new ClockStage($("studio-scene"), 3);
  activeStage = stage;

  const names = ["hours", "minutes", "seconds"];
  const initial = [new Date().getHours(), new Date().getMinutes(), new Date().getSeconds()];
  const speeds = { hours: 500, minutes: 250, seconds: 100 };

  const sourceDesign = await loadHsmDesign(base, hsmPin.runtimeSHA256);
  const statistics = new ClockMoveStatistics(names.length);
  const scheduler = new LiveClockScheduler();
  let shownStatistics = -1;
  function statisticsUi() {
    const snapshot = statistics.snapshot();
    if (snapshot.revision === shownStatistics) return;
    shownStatistics = snapshot.revision;
    const show = (id, v, fmt = (x) => String(x)) => {
      const el = $(id);
      if (el) el.textContent = v === null ? "—" : fmt(v);
    };
    snapshot.units.forEach((unit, i) => {
      const name = names[i];
      show(name + "-session-moves", unit.session.htm);
      show(name + "-session-rotations", unit.session.rotations);
      show(name + "-last-moves", unit.last);
      show(name + "-max-moves", unit.max);
      show(name + "-mean-moves", unit.mean, formatMean);
    });
  }

  const controllers = [];
  const units = [];

  for (let i = 0; i < 3; i++) {
    const viewer = stage.createCube($("clock-" + names[i]), i);
    const duration = speeds[names[i]];
    const setDuration = (ms) => viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
    setDuration(duration);

    const manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
    const controller = new HsmController(viewer, sourceDesign, {
      printDefinition: sourceDesign.printDefinition,
      name: names[i],
      assets: manifest,
      onMoveCommitted: (m) => statistics.recordMove(i, m),
      onRotationCommitted: (r) => statistics.recordRotation(i, r),
    });
    await controller.configure(initial[i]);
    controllers.push(controller);
    units.push({ controller, duration, setDuration });
  }

  setupAppearancePanel(stage.appearancePanel, async (nextManifest) => {
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  });

  $("clock-lettering").addEventListener("change", async () => {
    currentLettering = $("clock-lettering").value;
    localStorage.setItem("cubistry_lettering", currentLettering);
    const nextManifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  });

  $("reset-clock-moves")?.addEventListener("click", () => {
    statistics.reset();
    statisticsUi();
  });

  function draw() {
    try {
      const epoch = Date.now(),
        mono = performance.now(),
        snapshot = scheduler.tick(epoch, mono, units);
      statistics.closeTick();
      statisticsUi();
      const digital = $("clock-digital");
      if (digital) digital.textContent = clockText(snapshot.values);
      const status = $("clock-status");
      if (status) {
        status.textContent = snapshot.motion.includes("synchronizing")
          ? "Synchronizing to current time"
          : "Live · local time";
      }
      units.forEach((u, i) => {
        const node = $(names[i] + "-state");
        if (node) {
          const state = snapshot.motion[i];
          node.dataset.state = state;
          node.textContent = `${String(u.controller.currentValue).padStart(2, "0")}${state === "idle" ? "" : state === "moving" ? " · Moving" : " · Synchronizing"}`;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  const intervalId = setInterval(draw, 100);
  draw();

  return () => {
    clearInterval(intervalId);
    stage.destroy();
  };
}

// -------------------------------------------------------------
// Mode 2: M/S Timer & Stopwatch (3 cubes)
// -------------------------------------------------------------
async function initMsTimerMode() {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "3");
  cardsContainer.innerHTML = `
    <article class="clock-card">
      <h2>Minutes (min)</h2>
      <div id="ms-minutes" data-unit="M" aria-busy="true"></div>
      <p id="ms-minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Seconds (sec)</h2>
      <div id="ms-seconds" data-unit="S" aria-busy="true"></div>
      <p id="ms-seconds-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>1/10 Second (1/10)</h2>
      <div id="ms-tenths" data-unit="T" aria-busy="true"></div>
      <p id="ms-tenths-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `;

  renderStudioHud("M/S Timer", `
    <div class="timer-controls">
      <label for="timer-mode">Mode</label>
      <select id="timer-mode">
        <option value="countdown">Countdown</option>
        <option value="stopwatch">Stopwatch</option>
      </select>
      <form id="timer-duration-form">
        <div id="timer-duration-setting">
          <label for="timer-duration">Duration MM:SS.d</label>
          <div class="duration-actions" style="display: flex; gap: 8px;">
            <input id="timer-duration" type="text" value="15:00.0" autocomplete="off" style="flex: 1;" />
            <button id="timer-set" type="submit">Set</button>
          </div>
        </div>
      </form>
      <p id="timer-bounds" class="small">00:00.0–59:59.0 · tenth-second steps</p>
      <output id="timer-logical" class="studio-digital-huge">15:00.0</output>
      <div class="timer-actions" style="display: flex; gap: 8px;">
        <button id="timer-start" class="primary" type="button">Start</button>
        <button id="timer-reset" type="button">Reset</button>
      </div>
      <p id="timer-sync" class="small timer-motion" role="status" style="margin-top: 12px;">
        <span id="timer-motion-label">Idle</span><br />
        <span id="timer-effective" class="small"></span>
      </p>
    </div>
  `);

  const stage = new ClockStage($("studio-scene"), 3);
  activeStage = stage;

  const design = await loadMsDesign(base, msPin.runtimeSHA256);
  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, "words-pascal");

  const viewers = {
    major: stage.createCube($("ms-minutes"), 0),
    minor: stage.createCube($("ms-seconds"), 1),
    tenth: stage.createCube($("ms-tenths"), 2),
  };

  const setDurationOf = (unit) => (ms) => viewers[unit]?.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms);

  let majorUnit = null, minorUnit = null;
  const unit = (letter, v) => (onState) => {
    const cube = new MsTimerCube(v, design.print, manifest, letter, onState, resolveAssets);
    if (letter === "M") majorUnit = cube;
    if (letter === "S") minorUnit = cube;
    return cube;
  };

  const pair = new PairController({
    minorModulus: 60,
    majorModulus: 60,
    createMinor: unit("S", viewers.minor),
    createMajor: unit("M", viewers.major),
    onState: () => ui(),
  });

  const tenth = new MsTimerTenthCube(viewers.tenth, manifest, () => ui(), resolveAssets);

  const timer = new MsTimer({
    pair,
    tenth,
    preferred: () => 100,
    setDuration: {
      minor: setDurationOf("minor"),
      major: setDurationOf("major"),
      tenth: setDurationOf("tenth"),
    },
    refresh: () => tick(),
  });

  setupAppearancePanel(stage.appearancePanel, async (nextManifest) => {
    await Promise.all([
      majorUnit?.updateManifest(nextManifest),
      minorUnit?.updateManifest(nextManifest),
      tenth?.updateManifest(nextManifest),
    ]);
  });

  function tick() {
    timer.tick();
    ui();
  }

  function ui() {
    if (!timer) return;
    const idle = !timer.running && !timer.busy;
    $("timer-logical").textContent = timer.text;
    $("ms-minutes-state").textContent = `${String(pair.major.currentValue).padStart(2, "0")}${pair.major.busy ? " · Moving" : ""}`;
    $("ms-seconds-state").textContent = `${String(pair.minor.currentValue).padStart(2, "0")}${pair.minor.busy ? " · Moving" : ""}`;
    $("ms-tenths-state").textContent = `.${tenth.currentValue}${tenth.busy ? " · Moving" : ""}`;

    $("timer-start").textContent = timer.running ? "Pause" : "Start";
    $("timer-mode").disabled = !idle;
    $("timer-duration").disabled = timer.running;
    $("timer-set").disabled = timer.running;
    $("timer-reset").disabled = timer.running;

    $("timer-duration-setting").hidden = timer.mode === "stopwatch";
    const motionLabel = timer.busy ? "Moving / Synchronizing" : timer.running ? "Running" : "Idle";
    $("timer-motion-label").textContent = motionLabel;
  }

  $("timer-start").addEventListener("click", () => {
    if (timer.running) timer.pause();
    else timer.start();
    ui();
  });

  $("timer-reset").addEventListener("click", () => {
    timer.reset();
    ui();
  });

  $("timer-mode").addEventListener("change", () => {
    timer.setMode($("timer-mode").value);
    ui();
  });

  $("timer-duration-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const parsed = parseMsDuration($("timer-duration").value);
    if (parsed !== null) {
      timer.configure(parsed);
      ui();
    }
  });

  await Promise.all([pair.configure(ONE_SECOND_TIMER.defaultSeconds), tenth.configure(0)]);
  setDurationOf("minor")(100);
  setDurationOf("major")(250);
  setDurationOf("tenth")(50);
  ui();

  const intervalId = setInterval(tick, 50);

  return () => {
    clearInterval(intervalId);
    stage.destroy();
  };
}

// -------------------------------------------------------------
// Mode 3: H-M Wall Clock (2 cubes)
// -------------------------------------------------------------
async function initHmClockMode() {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "2");
  cardsContainer.innerHTML = `
    <article class="clock-card">
      <h2>Hours</h2>
      <div id="clock-hours" data-unit="H" aria-busy="true"></div>
      <p id="hours-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Minutes</h2>
      <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
      <p id="minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `;

  renderStudioHud("Live Wall Time", `
    <div class="clock-digital">
      <output id="clock-digital" class="studio-digital-huge" aria-label="Current local time">--:--</output>
      <span id="clock-status" class="small" role="status">Synchronizing…</span>
    </div>
    <label for="clock-lettering">Sticker lettering</label>
    <select id="clock-lettering">
      <option value="symbols">Large H / M</option>
      <option value="words-pascal" selected>Small Hour / Min</option>
      <option value="words">Small hour / min</option>
    </select>
  `);

  $("clock-lettering").value = currentLettering;

  const stage = new ClockStage($("studio-scene"), 2);
  activeStage = stage;

  const names = ["hours", "minutes"];
  const initial = [new Date().getHours(), new Date().getMinutes()];
  const speeds = { hours: 500, minutes: 250 };

  const sourceDesign = await loadHsmDesign(base, hsmPin.runtimeSHA256);
  const scheduler = new LiveClockScheduler();

  const controllers = [];
  const units = [];

  for (let i = 0; i < 2; i++) {
    const viewer = stage.createCube($("clock-" + names[i]), i);
    const duration = speeds[names[i]];
    const setDuration = (ms) => viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
    setDuration(duration);

    const manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
    const controller = new HsmController(viewer, sourceDesign, {
      printDefinition: sourceDesign.printDefinition,
      name: names[i],
      assets: manifest,
    });
    await controller.configure(initial[i]);
    controllers.push(controller);
    units.push({ controller, duration, setDuration });
  }

  setupAppearancePanel(stage.appearancePanel, async (nextManifest) => {
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  });

  $("clock-lettering").addEventListener("change", async () => {
    currentLettering = $("clock-lettering").value;
    localStorage.setItem("cubistry_lettering", currentLettering);
    const nextManifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  });

  function draw() {
    try {
      const epoch = Date.now(),
        mono = performance.now(),
        snapshot = scheduler.tick(epoch, mono, units);
      const digital = $("clock-digital");
      if (digital) {
        digital.textContent = `${String(snapshot.values[0]).padStart(2, "0")}:${String(snapshot.values[1]).padStart(2, "0")}`;
      }
      units.forEach((u, i) => {
        const node = $(names[i] + "-state");
        if (node) {
          const state = snapshot.motion[i];
          node.dataset.state = state;
          node.textContent = `${String(u.controller.currentValue).padStart(2, "0")}${state === "idle" ? "" : " · Moving"}`;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  const intervalId = setInterval(draw, 100);
  draw();

  return () => {
    clearInterval(intervalId);
    stage.destroy();
  };
}

// -------------------------------------------------------------
// Mode 4: 1/10-Second Precision Counter (1 cube)
// -------------------------------------------------------------
async function initTenthMode() {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <h2>Tenth-Second Display</h2>
      <output id="tenth-value-display" class="studio-digital-huge" style="display: block;">.0</output>
      <p id="tenth-state" class="clock-state" role="status">Ready</p>
    </article>
  `;

  renderStudioHud("1/10-Second Counter", `
    <p class="small">Period-1 {L, D, B} sequence with fast responsive stepping.</p>
    <div class="tenth-quick-grid">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((n) => `<button class="tenth-quick-btn" data-val="${n}">${n}</button>`)
        .join("")}
    </div>
    <div class="tenth-step-actions">
      <button id="tenth-step-minus5">-5 Steps</button>
      <button id="tenth-step-plus5">+5 Steps</button>
    </div>
    <div class="tenth-toggle-row">
      <label for="tenth-speed-select">Step speed</label>
      <select id="tenth-speed-select">
        <option value="50">50 ms (Fast)</option>
        <option value="100" selected>100 ms (Default)</option>
        <option value="250">250 ms</option>
        <option value="500">500 ms</option>
      </select>
    </div>
    <div class="tenth-toggle-row" style="margin-top: 8px;">
      <label for="tenth-direction-toggle">Direction</label>
      <select id="tenth-direction-toggle">
        <option value="1" selected>Forward (+1)</option>
        <option value="-1">Reverse (-1)</option>
      </select>
    </div>
  `);

  const viewer = new CubeViewer($("studio-scene"));
  activeViewer = viewer;

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, "words-pascal");
  let stepInterval = 100;
  let direction = 1;

  function updateViewerSpeed(intervalMs) {
    const turnDuration = tenthTurnSpeedForInterval(intervalMs);
    viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / turnDuration);
  }
  updateViewerSpeed(stepInterval);

  const tenth = new MsTimerTenthCube(
    viewer,
    manifest,
    (v, progress, err) => {
      $("tenth-value-display").textContent = `.${v}`;
      $("tenth-state").textContent = progress ? "Moving…" : "Ready";
      if (err) console.error(err);
    },
    resolveAssets,
  );

  setupAppearancePanel($("studio-scene"), async (nextManifest) => {
    await tenth.updateManifest(nextManifest);
  });

  await tenth.configure(0);

  controlsContainer.querySelectorAll(".tenth-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tenth.stepTo(Number(btn.dataset.val), direction);
    });
  });

  $("tenth-step-plus5").addEventListener("click", () => {
    tenth.stepBy(5 * direction);
  });
  $("tenth-step-minus5").addEventListener("click", () => {
    tenth.stepBy(-5 * direction);
  });

  $("tenth-speed-select").addEventListener("change", (e) => {
    stepInterval = Number(e.target.value);
    updateViewerSpeed(stepInterval);
  });

  $("tenth-direction-toggle").addEventListener("change", (e) => {
    direction = Number(e.target.value);
  });

  return () => {
    viewer.destroy();
  };
}

// -------------------------------------------------------------
// Mode 5: Certified Counter 0–99 (1 cube)
// -------------------------------------------------------------
async function initCounterMode() {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <h2>Counter Value</h2>
      <output id="counter-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="counter-state" class="clock-state" role="status">Ready</p>
    </article>
  `;

  renderStudioHud("Counter Controls", `
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="counter-minus-10" style="flex: 1;">-10</button>
      <button id="counter-minus-1" style="flex: 1;">-1</button>
      <button id="counter-plus-1" style="flex: 1;">+1</button>
      <button id="counter-plus-10" style="flex: 1;">+10</button>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="counter-reset" style="flex: 1;">Reset (0)</button>
    </div>
    <div style="margin-top: 16px;">
      <label>
        <input type="checkbox" id="counter-auto-step" />
        Auto step (+1 every second)
      </label>
    </div>
  `);

  const viewer = new CubeViewer($("studio-scene"));
  activeViewer = viewer;
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const [counterDesign, certified] = await Promise.all([
    loadCounterDesign(undefined, base),
    loadCertifiedCounter(base),
  ]);

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont);

  const controller = new CounterController(viewer, counterDesign, {
    certified,
    assets: manifest,
    onState: (v, busy) => {
      $("counter-value-display").textContent = String(v).padStart(2, "0");
      $("counter-state").textContent = busy ? "Turning…" : "Ready";
    },
  });

  setupAppearancePanel($("studio-scene"), async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  });

  await controller.configure(0);

  const step = (delta) => {
    const cur = controller.currentValue;
    const target = (cur + delta + 100) % 100;
    controller.request(target);
  };

  $("counter-plus-1").addEventListener("click", () => step(1));
  $("counter-minus-1").addEventListener("click", () => step(-1));
  $("counter-plus-10").addEventListener("click", () => step(10));
  $("counter-minus-10").addEventListener("click", () => step(-10));
  $("counter-reset").addEventListener("click", () => controller.request(0));

  let autoTimer = null;
  $("counter-auto-step").addEventListener("change", (e) => {
    if (e.target.checked) {
      autoTimer = setInterval(() => step(1), 1000);
    } else {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  });

  return () => {
    if (autoTimer) clearInterval(autoTimer);
    viewer.destroy();
  };
}

// -------------------------------------------------------------
// Mode 6: 60-Minute Workshop Timer / 5-Second Timer (1 cube)
// -------------------------------------------------------------
async function initTimerMode(fiveSecond = false) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <h2>${fiveSecond ? "5-Second Countdown" : "60-Minute Countdown"}</h2>
      <output id="timer-display" class="studio-digital-huge" style="display: block;">
        ${fiveSecond ? "00:05.0" : "15:00"}
      </output>
      <p id="timer-state" class="clock-state" role="status">Ready</p>
    </article>
  `;

  renderStudioHud(fiveSecond ? "5-Second Timer" : "Workshop Timer", `
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="timer-toggle-btn" class="primary" style="flex: 1;">Start</button>
      <button id="timer-reset-btn" style="flex: 1;">Reset</button>
    </div>
    <p id="timer-status-info" class="small">Idle · Tap Start to countdown</p>
  `);

  const viewer = new CubeViewer($("studio-scene"));
  activeViewer = viewer;
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const route = fiveSecond ? await loadFiveSecondRoute(base) : await loadTimerRoute(base);
  const spec = fiveSecond ? FIVE_SECOND_TIMER : ONE_SECOND_TIMER;
  const clock = new WorkshopClock(undefined, spec);

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont);
  const controller = new TimerController(viewer, route, {
    assets: manifest,
    onState: (v, busy) => {
      $("timer-state").textContent = busy ? "Moving…" : "Ready";
    },
  });

  setupAppearancePanel($("studio-scene"), async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  });

  const defaultSec = fiveSecond ? 5 : 900;
  await controller.configure(defaultSec);

  function update() {
    const snap = clock.snapshot();
    $("timer-display").textContent = formatTimer(snap.bucket, spec.maxSeconds);
    $("timer-toggle-btn").textContent = clock.running ? "Pause" : "Start";
    $("timer-status-info").textContent = clock.running ? "Counting down…" : "Paused";
  }

  $("timer-toggle-btn").addEventListener("click", () => {
    if (clock.running) clock.pause();
    else clock.start();
    update();
  });

  $("timer-reset-btn").addEventListener("click", () => {
    clock.reset();
    controller.request(defaultSec);
    update();
  });

  update();
  const intervalId = setInterval(update, 100);

  return () => {
    clearInterval(intervalId);
    viewer.destroy();
  };
}

// -------------------------------------------------------------
// Mode 7: Single-Cube HSM / MS / HM Counter (1 cube)
// -------------------------------------------------------------
async function initHsmSingleMode(variant = "hsm") {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <h2 id="single-hsm-title">Counter 00–59</h2>
      <output id="hsm-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="hsm-state" class="clock-state" role="status">Ready</p>
    </article>
  `;

  renderStudioHud("Counter Controls", `
    <div style="margin-bottom: 12px;">
      <label for="single-unit-select">Unit sticker</label>
      <select id="single-unit-select">
        ${variant === "hsm" ? `
          <option value="H">Hour (H)</option>
          <option value="M" selected>Minute (M)</option>
          <option value="S">Second (S)</option>
        ` : variant === "ms" ? `
          <option value="M" selected>Minute (min)</option>
          <option value="S">Second (sec)</option>
        ` : `
          <option value="H">Hour (H)</option>
          <option value="M" selected>Minute (M)</option>
        `}
      </select>
    </div>
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="hsm-minus-10" style="flex: 1;">-10</button>
      <button id="hsm-minus-1" style="flex: 1;">-1</button>
      <button id="hsm-plus-1" style="flex: 1;">+1</button>
      <button id="hsm-plus-10" style="flex: 1;">+10</button>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="hsm-reset" style="flex: 1;">Reset (00)</button>
    </div>
  `);

  const viewer = new CubeViewer($("studio-scene"));
  activeViewer = viewer;
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const design = variant === "ms"
    ? await loadMsDesign(base, msPin.runtimeSHA256)
    : variant === "hm"
      ? await loadHmDesign(base, hmPin.runtimeSHA256)
      : await loadHsmDesign(base, hsmPin.runtimeSHA256);

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);

  const controller = new HsmController(viewer, design, {
    printDefinition: design.printDefinition,
    name: "unit",
    assets: manifest,
    onState: (v, busy) => {
      $("hsm-value-display").textContent = String(v).padStart(2, "0");
      $("hsm-state").textContent = busy ? "Turning…" : "Ready";
    },
  });

  setupAppearancePanel($("studio-scene"), async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  });

  await controller.configure(0);

  const step = (delta) => {
    const cur = controller.currentValue;
    const target = (cur + delta + 60) % 60;
    controller.request(target);
  };

  $("hsm-plus-1").addEventListener("click", () => step(1));
  $("hsm-minus-1").addEventListener("click", () => step(-1));
  $("hsm-plus-10").addEventListener("click", () => step(10));
  $("hsm-minus-10").addEventListener("click", () => step(-10));
  $("hsm-reset").addEventListener("click", () => controller.request(0));

  return () => {
    viewer.destroy();
  };
}

// -------------------------------------------------------------
// Orchestrator: Switch active mode
// -------------------------------------------------------------
async function switchMode(newMode, pushHistory = true) {
  if (!MODES[newMode]) newMode = "clock";
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch (e) {
      console.warn("Cleanup error:", e);
    }
    activeCleanup = null;
  }

  // Clear scene and cards
  $("studio-scene").innerHTML = "";
  $("studio-cards").innerHTML = "";
  $("studio-controls").innerHTML = "";
  $("studio-error").textContent = "";

  activeMode = newMode;
  const meta = MODES[newMode];

  // Update header text
  $("studio-heading").textContent = meta.title;
  $("studio-subtitle").textContent = meta.subtitle;
  $("studio-cube-count-badge").textContent = `${meta.count} CUBE${meta.count > 1 ? "S" : ""}`;
  $("studio-mode-label").textContent = meta.badge;

  // Sync dropdown
  $("studio-application").value = newMode;

  if (pushHistory) {
    const url = new URL(location.href);
    url.searchParams.set("mode", newMode);
    history.replaceState(null, "", url);
    localStorage.setItem("cubistry_chronocube_mode", newMode);
  }

  try {
    if (newMode === "clock") activeCleanup = await initClockMode();
    else if (newMode === "ms-timer") activeCleanup = await initMsTimerMode();
    else if (newMode === "hm-clock") activeCleanup = await initHmClockMode();
    else if (newMode === "tenth") activeCleanup = await initTenthMode();
    else if (newMode === "counter") activeCleanup = await initCounterMode();
    else if (newMode === "timer") activeCleanup = await initTimerMode(false);
    else if (newMode === "five-second-timer") activeCleanup = await initTimerMode(true);
    else if (newMode === "hsm-counter") activeCleanup = await initHsmSingleMode("hsm");
    else if (newMode === "ms-counter") activeCleanup = await initHsmSingleMode("ms");
    else if (newMode === "hm-one-cube") activeCleanup = await initHsmSingleMode("hm");
  } catch (err) {
    console.error("Failed to initialize mode:", err);
    $("studio-error").textContent = `Failed to load mode ${newMode}: ${err.message}`;
  }
}

// Initialize on DOM ready
async function initStudio() {
  await ensureProof();

  const urlParams = new URLSearchParams(location.search);
  const initialMode =
    urlParams.get("mode") ||
    localStorage.getItem("cubistry_chronocube_mode") ||
    "clock";

  $("studio-application").addEventListener("change", (e) => {
    const val = e.target.value;
    if (MODES[val]) {
      switchMode(val, true);
    } else {
      location.assign(val);
    }
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    const m = params.get("mode") || "clock";
    switchMode(m, false);
  });

  await switchMode(initialMode, false);
}

initStudio();
