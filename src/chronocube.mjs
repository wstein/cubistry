import "./chronocube.css";
import { ClockStage } from "./apps/clock/stage.ts";
import { LiveClockScheduler, clockText } from "./apps/clock/scheduler.ts";
import { ClockMoveStatistics, formatMean } from "./apps/clock/statistics.ts";
import { createStudioHsmController, createStudioSingleController } from "./apps/chronocube/hsm-mode.ts";
import { createStudioCounter } from "./apps/chronocube/counter-mode.ts";
import { loadHsmDesign } from "./apps/hsm/design.ts";
import hsmPin from "../hsm-source.json";
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
import { whenCurrent } from "./apps/chronocube/mode-switch.ts";
import { MODE_CATALOG } from "./apps/mode-catalog.ts";
import { createRegistry } from "./apps/registry.ts";
import { createRouter } from "./apps/router.ts";
import { PairController } from "./apps/pair/controller.ts";
import { MsTimerCube } from "./apps/ms-timer/cube.ts";
import { MsTimer } from "./apps/ms-timer/timer.ts";
import { applyDuration } from "./apps/chronocube/duration-form.ts";
import {
  WorkshopClock,
  ONE_SECOND_TIMER,
  formatMsTimer,
} from "./apps/timer/clock.ts";
import {
  StudioTimerDriver,
  createStudioTimerController,
  studioTimerDefaultBucket,
  studioTimerProfile,
  studioTimerReadout,
} from "./apps/chronocube/timer-mode.ts";
import { loadTimerRoute, loadFiveSecondRoute } from "./apps/timer/design.ts";
import { timerMotion } from "./apps/timer/status.ts";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { loadBlankTopCounter } from "./apps/counter/blank-top.ts";
import blankTopPin from "../counter-blank-top-source.json";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { loadAssets } from "@cubistry/cube-assets";

import { buildStudioManifest } from "./apps/chronocube/manifest.ts";

const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;

// Global Appearance state (persisted across mode switches)
let currentDisplay = localStorage.getItem("cubistry_digit_font") || "noto-sans";
let currentMarker = localStorage.getItem("cubistry_marker_mode") || "line-auto";
let currentLetterFont = localStorage.getItem("cubistry_letter_font") || "same";
let currentLettering = localStorage.getItem("cubistry_lettering") || "words-pascal";

// Active runtime state
let activeStage = null;
let activeViewer = null;
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
    proofData?.assets?.materials ?? [],
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
}

