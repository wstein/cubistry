import { loadAssets } from "@cubistry/cube-assets";
import { initHudIdle } from "./apps/shared/hud-idle.ts";
initHudIdle();
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { serializeMove } from "@cubistry/cube-mechanics";
import { createDesign, ALLOWED_MOVES } from "./apps/playground/model.ts";
import { THEMES } from "./apps/playground/themes.ts";
import { PlaygroundController } from "./apps/playground/controller.ts";
const $ = (id) => document.getElementById(id);
let controller, viewer;
const sessions = new Map();
// Picture themes are fetched when first selected (a set is at most about 820 KB of SVG, no single file over 210 KB), once even if
// they are selected again while loading. While a load is pending the selector shows the chosen design
// and every control that would act on the current puzzle is disabled, so no move is made that the
// finished switch would then discard.
const loading = new Map();
let designRequest = 0,
  pendingDesign = null,
  released = false;
for (const theme of THEMES) {
  const option = document.createElement("option");
  option.value = theme.id;
  option.textContent = theme.name;
  $("design").insertBefore(option, $("design").querySelector('[value="classic"]'));
}
function loadSession(style) {
  if (sessions.has(style)) return Promise.resolve(sessions.get(style));
  if (!loading.has(style)) {
    const design = createDesign(style);
    loading.set(
      style,
      loadAssets(design.assets, [design.print], undefined, import.meta.env.BASE_URL)
        .then((assets) => {
          if (released) assets.dispose();
          else sessions.set(style, { design, assets });
          return sessions.get(style);
        })
        .finally(() => loading.delete(style)),
    );
  }
  return loading.get(style);
}
async function chooseDesign(style) {
  const request = ++designRequest;
  if (sessions.has(style)) {
    pendingDesign = null;
    controller?.newSession(sessions.get(style));
    update();
    return;
  }
  pendingDesign = style;
  update();
  try {
    const session = await loadSession(style);
    if (request !== designRequest || !session) return;
    pendingDesign = null;
    controller?.newSession(session);
    update();
  } catch (error) {
    if (request !== designRequest) return;
    pendingDesign = null;
    update();
    $("status").textContent = `Unable to load this design: ${error.message}`;
  }
}
for (const move of ALLOWED_MOVES) {
  const token = serializeMove(move),
    b = document.createElement("button");
  b.textContent = token;
  b.dataset.move = token;
  b.setAttribute("aria-label", `Turn ${token}`);
  b.addEventListener("click", () => controller?.manual(token));
  $("face-buttons").append(b);
}
const manual = [
  ...document.querySelectorAll("[data-move]"),
  $("apply"),
  $("notation"),
];
function update() {
  if (!controller) return;
  const s = controller.snapshot;
  const hold = s.busy || s.frozen || pendingDesign !== null;
  $("status").textContent = pendingDesign ? "Loading the picture set…" : s.message;
  $("cube").setAttribute("aria-busy", String(s.busy || pendingDesign !== null));
  Object.assign($("cube").dataset, {
    ready: "true",
    exact: s.frozen ? "unknown" : String(s.exact),
    equivalent: s.frozen ? "unknown" : String(s.rotationEquivalent),
    cursor: String(s.cursor),
    style: s.style,
    solver: s.solverStatus,
    turning: String(s.turning),
    frozen: String(s.frozen),
  });
  $("exact").textContent = s.frozen
    ? "Unknown"
    : s.exact
      ? "Solved"
      : "Unsolved";
  $("exact").dataset.solved = String(!s.frozen && s.exact);
  $("equivalent").textContent = s.frozen
    ? "Unknown"
    : s.rotationEquivalent
      ? "Solved"
      : "Unsolved";
  $("equivalent").dataset.solved = String(!s.frozen && s.rotationEquivalent);
  for (const el of manual) el.disabled = hold;
  $("undo").disabled = hold || s.cursor === 0;
  $("redo").disabled = hold || s.cursor === s.history.length;
  for (const id of ["solve", "scramble", "new-session"])
    $(id).disabled = s.frozen || pendingDesign !== null;
  $("design").disabled = s.frozen;
  $("cancel").disabled = !s.busy || s.frozen;
  $("design").value = pendingDesign ?? s.style;
  $("stats").textContent =
    `${s.cursor} / ${s.history.length} HTM · ${s.turns} turns played`;
  $("empty").hidden = s.history.length > 0;
  const entries = s.history.map((entry, i) => {
    const el = document.createElement("li");
    el.textContent = serializeMove(entry.move);
    el.title = `${i + 1}. ${entry.source}`;
    el.dataset.future = String(i >= s.cursor);
    el.dataset.cursor = String(i === s.cursor - 1);
    el.setAttribute(
      "aria-label",
      `${i + 1}. ${serializeMove(entry.move)} · ${entry.source}${i >= s.cursor ? " · redo available" : ""}`,
    );
    return el;
  });
  $("history").replaceChildren(...entries);
}
function speed() {
  viewer?.setAnimationSpeed(
    BASE_MOVE_DURATION_MS / Number($("speed").value),
    "quarter-turn",
  );
  $("speed-value").textContent = `${$("speed").value} ms`;
}
$("notation-form").addEventListener("submit", (e) => {
  e.preventDefault();
  controller?.manual($("notation").value);
});
$("scramble-form").addEventListener("submit", (e) => {
  e.preventDefault();
  controller?.scramble(Number($("seed").value), Number($("count").value));
});
$("undo").addEventListener("click", () => controller?.undo());
$("redo").addEventListener("click", () => controller?.redo());
$("solve").addEventListener("click", () => controller?.solve());
$("cancel").addEventListener("click", () => controller?.cancel());
$("design").addEventListener("change", () => void chooseDesign($("design").value));
$("new-session").addEventListener("click", () =>
  controller?.newSession(sessions.get(controller.snapshot.style)),
);
$("camera")?.addEventListener("click", () => viewer?.resetCamera());
$("speed").addEventListener("input", speed);
window.addEventListener("keydown", (e) => {
  if (!controller) return;
  if (e.key === "Escape") {
    e.preventDefault();
    controller.cancel();
    return;
  }
  if (
    e.ctrlKey ||
    e.altKey ||
    e.metaKey ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(
      e.target.tagName,
    )
  )
    return;
  if (/^[rludfb]$/i.test(e.key)) {
    e.preventDefault();
    if (pendingDesign) return;
    controller.manual(e.key.toUpperCase() + (e.shiftKey ? "'" : ""));
  }
});
for (const el of [
  ...manual,
  ...[
    "undo",
    "redo",
    "solve",
    "cancel",
    "scramble",
    "design",
    "new-session",
  ].map($),
])
  el.disabled = true;
