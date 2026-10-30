import { installPrintLink } from "./apps/print/link.ts";
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
} from "./apps/hsm/lettering.ts";
const $ = (id) => document.getElementById(id),
  names = ["hours", "minutes", "seconds"],
  letters = ["H", "M", "S"];
const lettering = parseLettering(
  new URLSearchParams(location.search).get("lettering") ?? "words",
);
$("clock-lettering").value = lettering;
for (const name of names) {
  const preferred = new URLSearchParams(location.search).get(name + "-speed");
  if (["2000", "1000", "500", "250", "100", "50", "10"].includes(preferred))
    $(name + "-speed").value = preferred;
}
$("clock-lettering").addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.set("lettering", $("clock-lettering").value);
  for (const name of names)
    url.searchParams.set(name + "-speed", $(name + "-speed").value);
  location.assign(url);
});
const scheduler = new LiveClockScheduler(),
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
      $(names[i] + "-timing").textContent =
        `Scheduled: quarter ${quarter.toFixed(1)} ms · half ${(quarter * 2).toFixed(1)} ms${quarter < u.duration - 0.05 ? " · fitted to live time" : ""}`;
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
    const manifest = {
      ...proof.assets,
      fonts: [],
      documents: [],
      images: [
        ...proof.assets.images.filter(
          (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
        ),
        ...hsmImagesFor(lettering),
      ],
    };
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
    for (let i = 0; i < 3; i++) {
      const host = $("clock-" + names[i]),
        viewer = stage.createCube(host, i);
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
        async () => assets[i],
      );
      controller.setMode(i === 0 ? 23 : 59, 1);
      unclaimed.splice(unclaimed.indexOf(assets[i]), 1);
      await controller.configure(initial[i]);
      owned.push(controller);
      const duration = Number($(names[i] + "-speed").value),
        setDuration = (ms) =>
          viewer.setAnimationSpeed(BASE_MOVE_DURATION_MS / ms, "quarter-turn");
      setDuration(duration);
      units.push({ controller, duration, setDuration });
      $(names[i] + "-speed").disabled = false;
      $(names[i] + "-speed").addEventListener("change", () => {
        units[i].duration = Number($(names[i] + "-speed").value);
        draw();
      });
    }
    ready = true;
    presentation.setReady(true);
    $("reset-clock-moves").disabled = false;
    $("clock-lettering").disabled = false;
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

installPrintLink(() => $("clock-lettering").value === "words" ? "hsm-words" : "hsm-symbols");
