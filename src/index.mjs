// Entry of index.html: the landing page without an `app` parameter, otherwise the studio view with the router.
// The legacy stylesheets come first, then the shell, then the landing rules (cascade order matters, see shell.css).
import "./chronocube.css";
import "./landing.css";
import { MODE_CATALOG } from "./apps/mode-catalog.ts";
import { resolveHostView } from "./apps/landing/view.ts";

const shell = document.getElementById("shell");
const view = resolveHostView(location.search, MODE_CATALOG.map((m) => m.id));
shell.dataset.view = view.view;

if (view.view === "app") {
  // The studio (three.js, solvers) loads only when a mode is opened.
  await import("./chronocube.mjs");
} else {
  const { showLanding } = await import("./landing.mjs");
  showLanding();
}
