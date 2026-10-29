import { installPrintLink } from "./apps/print/link.ts";
import "./style.css";
import "./calendar.css";
import "./presentation.css";
import { installPresentation } from "./apps/shared/presentation.ts";
import { sha256, deploymentBasePath } from "@cubistry/cube-assets";
import {
  validateDesign,
  civilDate,
  shiftDate,
  localDate,
  findTarget,
  front,
  demand,
} from "./apps/calendar/model.ts";
import { CalendarViewer } from "./apps/calendar/viewer.ts";
import { CalendarController } from "./apps/calendar/controller.ts";
import { CalendarOptimizer } from "./apps/calendar/optimizer.ts";
import pin from "../calendar-source.json";
const optimizer = new CalendarOptimizer();
const $ = (id) => document.getElementById(id),
  base = deploymentBasePath(import.meta.env.BASE_URL),
  cache = new Map();
let viewer = null,
  controller = null,
  live = true,
  ready = false,
  failed = false,
  requested = "",
  date = localDate(Date.now());
const locale = () =>
  $("calendar-design").value === "de-a" ? "de-DE" : "en-GB";
function fail(error) {
  failed = true;
  ready = false;
  $("calendar-error").textContent = error?.message ?? "Calendar failed";
  $("calendar-state").textContent = "Calendar stopped. Reload to recover.";
  for (const id of [
    "calendar-design",
    "calendar-padding",
    "calendar-date",
    "calendar-live",
    "calendar-decrement",
    "calendar-increment",
  ])
    $(id).disabled = true;
}
async function load(id) {
  if (cache.has(id)) return cache.get(id);
  const response = await fetch(`${base}calendar/${id}.json`);
  demand(response.ok, "Unable to load the verified calendar");
  const bytes = await response.arrayBuffer();
  demand(
    bytes.byteLength < 2_000_000 &&
      (await sha256(new Uint8Array(bytes))) === pin.runtime[id + ".json"],
    "Calendar integrity mismatch",
  );
  const design = validateDesign(JSON.parse(new TextDecoder().decode(bytes)));
  cache.set(id, design);
  return design;
}
function controls() {
  const english = $("calendar-design").value === "en-3";
  $("calendar-padding-label").hidden = !english;
  $("calendar-layout").textContent = english
    ? "Weekday · Month · Day. Adjacent day digits."
    : "Wochentag · Tag · Monat. Two-letter weekday, left-aligned.";
  $("calendar-design").disabled = !ready || controller?.busy;
  $("calendar-padding").disabled = !ready;
  $("calendar-date").disabled = !ready;
  $("calendar-live").disabled = !ready;
  $("calendar-live").setAttribute("aria-pressed", String(live));
  $("calendar-decrement").disabled = !ready || date.iso === "0001-01-01";
  $("calendar-increment").disabled = !ready || date.iso === "9999-12-31";
  showMoves();
}
function showMoves() {
  if (!controller) return;
  const p = controller.progress;
  $("calendar-moves").textContent = p.planning
    ? "Planning legal route…"
    : `${p.completed.htm} / ${p.total.htm} HTM · ${p.completed.rotations} / ${p.total.rotations} cube rotations`;
  $("calendar-moves").dataset.route = p.route;
  $("calendar-route").textContent = p.planning
    ? "Finding a shorter legal route…"
    : p.route === "optimized"
      ? "Optimized physical route"
      : p.route === "fallback"
        ? "Verified baseline route (shorter route unavailable)"
        : "Initial display";
  $("calendar-queue").textContent = p.queued
    ? "Latest requested date is queued."
    : "";
  if (!ready) {
    $("calendar-estimates").textContent = "Preparing move estimates…";
    return;
  }
  if (controller.busy) {
    $("calendar-estimates").textContent =
      "Day estimates available after motion.";
    return;
  }
  const id =
      $("calendar-design").value === "de-a"
        ? "de-a"
        : $("calendar-padding").checked
          ? "en-3-zero"
          : "en-3-unpadded",
    design = cache.get(id);
  if (!design) {
    $("calendar-estimates").textContent = "Preparing move estimates…";
    return;
  }
  const cost = (direction) => {
    try {
      const target = findTarget(design, shiftDate(date, direction));
      const counts = controller.estimate(target);
      if (counts)
        return `${counts.htm} HTM + ${counts.rotations} cube rotations`;
      return "Calculated when selected";
    } catch {
      return "Date limit";
    }
  };
  $("calendar-estimates").textContent =
    `−1 day: ${cost(-1)} · +1 day: ${cost(1)}`;
}
function changed(target, busy, error) {
  if (error) {
    fail(error);
    return;
  }
  $("calendar-viewer").setAttribute("aria-busy", String(busy));
  $("calendar-state").textContent = busy
    ? controller?.progress.planning
      ? "Planning legal date route…"
      : "Updating · physical date in motion"
    : live
      ? "Live · local date"
      : "Selected date";
  if (!busy && viewer?.presentedState) {
    $("calendar-front").textContent = front(viewer.presentedState)
      .map((s) => s.image || "blank")
      .join(" · ");
  }
  controls();
}
function showControl() {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day);
  $("calendar-digital").textContent = new Intl.DateTimeFormat(locale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  $("calendar-zone").textContent =
    Intl.DateTimeFormat().resolvedOptions().timeZone +
    (live ? " · Live" : " · Inspecting");
}
async function update() {
  if (!ready || failed) return;
  try {
    const id =
        $("calendar-design").value === "de-a"
          ? "de-a"
          : $("calendar-padding").checked
            ? "en-3-zero"
            : "en-3-unpadded",
      key = id + "/" + date.iso;
    showControl();
    if (key === requested) {
      changed(controller.current, controller.busy);
      return;
    }
    requested = key;
    const design = await load(id);
    if (!ready || key !== requested) return;
    controller.request(findTarget(design, date));
    controls();
  } catch (e) {
    fail(e);
  }
}
async function configure() {
  ready = false;
  requested = "";
  controls();
  try {
    const id =
      $("calendar-design").value === "de-a"
        ? "de-a"
        : $("calendar-padding").checked
          ? "en-3-zero"
          : "en-3-unpadded";
    const design = await load(id);
    controller = new CalendarController(
      design,
      findTarget(design, date),
      viewer,
      changed,
      optimizer.plan,
    );
    ready = true;
    showControl();
    requested = id + "/" + date.iso;
    changed(controller.current, false);
    controls();
  } catch (e) {
    fail(e);
  }
}
$("calendar-application").addEventListener("change", () =>
  location.assign(new URL($("calendar-application").value, location.href)),
);
$("calendar-design").addEventListener("change", () => void configure());
$("calendar-padding").addEventListener("change", () => void update());
function inspectDate() {
  if (!ready || failed) return;
  try {
    const chosen = civilDate($("calendar-date").value);
    $("calendar-error").textContent = "";
    date = chosen;
    live = false;
    void update();
    controls();
  } catch (e) {
    $("calendar-error").textContent = e.message;
  }
}
$("calendar-date").addEventListener("change", inspectDate);
$("calendar-date").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    inspectDate();
  }
});
function stepDate(direction) {
  if (!ready || failed) return;
  try {
    const next = shiftDate(date, direction);
    date = next;
    live = false;
    $("calendar-date").value = date.iso;
    $("calendar-error").textContent = "";
    void update();
    controls();
  } catch (e) {
    $("calendar-error").textContent = e.message;
  }
}
$("calendar-decrement").addEventListener("click", () => stepDate(-1));
$("calendar-increment").addEventListener("click", () => stepDate(1));
$("calendar-live").addEventListener("click", () => {
  $("calendar-error").textContent = "";
  live = true;
  date = localDate(Date.now());
  $("calendar-date").value = date.iso;
  void update();
  controls();
});
$("calendar-speed").addEventListener("change", () => {
  viewer.duration = Number($("calendar-speed").value);
});
function tick() {
  if (!ready || !live || failed) return;
  const current = localDate(Date.now());
  if (current.iso !== date.iso) {
    date = current;
    $("calendar-date").value = date.iso;
    void update();
  }
}
const presentation = installPresentation({
  app: "calendar",
  hide: ["main > header", "main > h1", "main > p.small", ".calendar-controls > :not(#calendar-digital):not(#calendar-zone)"],
  resetView: () => viewer?.resetReferenceView(),
});
async function initialize() {
  try {
    await Promise.all(
      [600, 800].map((weight) =>
        document.fonts.load(`${weight} 168px "Counter Sans"`),
      ),
    );
    demand(
      [600, 800].every((weight) =>
        document.fonts.check(`${weight} 168px "Counter Sans"`),
      ),
      "Calendar font unavailable",
    );
    viewer = new CalendarViewer($("calendar-viewer"));
    $("calendar-date").value = date.iso;
    await configure();
    presentation.setReady(!failed);
    setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
  } catch (e) {
    viewer?.destroy();
    fail(e);
  }
}
void initialize();
export const calendarApp = {
  get controller() {
    return controller;
  },
  get viewer() {
    return viewer;
  },
};

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) optimizer.dispose();
});

installPrintLink(() => $("calendar-design").value === "de-a" ? "de-a" : "en-3");
