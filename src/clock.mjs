import "./style.css";
import "./clock.css";
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
import pin from "../hsm-source.json";
import images from "./apps/hsm/images.json";
const $ = (id) => document.getElementById(id),
  names = ["hours", "minutes", "seconds"],
  letters = ["H", "M", "S"];
const scheduler = new LiveClockScheduler(),
  units = [];
let stage = null;
let ready = false,
  failed = false;
function draw() {
  if (!ready || failed) return;
  try {
    const epoch = Date.now(),
      mono = performance.now(),
      snapshot = scheduler.tick(epoch, mono, units);
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
$("clock-application").addEventListener("change", () =>
  location.assign(new URL($("clock-application").value, location.href)),
);
async function initialize() {
  const owned = [],
    unclaimed = [];
  try {
    const [proof, design] = await Promise.all([
      loadCounterDesign(undefined, import.meta.env.BASE_URL),
      loadHsmDesign(import.meta.env.BASE_URL, pin.runtimeSHA256),
    ]);
    const manifest = {
      ...proof.assets,
      fonts: [],
      documents: [],
      images: [
        ...proof.assets.images.filter(
          (i) => /^[0-9]$/.test(i.id) || i.id === "blank",
        ),
        ...images,
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
        (value, busy, error) => {
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
export { units as clockUnits, stage as clockStage };
