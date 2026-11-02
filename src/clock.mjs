import { installPrintLink } from "./apps/print/link.ts";
import { initHudIdle } from "./apps/shared/hud-idle.ts";
initHudIdle();
import "./style.css";
import "./clock.css";
import "./presentation.css";
import { installPresentation } from "./apps/shared/presentation.ts";
import { BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { ClockStage } from "./apps/clock/stage.ts";
import { loadAssets } from "@cubistry/cube-assets";
import { loadCounterDesign } from "./apps/counter/design.ts";
import { loadHsmDesign } from "./apps/hsm/design.ts";
import { HsmController } from "./apps/hsm/controller.ts";
import { tenthAssetImages } from "./apps/ms-timer/tenth.ts";
import { SlicedExecutor } from "./apps/hsm/recovery-executor.ts";
import {
  LiveClockScheduler,
  localValues,
  clockText,
} from "./apps/clock/scheduler.ts";
import {
  ClockMoveStatistics,
  formatMean,
} from "./apps/clock/statistics.ts";
import pin from "../hsm-source.json";
import {
  hsmImagesFor,
  hsmDesignFor,
  parseLettering,
  resolveLetterFamily,
  hsmImagesForFamily,
} from "./apps/hsm/lettering.ts";
const $ = (id) => document.getElementById(id),
  names = ["hours", "minutes", "seconds"],
  letters = ["H", "M", "S"];
const lettering = parseLettering(
  new URLSearchParams(location.search).get("lettering") ?? "words-pascal",
);
$("clock-lettering").value = lettering;
const defaultSpeeds = { hours: 500, minutes: 250, seconds: 100 };
for (const name of names) {
  const preferred = new URLSearchParams(location.search).get(name + "-speed");
  if ($(name + "-speed")) {
    if (["2000", "1000", "500", "250", "100", "50", "10"].includes(preferred)) {
      $(name + "-speed").value = preferred;
    } else {
      $(name + "-speed").value = String(defaultSpeeds[name]);
    }
  }
}
$("clock-lettering").addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.set("lettering", $("clock-lettering").value);
  for (const name of names) {
    if ($(name + "-speed"))
      url.searchParams.set(name + "-speed", $(name + "-speed").value);
  }
  location.assign(url);
});
// Recovery searches run in slices that yield to the event loop (docs/HSM_COUNTER.md).
const recoveryExecutor = new SlicedExecutor(),
  scheduler = new LiveClockScheduler(),
  units = [],
  // Session statistics live as long as this page's controllers: reloading or
  // changing the print restarts them; re-rendering and presentation do not.
  statistics = new ClockMoveStatistics(names.length);
let shownStatistics = -1;
function statisticsUi() {
  const snapshot = statistics.snapshot();
  if (snapshot.revision === shownStatistics) return;
  shownStatistics = snapshot.revision;
  const show = (id, value, format = (v) => (v === null ? "—" : String(v))) => {
    const node = $(id),
      text = format(value);
    if (node.textContent !== text) node.textContent = text;
    node.dataset.value = value === null ? "" : String(value);
  };
  [...snapshot.units, snapshot.total].forEach((unit, i) => {
    const name = names[i] ?? "total";
    show(name + "-session-moves", unit.session.htm);
    show(name + "-session-rotations", unit.session.rotations);
    show(name + "-last-moves", unit.last);
    show(name + "-max-moves", unit.max);
    if (i < names.length) show(name + "-mean-moves", unit.mean, formatMean);
  });
}
let stage = null;
let ready = false,
  failed = false;