try {
  for (const style of ["picture", "pastel", "classic"]) await loadSession(style);
  viewer = new CubeViewer($("cube"));
  document.querySelector(".hud-toggle-btn")?.addEventListener("click", () => {
    document.querySelector(".controls")?.classList.toggle("minimized");
  });
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
  };
  document.querySelector("#presentation-btn, .island-presentation-btn")?.addEventListener("click", () => togglePresentation(true));
  $("exit-presentation-btn")?.addEventListener("click", () => togglePresentation(false));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("presentation-mode")) {
      togglePresentation(false);
    }
  });
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
  speed();
  controller = new PlaygroundController(
    viewer,
    sessions.get("picture"),
    update,
  );
  update();
} catch (error) {
  for (const session of sessions.values()) session.assets.dispose();
  viewer?.destroy();
  $("cube").setAttribute("aria-busy", "false");
  $("exact").textContent = "Unavailable";
  $("equivalent").textContent = "Unavailable";
  $("status").textContent =
    `Unable to start: ${error.message}. Reload to try again.`;
}
// A browser navigation destroys the whole document. Do not interrupt a live
// legal turn with a synchronous destroy call; release resources once it settles.
addEventListener(
  "pagehide",
  () => {
    released = true;
    controller?.cancel();
    const release = () => {
      if (viewer?.animating) {
        requestAnimationFrame(release);
        return;
      }
      viewer?.destroy();
      for (const s of sessions.values()) s.assets.dispose();
    };
    release();
  },
  { once: true },
);
