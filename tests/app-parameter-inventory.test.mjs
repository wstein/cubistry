import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRegistry } from "../src/apps/registry.ts";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { APP_SCOPED_PARAMS } from "../src/app-switch-url.mjs";
import { PARAM_SPECS, names } from "../src/apps/param-specs.ts";

// Inventory gate of stage 2/4 in knowledge/plans/unified-application.md: every URL parameter of the appendix is still
// read by the code that read it before. The check is against the source text of the reader. Each port PR that moves a
// legacy page into a mode changes the `file` of the affected rows to the new reader and keeps the row.

const registry = createRegistry(MODE_CATALOG.map((m) => ({ ...m, mount: async () => {} })));
const ALL_IDS = registry.ids();
// Single-cube family: the pages that load src/main.mjs, by their unified id.
const SINGLE_CUBE = ["counter", "tenth", "timer", "five-second-timer", "hsm-counter", "ms-counter", "hm-one-cube"];
// Applications that read parameters but have no registered mode yet (stage 4 ports them).
const PENDING_MODES = ["calendar", "playground"];
// Pages that stay pages (print.html: owner decision 10).
const PAGES = ["print.html"];

const MAIN = "src/main.mjs";
const row = (params, file, modes, pattern) => ({ params, file, modes, pattern });

// Limits of this gate, stated plainly:
// - `modes` is only checked for existence (registered mode, pending mode or page). It mixes the unified id of a mode
//   with the legacy page that reads the parameter today (`index.html`, `print.html`); it does not prove that the mode
//   reads the parameter at run time. The check is on source text, not behavior.
// - The completeness scan below sees only lines that contain URLSearchParams, a name ending in "params", or `sp`, and
//   a literal key. A key built at run time (hours-speed and its siblings) or read from a differently named variable
//   is covered only by its explicit row.
// Aliases share a row. `modes` are the ids of the modes that read the parameter today; `pattern` replaces the
// default literal read for a key that the code builds at run time.
const INVENTORY = [
  row(["app"], "src/apps/router.ts", ALL_IDS, /export const APP_PARAM = "app"/),
  row(["application"], MAIN, SINGLE_CUBE),
  row(["mode"], MAIN, SINGLE_CUBE),
  row(["val", "value"], MAIN, SINGLE_CUBE),
  row(["duration"], MAIN, SINGLE_CUBE),
  row(["unit", "letter"], MAIN, SINGLE_CUBE),
  row(["dir", "direction"], MAIN, SINGLE_CUBE),
  row(["range"], MAIN, SINGLE_CUBE),
  row(["speed"], MAIN, SINGLE_CUBE),
  row(["timer-speed", "rate"], MAIN, SINGLE_CUBE),
  row(["lettering"], MAIN, SINGLE_CUBE),
  row(["lettering"], "src/apps/clock/params.ts", ["clock"]),
  row(["display", "font"], MAIN, SINGLE_CUBE),
  row(["pad", "padding"], MAIN, SINGLE_CUBE),
  row(["pad", "padding"], "src/calendar.mjs", ["calendar"]),
  row(["marker"], MAIN, SINGLE_CUBE),
  row(["print"], MAIN, SINGLE_CUBE),
  row(["autoplay", "run"], MAIN, SINGLE_CUBE),
  row(["autoplay", "run"], "src/ms-timer.mjs", ["ms-timer"]),
  row(["kiosk", "presentation"], MAIN, SINGLE_CUBE),
  row(["kiosk", "presentation"], "src/calendar.mjs", ["calendar"]),
  row(["kiosk", "presentation"], "src/ms-timer.mjs", ["ms-timer"]),
  row(["kiosk", "presentation"], "src/chronocube.mjs", ALL_IDS),
  row(["nerd"], "src/apps/shell/slot-api.ts", ALL_IDS, /get\("nerd"\) === "1"/),
  row(
    ["hours-speed", "minutes-speed", "seconds-speed"],
    "src/apps/clock/params.ts",
    ["clock"],
    /CLOCK_UNIT_NAMES\s*=\s*\[\s*"hours",\s*"minutes",\s*"seconds"\s*\][\s\S]*params\.get\(\s*name\s*\+\s*"-speed"\s*\)/,
  ),
  row(["date", "lang", "language", "design"], "src/calendar.mjs", ["calendar"]),
  row(["design"], "src/print.mjs", ["print.html"]),
  row(["year", "month"], "src/apps/calendar7/month-view.ts", ["calendar7"]),
  row(["outer"], "src/apps/calendar7/geometry.ts", ["calendar7"]),
  row(["size"], "src/playground.mjs", ["playground"]),
];

