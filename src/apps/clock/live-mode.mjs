// The Live H-M-S Clock mode of the unified application (id `clock`). It carries everything the former clock.html page
// did: three cubes in one scene, the live scheduler, per-cube quarter-turn times, the committed-moves table, the Nerd
// drawer, the sticker lettering and the URL parameters (docs/LIVE_CLOCK.md). Controls sit in the dock slots (controls.ts),
// the numbers in the Nerd drawer (nerd.ts). The shell (src/chronocube.mjs) supplies the host elements and the
// appearance state; the ModeShell of the mount fills the slots.
import { BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import hsmPin from "../../../hsm-source.json";
import { ClockStage } from "./stage.ts";
import { LiveClockScheduler, localValues, clockText } from "./scheduler.ts";
import { ClockMoveStatistics } from "./statistics.ts";
import { CLOCK_UNIT_NAMES, DEFAULT_CLOCK_SPEEDS_MS, clockPrintDesign, parseClockParams, urlWithLettering } from "./params.ts";
import { clockHudHtml } from "./hud.ts";
import { mountClockControls } from "./controls.ts";
import { createClockNerd } from "./nerd.ts";
import { HsmController } from "../hsm/controller.ts";
import { loadHsmDesign } from "../hsm/design.ts";
import { SlicedExecutor } from "../hsm/recovery-executor.ts";
import { whenCurrent } from "../chronocube/mode-switch.ts";

const LETTERS = ["H", "M", "S"];
const names = CLOCK_UNIT_NAMES;

// Test hooks (tests/browser/live-clock.spec.mjs): the units, the stage and the statistics of the mounted clock.
export const clockUnits = [];
export let clockStage = null;
export let clockStatistics = null;

/**
 * Mounts the clock. `studio` is the contract of src/chronocube.mjs: `$`, `base`, `renderHud(title, html)`,
 * `setupAppearancePanel(container, onUpdate)`, `buildManifest(lettering)`, `lettering()`, `useLettering(value)` (this
 * visit only), `rememberLettering(value)`, `resolveAssets`, `setActiveStage(stage)`, `releaseStage(stage)`. `shell` is the
 * ModeShell of this mount: it removes the slots, the drawer and the listeners when the mode ends.
 * Returns the cleanup function for the cubes, the timers and the document listeners.
 */
export async function mountLiveClock(studio, params, shell, isCurrent) {
  const { $ } = studio;
  const choice = parseClockParams(params, { lettering: studio.lettering() });
  let lettering = choice.lettering;
  const manifest = () => studio.buildManifest(lettering);
  studio.useLettering(lettering);

  $("studio-cards").setAttribute("data-count", "3");
  $("studio-cards").innerHTML = `
    <div id="clock-hours" data-unit="H" aria-busy="true"></div>
    <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
    <div id="clock-seconds" data-unit="S" aria-busy="true"></div>
  `;
  studio.renderHud("Live Time", clockHudHtml());
  const hud = $("studio-controls");
  hud.classList.add("clock-control");

  const printLink = document.getElementById("print-stickers");
  const showPrintLink = () => {
    if (!printLink) return;
    const url = new URL("print.html", location.href);
    url.searchParams.set("design", clockPrintDesign(lettering));
    printLink.href = url.href;
  };
  showPrintLink();

  const nerd = createClockNerd(document, {
    onReset: () => {
      statistics.reset();
      nerd.setStats(statistics.snapshot());
    },
  });
  shell.setNerd(nerd.spec);
  // The shell hides the Reference view button again when the mode ends.
  shell.setReferenceView(() => stage?.resetCamera());
  const controls = mountClockControls(shell, document, {
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    speeds: choice.speeds,
    lettering,
    onSpeed: (index, ms) => {
      const unit = units[index];
      if (!unit) return;
      unit.duration = ms;
      draw();
    },
    onLettering: (value) => void changeLettering(value),
  });

  const recoveryExecutor = new SlicedExecutor();
  const scheduler = new LiveClockScheduler();
  const statistics = new ClockMoveStatistics(names.length);
  const units = [];
  const controllers = [];
  let stage = null;
  let ready = false;
  let failed = false;
  let intervalId = 0;
  let disposed = false;
  let shownStatistics = -1;

  function statisticsUi() {
    const snapshot = statistics.snapshot();
    if (snapshot.revision === shownStatistics) return;
    shownStatistics = snapshot.revision;
    nerd.setStats(snapshot);
  }

  function fail(error) {
    failed = true;
    shell.setError({ text: error?.message ?? "Clock initialization failed" });
    const status = $("clock-status");
    if (status) status.textContent = "Clock stopped. Reload to recover.";
  }

  function draw() {
    if (!ready || failed || disposed) return;
    try {
      const snapshot = scheduler.tick(Date.now(), performance.now(), units);
      // Changes completed since the previous poll form one displayed tick.
      statistics.closeTick();
      statisticsUi();
      $("clock-digital").textContent = clockText(snapshot.values);
      $("clock-status").textContent = snapshot.motion.includes("synchronizing")
        ? "Synchronizing to current time"
        : "Live · local time";
      units.forEach((u, i) => {
        const quarter = u.scheduledQuarterDuration ?? u.duration;
        nerd.setTiming(
          i,
          `Scheduled: quarter ${quarter.toFixed(1)} ms · half ${(quarter * 2).toFixed(1)} ms${quarter < u.duration - 0.05 ? " · fitted to live time" : ""}`,
        );
      });
    } catch (e) {
      fail(e);
    }
  }

  // A lettering change swaps the stickers in place; a failure keeps the old print and shows an error row.
  async function changeLettering(value) {
    if (disposed || !isCurrent()) return;
    const before = lettering;
    lettering = value;
    controls.setEnabled(false);
    try {
      studio.rememberLettering(lettering);
      await Promise.all(controllers.map((c) => c.updateManifest(manifest())));
      if (disposed || !isCurrent()) return;
      history.replaceState(null, "", urlWithLettering(location.href, lettering));
      showPrintLink();
      shell.setError(null);
    } catch (e) {
      if (disposed || !isCurrent()) return;
      lettering = before;
      controls.setLettering(before);
      studio.rememberLettering(before);
      shell.setError({ text: e?.message ?? "The sticker lettering could not be changed" });
    } finally {
      controls.setEnabled(true);
    }
  }

  // Releasing a cube that is still turning throws, so the teardown retries until the last turn has ended.
  function teardown(attempt = 0) {
    const busy = controllers.filter((controller) => {
      try {
        controller.dispose();
        return false;
      } catch {
        return true;
      }
    });
    controllers.length = 0;
    controllers.push(...busy);
    try {
      if (!busy.length && stage) {
        stage.destroy();
        studio.releaseStage(stage);
        stage = null;
        return;
      }
    } catch {
      /* a cube is still turning: try again */
    }
    if (!stage && !busy.length) return;
    if (attempt < 100) setTimeout(() => teardown(attempt + 1), 100);
    else console.warn("Live clock teardown gave up");
  }

  // Stops the clock and frees the cubes. The shell resets its shared elements (panel class, reference button, print
  // link) when the next mode starts, so this touches none of them and a superseded mount can call it too.
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(intervalId);
    document.removeEventListener("visibilitychange", draw);
    window.removeEventListener("pageshow", draw);
    if (clockStage === stage) {
      clockUnits.length = 0;
      clockStage = null;
      clockStatistics = null;
    }
    teardown();
  }

  try {
    const design = await loadHsmDesign(studio.base, hsmPin.runtimeSHA256);
    if (!isCurrent()) return dispose();
    const initial = localValues(Date.now());
    stage = new ClockStage($("studio-scene"), 3);
    studio.setActiveStage(stage);
    clockStage = stage;
    clockStatistics = statistics;
    clockUnits.length = 0;

    for (let i = 0; i < 3; i++) {
      const host = $("clock-" + names[i]);
      const viewer = stage.createCube(host, i);
      const controller = new HsmController(
        viewer,
        design,
        manifest(),
        LETTERS[i],
        (value, busy, error, progress) => {
          if (!isCurrent()) return;
          if (progress) statistics.observe(i, progress);
          host.dataset.value = String(value);
          host.setAttribute("aria-busy", String(busy));
          if (error) fail(error);
        },
        studio.resolveAssets,
        recoveryExecutor,
      );
      controller.setMode(i === 0 ? 23 : 59, 1);
      controllers.push(controller);
      await controller.configure(initial[i]);
      if (!isCurrent()) return dispose();
      const duration = choice.speeds[i] ?? DEFAULT_CLOCK_SPEEDS_MS[names[i]];
      const setDuration = (ms) => viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
      setDuration(duration);
      const unit = { controller, duration, setDuration };
      units.push(unit);
      clockUnits.push(unit);
    }

    // Display font, letter font and orientation marker come from the shared appearance panel of the shell.
    studio.setupAppearancePanel(
      $("studio-scene"),
      whenCurrent(isCurrent, async (next) => {
        await Promise.all(controllers.map((c) => c.updateManifest(next)));
      }),
    );

    ready = true;
    controls.setEnabled(true);
    nerd.setResetEnabled(true);
    draw();
    intervalId = setInterval(draw, 25);
    document.addEventListener("visibilitychange", draw);
    window.addEventListener("pageshow", draw);
  } catch (e) {
    fail(e);
    dispose();
    throw e;
  }
  return dispose;
}
