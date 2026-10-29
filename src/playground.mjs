import { loadAssets } from "@cubistry/cube-assets";
import { CubeViewer, BASE_MOVE_DURATION_MS } from "@cubistry/cube-viewer";
import { serializeMove } from "@cubistry/cube-mechanics";
import { createDesign, ALLOWED_MOVES } from "./apps/playground/model.ts";
import { PlaygroundController } from "./apps/playground/controller.ts";
const $ = (id) => document.getElementById(id);
let controller, viewer;
const sessions = new Map();
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
  $("status").textContent = s.message;
  $("cube").setAttribute("aria-busy", String(s.busy));
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
  for (const el of manual) el.disabled = s.busy || s.frozen;
  $("undo").disabled = s.busy || s.frozen || s.cursor === 0;
  $("redo").disabled = s.busy || s.frozen || s.cursor === s.history.length;
  for (const id of ["solve", "scramble", "design", "new-session"])
    $(id).disabled = s.frozen;
  $("cancel").disabled = !s.busy || s.frozen;
  $("design").value = s.style;
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
$("design").addEventListener("change", () =>
  controller?.newSession(sessions.get($("design").value)),
);
$("new-session").addEventListener("click", () =>
  controller?.newSession(sessions.get(controller.snapshot.style)),
);
$("camera").addEventListener("click", () => viewer?.resetCamera());
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
  for (const style of ["picture", "classic"]) {
    const design = createDesign(style),
      assets = await loadAssets(
        design.assets,
        [design.print],
        undefined,
        import.meta.env.BASE_URL,
      );
    sessions.set(style, { design, assets });
  }
  viewer = new CubeViewer($("cube"));
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