const read = (file) => readFileSync(file, "utf8");
const literalRead = (param) => new RegExp(`\\.(?:get|has)\\(\\s*["'\`]${param}["'\`]\\s*\\)`);

test("every inventory row names real modes or pages", () => {
  for (const { file, modes } of INVENTORY) {
    for (const id of modes) {
      assert.ok(
        ALL_IDS.includes(id) || PENDING_MODES.includes(id) || PAGES.includes(id),
        `${file}: ${id} is neither a registered mode, a pending mode nor a page`,
      );
    }
  }
});

test("a pending mode is removed from the pending list once it is registered", () => {
  for (const id of PENDING_MODES) assert.ok(!ALL_IDS.includes(id), `${id} is registered, drop it from PENDING_MODES`);
});

test("every parameter of every row is still read by the code that read it before", () => {
  for (const { params, file, pattern } of INVENTORY) {
    const src = read(file);
    if (pattern) {
      assert.match(src, pattern, `${file}: ${params.join(", ")}`);
      continue;
    }
    for (const p of params) assert.match(src, literalRead(p), `${file} no longer reads ${p}`);
  }
});

test("the inventory covers the appendix of the unified application plan, plus app", () => {
  const plan = read("knowledge/plans/unified-application.md");
  const appendix = plan.slice(plan.indexOf("## Appendix: URL parameters read by the code"));
  const rows = appendix.split("\n").filter((l) => /^\| `/.test(l));
  const fromPlan = new Set(rows.flatMap((l) => [...l.split("|")[1].matchAll(/`([^`]+)`/g)].map((m) => m[1])));
  const fromInventory = new Set(INVENTORY.flatMap((r) => r.params));
  assert.ok(fromPlan.size >= 30, `parsed only ${fromPlan.size} parameters from the appendix`);
  assert.deepEqual([...fromPlan].filter((p) => !fromInventory.has(p)), [], "appendix parameter missing from the inventory");
  assert.deepEqual(
    [...fromInventory].filter((p) => !fromPlan.has(p)),
    ["app"],
    "inventory parameter missing from the appendix",
  );
});

test("a literal parameter read added anywhere in src or index.html is in the inventory", () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.name === "vendor" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const files = [...walk("src").filter((f) => /\.(mjs|ts)$/.test(f)), "index.html"];
  const known = new Set(INVENTORY.flatMap((r) => r.params));
  const unknown = [];
  for (const file of files) {
    for (const line of read(file).split("\n")) {
      if (!/URLSearchParams|[pP]arams|\bsp\b/.test(line)) continue;
      for (const m of line.matchAll(/\.(?:get|has|getAll)\(\s*["'`]([A-Za-z-]+)["'`]/g)) {
        if (!known.has(m[1])) unknown.push(`${file}: ${m[1]}`);
      }
    }
  }
  assert.deepEqual(unknown, []);
});

// Named in the plan but read by no code yet: `cube=2|3` of the Picture Cube (the appendix records that `size` replaced it).
const PLANNED = ["cube"];

test("the parameters dropped on an app switch are inventory parameters", () => {
  const known = new Set([...INVENTORY.flatMap((r) => r.params), ...PLANNED]);
  for (const p of APP_SCOPED_PARAMS) assert.ok(known.has(p), p);
});

test("the typed parameter specs and the inventory name the same parameters", () => {
  const inventory = new Set(INVENTORY.flatMap((r) => r.params));
  const specs = new Set(Object.keys(PARAM_SPECS).flatMap(names));
  // `app` is the route key and `application` the removed selector: neither is a setup parameter.
  assert.deepEqual([...inventory].filter((p) => !specs.has(p) && p !== "app" && p !== "application"), []);
  assert.deepEqual([...specs].filter((p) => !inventory.has(p) && !PLANNED.includes(p)), []);
});

test("an alias group of the specs is one inventory row group, so the appendix and the parser agree", () => {
  for (const [key, spec] of Object.entries(PARAM_SPECS)) {
    const group = [key, ...(spec.aliases ?? [])];
    const rows = INVENTORY.filter((r) => group.some((n) => r.params.includes(n)));
    if (rows.length === 0) continue; // planned
    for (const n of group) assert.ok(rows.some((r) => r.params.includes(n)), `${key}: alias ${n} has no inventory row`);
  }
});