document.querySelector("#presentation-btn, .island-presentation-btn")?.addEventListener("click", () => togglePresentation(true));

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
async function initClockMode(isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "3");
  cardsContainer.innerHTML = `
    <div id="clock-hours" data-unit="H" aria-busy="true"></div>
    <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
    <div id="clock-seconds" data-unit="S" aria-busy="true"></div>
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
  const abandon = () => (stage.destroy(), null);

  const names = ["hours", "minutes", "seconds"];
  const initial = [new Date().getHours(), new Date().getMinutes(), new Date().getSeconds()];
  const speeds = { hours: 500, minutes: 250, seconds: 100 };

  const sourceDesign = await loadHsmDesign(base, hsmPin.runtimeSHA256);
  if (!isCurrent()) return abandon();
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
    const controller = createStudioHsmController(
      viewer,
      sourceDesign,
      manifest,
      ["H", "M", "S"][i],
      (value, busy, error, progress) => {
        if (!isCurrent()) return;
        if (progress) statistics.observe(i, progress);
        if (error) $("studio-error").textContent = error.message;
      },
      resolveAssets,
      i === 0 ? 23 : 59,
    );
    await controller.configure(initial[i]);
    if (!isCurrent()) return abandon();
    controllers.push(controller);
    units.push({ controller, duration, setDuration });
  }

  setupAppearancePanel(stage.appearancePanel, whenCurrent(isCurrent, async (nextManifest) => {
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  }));

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
async function initMsTimerMode(isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "3");
  cardsContainer.innerHTML = `
    <div id="ms-minutes" data-unit="M"></div>
    <div id="ms-seconds" data-unit="S"></div>
    <div id="ms-tenths" data-unit="T"></div>
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
    </div>
  `);

  const stage = new ClockStage($("studio-scene"), 3);
  activeStage = stage;
  const abandon = () => (stage.destroy(), null);

  const design = await loadMsDesign(base, msPin.runtimeSHA256);
  if (!isCurrent()) return abandon();
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

  setupAppearancePanel(stage.appearancePanel, whenCurrent(isCurrent, async (nextManifest) => {
    await Promise.all([
      majorUnit?.updateManifest(nextManifest),
      minorUnit?.updateManifest(nextManifest),
      tenth?.updateManifest(nextManifest),
    ]);
  }));

  function tick() {
    timer.tick();
    ui();
  }

  function ui() {
    if (!timer || !isCurrent()) return;
    const idle = !timer.running && !timer.busy;
    $("timer-logical").textContent = timer.text;

    $("timer-start").textContent = timer.running ? "Pause" : "Start";
    $("timer-mode").disabled = !idle;
    $("timer-duration").disabled = timer.running;
    $("timer-set").disabled = timer.running;
    $("timer-reset").disabled = timer.running;

    $("timer-duration-setting").hidden = timer.mode === "stopwatch";
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
    $("studio-error").textContent = "";
    applyDuration(
      timer,
      $("timer-duration").value,
      ui,
      (message) => {
        $("studio-error").textContent = message;
      },
    );
  });

  await Promise.all([pair.configure(ONE_SECOND_TIMER.defaultSeconds), tenth.configure(0)]);
  if (!isCurrent()) return abandon();
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
async function initHmClockMode(isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "2");
  cardsContainer.innerHTML = `
    <div id="clock-hours" data-unit="H"></div>
    <div id="clock-minutes" data-unit="M"></div>
  `;

  renderStudioHud("Live Wall Time", `
    <div class="clock-digital">
      <output id="clock-digital" class="studio-digital-huge" aria-label="Current local time">--:--</output>
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
  const abandon = () => (stage.destroy(), null);

  const names = ["hours", "minutes"];
  const initial = [new Date().getHours(), new Date().getMinutes()];
  const speeds = { hours: 500, minutes: 250 };

  const sourceDesign = await loadHsmDesign(base, hsmPin.runtimeSHA256);
  if (!isCurrent()) return abandon();
  const scheduler = new LiveClockScheduler();

  const controllers = [];
  const units = [];

  for (let i = 0; i < 2; i++) {
    const viewer = stage.createCube($("clock-" + names[i]), i);
    const duration = speeds[names[i]];
    const setDuration = (ms) => viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
    setDuration(duration);

    const manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);
    const controller = createStudioHsmController(
      viewer,
      sourceDesign,
      manifest,
      ["H", "M"][i],
      (value, busy, error) => {
        if (!isCurrent()) return;
        if (error) $("studio-error").textContent = error.message;
      },
      resolveAssets,
      i === 0 ? 23 : 59,
    );
    await controller.configure(initial[i]);
    if (!isCurrent()) return abandon();
    controllers.push(controller);
    units.push({ controller, duration, setDuration });
  }

  setupAppearancePanel(stage.appearancePanel, whenCurrent(isCurrent, async (nextManifest) => {
    await Promise.all(controllers.map((c) => c.updateManifest(nextManifest)));
  }));

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
async function initTenthMode(isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <output id="tenth-value-display" class="studio-digital-huge" style="display: block;">.0</output>
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
  const abandon = () => (viewer.destroy(), null);

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
      if (!isCurrent()) return;
      $("tenth-value-display").textContent = `.${v}`;
      if (err) console.error(err);
    },
    resolveAssets,
  );

  setupAppearancePanel($("studio-scene"), whenCurrent(isCurrent, async (nextManifest) => {
    await tenth.updateManifest(nextManifest);
  }));

  await tenth.configure(0);
  if (!isCurrent()) return abandon();

  $("studio-controls").querySelectorAll(".tenth-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tenth.set(Number(btn.dataset.val));
    });
  });

  $("tenth-step-plus5").addEventListener("click", () => {
    tenth.step(5 * direction);
  });
  $("tenth-step-minus5").addEventListener("click", () => {
    tenth.step(-5 * direction);
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
async function initCounterMode(isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <output id="counter-value-display" class="studio-digital-huge" style="display: block;">00</output>
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
  const abandon = () => (viewer.destroy(), null);
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont);

  const controller = await createStudioCounter({
    base,
    view: viewer,
    manifest,
    onState: (v, busy) => {
      if (!isCurrent()) return;
      $("counter-value-display").textContent = String(v).padStart(2, "0");
    },
    resolveAssets,
  });
  if (!isCurrent()) return abandon();

  setupAppearancePanel($("studio-scene"), whenCurrent(isCurrent, async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  }));

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
async function initTimerMode(fiveSecond, isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <output id="timer-display" class="studio-digital-huge" style="display: block;">
        ${fiveSecond ? "00:05.0" : "15:00"}
      </output>
    </article>
  `;

  renderStudioHud(fiveSecond ? "5-Second Timer" : "Workshop Timer", `
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="timer-toggle-btn" class="primary" style="flex: 1;">Start</button>
      <button id="timer-reset-btn" style="flex: 1;">Reset</button>
    </div>
  `);

  const viewer = new CubeViewer($("studio-scene"));
  activeViewer = viewer;
  const abandon = () => (viewer.destroy(), null);
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const route = fiveSecond ? await loadFiveSecondRoute(base) : await loadTimerRoute(base);
  if (!isCurrent()) return abandon();
  const spec = studioTimerProfile(fiveSecond);
  const clock = new WorkshopClock(undefined, spec);

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont);
  const controller = createStudioTimerController(
    viewer,
    route,
    manifest,
    () => {},
    resolveAssets,
  );

  setupAppearancePanel($("studio-scene"), whenCurrent(isCurrent, async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  }));

  // Controller values are step buckets, not seconds.
  const defaultSec = studioTimerDefaultBucket(spec);
  await controller.configure(defaultSec);
  if (!isCurrent()) return abandon();

  function update() {
    const snap = clock.snapshot();
    $("timer-display").textContent = studioTimerReadout(snap.bucket, spec);
    $("timer-toggle-btn").textContent = clock.running ? "Pause" : "Start";
  }

  const driver = new StudioTimerDriver({
    clock,
    controller,
    setDuration: (ms) => viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms),
    onError: (err) => {
      if (isCurrent()) $("studio-error").textContent = err.message;
    },
  });

  $("timer-toggle-btn").addEventListener("click", () => {
    if (clock.running) driver.pause();
    else driver.start();
    update();
  });

  $("timer-reset-btn").addEventListener("click", () => {
    driver.reset();
    update();
  });

  update();
  const intervalId = setInterval(update, 100);
  const driverId = setInterval(() => driver.tick(), 50);

  return () => {
    clearInterval(intervalId);
    clearInterval(driverId);
    driver.dispose();
    viewer.destroy();
  };
}

// -------------------------------------------------------------
// Mode 7: Single-Cube HSM / MS / HM Counter (1 cube)
// -------------------------------------------------------------
async function initHsmSingleMode(variant, isCurrent) {
  const cardsContainer = $("studio-cards");
  cardsContainer.setAttribute("data-count", "1");
  cardsContainer.innerHTML = `
    <article class="clock-card" style="text-align: center;">
      <output id="hsm-value-display" class="studio-digital-huge" style="display: block;">00</output>
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
  const abandon = () => (viewer.destroy(), null);
  viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / 100);

  const design = variant === "ms"
    ? await loadMsDesign(base, msPin.runtimeSHA256)
    : variant === "hm"
      ? await loadHmDesign(base, hmPin.runtimeSHA256)
      : await loadHsmDesign(base, hsmPin.runtimeSHA256);
  if (!isCurrent()) return abandon();

  let manifest = buildManifest(currentDisplay, currentMarker, currentLetterFont, currentLettering);

  const controller = createStudioSingleController(
    variant,
    viewer,
    design,
    manifest,
    $("single-unit-select").value,
    (v, busy) => {
      if (!isCurrent()) return;
      $("hsm-value-display").textContent = String(v).padStart(2, "0");
    },
    resolveAssets,
  );

  setupAppearancePanel($("studio-scene"), whenCurrent(isCurrent, async (nextManifest) => {
    await controller.updateManifest(nextManifest);
  }));

  await controller.configure(0);
  if (!isCurrent()) return abandon();

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

const MODE_INITS = {
  clock: (isCurrent) => initClockMode(isCurrent),
  "ms-timer": (isCurrent) => initMsTimerMode(isCurrent),
  "hm-clock": (isCurrent) => initHmClockMode(isCurrent),
  tenth: (isCurrent) => initTenthMode(isCurrent),
  counter: (isCurrent) => initCounterMode(isCurrent),
  timer: (isCurrent) => initTimerMode(false, isCurrent),
  "five-second-timer": (isCurrent) => initTimerMode(true, isCurrent),
  "hsm-counter": (isCurrent) => initHsmSingleMode("hsm", isCurrent),
  "ms-counter": (isCurrent) => initHsmSingleMode("ms", isCurrent),
  "hm-one-cube": (isCurrent) => initHsmSingleMode("hm", isCurrent),
};

const registry = createRegistry(
  MODE_CATALOG.map((meta) => ({
    ...meta,
    async mount(_root, _params, { isCurrent }) {
      const cleanup = await MODE_INITS[meta.id](isCurrent);
      return typeof cleanup === "function" ? { dispose: cleanup } : undefined;
    },
  })),
);

const router = createRouter({
  registry,
  root: $("studio-scene"),
  fallback: "clock",
  onBefore(mode) {
    // Clear scene and cards
    $("studio-scene").innerHTML = "";
    $("studio-cards").innerHTML = "";
    $("studio-controls").innerHTML = "";
    $("studio-error").textContent = "";

    delete $("shell").dataset.modeReady; // test hook, set again in onMounted

    // Update header text
    document.title = `Cubistry · ${mode.title}`;
    $("studio-heading").textContent = mode.title;
    $("studio-subtitle").textContent = mode.subtitle;
    $("studio-cube-count-badge").textContent = `${mode.cubes} CUBE${mode.cubes > 1 ? "S" : ""}`;
    $("studio-mode-label").textContent = mode.badge;

    // Sync dropdown
    $("studio-application").value = mode.id;
  },
  // Test hook (tests/browser/studio-modes-smoke.spec.mjs): the mode finished initializing without an exception.
  onMounted(mode) {
    $("shell").dataset.modeReady = mode.id;
  },
  onError(err, id) {
    console.error("Failed to initialize mode:", err);
    $("studio-error").textContent = `Failed to load mode ${id}: ${err.message}`;
  },
  onCleanupError: (e) => console.warn("Cleanup error:", e),
});

// Initialize on DOM ready
async function initStudio() {
  await ensureProof();

  $("studio-application").addEventListener("change", (e) => {
    router.go(e.target.value);
  });

  await router.start();
  const urlParams = new URLSearchParams(location.search);
  const presParam = urlParams.get("presentation") ?? urlParams.get("kiosk");
  if (presParam === "1" || presParam === "true") {
    setTimeout(() => togglePresentation(true), 200);
  }
}

initStudio();