function draw() {
  if (!ready || failed) return;
  try {
    const epoch = Date.now(),
      mono = performance.now(),
      snapshot = scheduler.tick(epoch, mono, units);
    // Changes completed since the previous poll form one displayed tick.
    statistics.closeTick();
    statisticsUi();
    $("clock-digital").textContent = clockText(snapshot.values);
    $("clock-status").textContent = snapshot.motion.includes("synchronizing")
      ? "Synchronizing to current time"
      : "Live · local time";
    units.forEach((u, i) => {
      const node = $(names[i] + "-state"),
        state = snapshot.motion[i];
      node.dataset.state = state;
      node.textContent = `${String(u.controller.currentValue).padStart(2, "0")}${state === "idle" ? "" : state === "moving" ? " · Moving" : " · Synchronizing"}`;
      const quarter = u.scheduledQuarterDuration ?? u.duration;
      if ($(names[i] + "-timing")) {
        $(names[i] + "-timing").textContent =
          `Scheduled: quarter ${quarter.toFixed(1)} ms · half ${(quarter * 2).toFixed(1)} ms${quarter < u.duration - 0.05 ? " · fitted to live time" : ""}`;
      }
    });
  } catch (e) {
    fail(e);
  }
}
function fail(e) {
  failed = true;
  $("clock-error").textContent = e?.message ?? "Clock initialization failed";
  $("clock-status").textContent = "Clock stopped. Reload to recover.";
}
$("reset-clock-moves").addEventListener("click", () => {
  statistics.reset();
  statisticsUi();
});
$("clock-application").addEventListener("change", () =>
  location.assign(new URL($("clock-application").value, location.href)),
);
const presentation = installPresentation({
  app: "clock",
  // Statistics follow the per-cube status lines and the calendar's move counts.
  hide: ["main > header", ".clock-heading", ".clock-cubes", ".clock-stats", ".clock-stats-reset", ".clock-control > h2", ".clock-control > label", ".clock-control > select", "main > p.small"],
  resetView: () => stage?.resetCamera(),
});
async function initialize() {
  const owned = [],
    unclaimed = [];
  try {
    const [proof, sourceDesign] = await Promise.all([
      loadCounterDesign(undefined, import.meta.env.BASE_URL),
      loadHsmDesign(import.meta.env.BASE_URL, pin.runtimeSHA256),
    ]);
    const design = hsmDesignFor(sourceDesign, lettering);
    function createClockManifest(display = "dseg7", marker = "off", letterFont = "same") {
      const family = resolveLetterFamily(letterFont, display);
      return {
        ...proof.assets,
        fonts: [],
        documents: [],
        images: [
          ...tenthAssetImages(display, marker, proof.assets.images).filter(
            (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
          ),
          ...hsmImagesForFamily(lettering, family),
        ],
      };
    }
    let currentDisplay = localStorage.getItem("cubistry_clock_digit_font") || "noto-sans";
    let currentMarker = localStorage.getItem("cubistry_clock_marker") || "off";
    let currentLetterFont = localStorage.getItem("cubistry_clock_letter_font") || "same";
    let manifest = createClockManifest(currentDisplay, currentMarker, currentLetterFont);
    const results = await Promise.allSettled(
      names.map(() =>
        loadAssets(
          manifest,
          [design.print],
          undefined,
          import.meta.env.BASE_URL,
        ),
      ),
    );
    const assets = results.map((r) =>
      r.status === "fulfilled" ? r.value : null,
    );
    unclaimed.push(...assets.filter(Boolean));
    const failedResult = results.find((r) => r.status === "rejected");
    if (failedResult) throw failedResult.reason;
    const initial = localValues(Date.now());
    $("clock-zone").textContent =
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    stage = new ClockStage($("clock-scene"));

    // Appearance panel font and orientation marker selectors
    const appearancePanel = stage.appearancePanel;
    if (appearancePanel) {
      const displayLabel = document.createElement("label");
      displayLabel.style.display = "block";
      displayLabel.style.marginTop = "6px";
      displayLabel.textContent = "Display font";
      const displaySelect = document.createElement("select");
      displaySelect.id = "clock-display";
      displaySelect.setAttribute("aria-label", "Digit font display");
      displaySelect.innerHTML = `
        <option value="noto-sans"${currentDisplay === "noto-sans" ? " selected" : ""}>Noto Sans (Calendar Standard)</option>
        <option value="dseg7"${currentDisplay === "dseg7" ? " selected" : ""}>7-Segment (DSEG7)</option>
        <option value="dseg14"${currentDisplay === "dseg14" ? " selected" : ""}>14-Segment (DSEG14)</option>
        <option value="quicksand"${currentDisplay === "quicksand" ? " selected" : ""}>Quicksand (Rounded Geometric)</option>
        <option value="outfit"${currentDisplay === "outfit" ? " selected" : ""}>Outfit (Clean Geometric)</option>
        <option value="classic"${currentDisplay === "classic" ? " selected" : ""}>Classic (Geometric)</option>
      `;
      displayLabel.append(displaySelect);

      const letterLabel = document.createElement("label");
      letterLabel.style.display = "block";
      letterLabel.style.marginTop = "6px";
      letterLabel.textContent = "Letter font ";
      const letterSelect = document.createElement("select");
      letterSelect.id = "clock-letter-font";
      letterSelect.setAttribute("aria-label", "Letter and word font");
      letterSelect.innerHTML = `
        <option value="same"${currentLetterFont === "same" ? " selected" : ""}>Same as display font</option>
        <option value="dseg7"${currentLetterFont === "dseg7" ? " selected" : ""}>7-Segment (DSEG7)</option>
        <option value="dseg14"${currentLetterFont === "dseg14" ? " selected" : ""}>14-Segment (DSEG14)</option>
        <option value="noto-sans"${currentLetterFont === "noto-sans" ? " selected" : ""}>Noto Sans (Calendar Standard)</option>
        <option value="quicksand"${currentLetterFont === "quicksand" ? " selected" : ""}>Quicksand (Rounded Geometric)</option>
        <option value="outfit"${currentLetterFont === "outfit" ? " selected" : ""}>Outfit (Clean Geometric)</option>
        <option value="classic"${currentLetterFont === "classic" ? " selected" : ""}>Classic (Geometric)</option>
      `;
      letterLabel.append(letterSelect);

      const markerLabel = document.createElement("label");
      markerLabel.style.display = "block";
      markerLabel.style.marginTop = "6px";
      markerLabel.textContent = "Orientation marker ";
      const markerSelect = document.createElement("select");
      markerSelect.id = "clock-marker";
      markerSelect.setAttribute("aria-label", "Orientation marker indicator");
      markerSelect.innerHTML = `
        <option value="off"${currentMarker === "off" ? " selected" : ""}>Off</option>
        <option value="auto"${currentMarker === "auto" ? " selected" : ""}>Dot: Auto (0, 2, 5, 6, 8, 9)</option>
        <option value="all"${currentMarker === "all" ? " selected" : ""}>Dot: All digits (0–9)</option>
        <option value="line-auto"${currentMarker === "line-auto" ? " selected" : ""}>Underline: Auto (0, 2, 5, 6, 8, 9)</option>
        <option value="line-all"${currentMarker === "line-all" ? " selected" : ""}>Underline: All digits (0–9)</option>
      `;
      markerLabel.append(markerSelect);

      appearancePanel.append(displayLabel, letterLabel, markerLabel);

      let updating = false;
      const onAppearanceChange = async () => {
        if (updating) return;
        updating = true;
        try {
          currentDisplay = displaySelect.value;
          currentMarker = markerSelect.value;
          currentLetterFont = letterSelect.value;
          try {
            localStorage.setItem("cubistry_clock_digit_font", currentDisplay);
            localStorage.setItem("cubistry_clock_marker", currentMarker);
            localStorage.setItem("cubistry_clock_letter_font", currentLetterFont);
          } catch {}
          const nextManifest = createClockManifest(currentDisplay, currentMarker, currentLetterFont);
          await Promise.all(owned.map((c) => c.updateManifest(nextManifest)));
        } catch (e) {
          console.warn("Appearance update queued or deferred:", e);
        } finally {
          updating = false;
        }
      };

      displaySelect.addEventListener("change", onAppearanceChange);
      letterSelect.addEventListener("change", onAppearanceChange);
      markerSelect.addEventListener("change", onAppearanceChange);
    }
    for (let i = 0; i < 3; i++) {
      const host = $("clock-" + names[i]),
        viewer = stage.createCube(host, i);
      let initialAssets = assets[i];
      const controller = new HsmController(
        viewer,
        design,
        manifest,
        letters[i],
        (value, busy, error, progress) => {
          if (progress) statistics.observe(i, progress);
          host.dataset.value = String(value);
          host.setAttribute("aria-busy", String(busy));
          if (error) fail(error);
        },
        (m, prints, signal) => {
          if (initialAssets && m === manifest) {
            const a = initialAssets;
            initialAssets = null;
            return Promise.resolve(a);
          }
          return loadAssets(m, prints, signal, import.meta.env.BASE_URL);
        },
        recoveryExecutor,
      );
      controller.setMode(i === 0 ? 23 : 59, 1);
      unclaimed.splice(unclaimed.indexOf(assets[i]), 1);
      await controller.configure(initial[i]);
      owned.push(controller);
      const paramSpeed = Number(
        new URLSearchParams(location.search).get(names[i] + "-speed"),
      );
      const duration =
        paramSpeed &&
        [2000, 1000, 500, 250, 100, 50, 10].includes(paramSpeed)
          ? paramSpeed
          : $(names[i] + "-speed")
            ? Number($(names[i] + "-speed").value)
            : defaultSpeeds[names[i]];
      const setDuration = (ms) =>
        viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
      setDuration(duration);
      units.push({ controller, duration, setDuration });
      if ($(names[i] + "-speed")) {
        $(names[i] + "-speed").disabled = false;
        $(names[i] + "-speed").addEventListener("change", () => {
          units[i].duration = Number($(names[i] + "-speed").value);
          draw();
        });
      }
    }
    ready = true;
    presentation.setReady(true);
    $("reset-clock-moves").disabled = false;
    $("clock-lettering").disabled = false;

    // Spatial Floating HUD & Presentation Mode controls
    const hud = document.querySelector(".clock-control.floating-hud");
    const toggleBtn = hud?.querySelector(".hud-toggle-btn");
    toggleBtn?.addEventListener("click", () => {
      hud.classList.toggle("is-minimized");
      toggleBtn.textContent = hud.classList.contains("is-minimized") ? "⚙" : "─";
    });
    const presBtn = document.querySelector("#presentation-btn, .island-presentation-btn, .hud-presentation-btn");
    let exitTimer = null;
    const togglePresentation = (enable) => {
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
      stage?.resetCamera?.();
    };
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
    presBtn?.addEventListener("click", () => togglePresentation(true));
    $("exit-presentation-btn")?.addEventListener("click", () => togglePresentation(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("presentation-mode")) {
        togglePresentation(false);
      }
    });

    draw();
    setInterval(draw, 25);
    document.addEventListener("visibilitychange", draw);
    window.addEventListener("pageshow", draw);
  } catch (e) {
    for (const controller of owned) controller.dispose();
    stage?.destroy();
    for (const assets of unclaimed) assets.dispose();
    fail(e);
  }
}
void initialize();
export {
  units as clockUnits,
  stage as clockStage,
  statistics as clockStatistics,
};

installPrintLink(() => {
  const v = $("clock-lettering").value;
  return v === "words-pascal"
    ? "hsm-words-pascal"
    : v === "words"
      ? "hsm-words"
      : "hsm-symbols";
});
