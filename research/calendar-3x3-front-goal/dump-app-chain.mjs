// usage: node dump-app-chain.mjs <printId> <startIso> <days> <dataDir> <fullDir>
// Runs the app's own CalendarController + createPlanner (1M node policy, as shipped) for consecutive +1 day
// steps. dataDir gets the slim, committed data (route, cells, hash of the actual pose before each step);
// fullDir (scratch) gets the complete poses.
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadApp, loadDesign, poseToField, root } from "./lib.mjs";

const [id, start, daysS, dataDir, fullDir] = process.argv.slice(2);
const { model, controller, planner: pl } = await loadApp();
const { civilDate, findTarget, matches, shiftDate } = model;
const design = loadDesign(model, id);
let tokensSeen = [];
const port = { configure() {}, async animate(_f, token) { tokensSeen.push(token); } };
const planner = await pl.createPlanner({ design, options: {} });
let d = civilDate(start);
const first = findTarget(design, d);
const c = new controller.CalendarController(
  design, first, port, (_t, _b, e) => { if (e) throw e; }, planner);
const settled = () => new Promise((r) => {
  const t = setInterval(() => { if (!c.busy) { clearInterval(t); r(); } }, 2);
});
// first 48 bits of SHA-1 as a decimal number (digits only, so spell checkers ignore it)
const sha = (s) => String(parseInt(createHash("sha1").update(s).digest("hex").slice(0, 12), 16));
const rows = [], full = [];
for (let i = 1; i <= +daysS; i++) {
  const pose = poseToField(c.physicalState);
  d = shiftDate(d, 1);
  const t = findTarget(design, d);
  tokensSeen = [];
  const t0 = performance.now();
  c.request(t);
  await settled();
  if (!matches(c.physicalState, t.cells)) throw Error("app miss");
  const { htm, rotations } = c.progress.total;
  rows.push([i, d.iso, htm, rotations, Math.round(performance.now() - t0), c.progress.route,
    tokensSeen.join(" "), t.cells.join("|"), sha(pose)].join("\t"));
  full.push(`${i}\t${pose}`);
}
mkdirSync(dataDir, { recursive: true });
mkdirSync(fullDir, { recursive: true });
writeFileSync(`${dataDir}/app-chain-${id}.tsv`,
  "# step\tdate\tapp_htm\tapp_rot\tapp_ms\troute_kind\tapp_route\tcells\tpose_hash_before_step\n" + rows.join("\n") + "\n");
writeFileSync(`${fullDir}/poses-${id}.tsv`, full.join("\n") + "\n");
writeFileSync(`${dataDir}/initial-${id}.tsv`, `${start}\t${first.cells.join("|")}\t${first.word}\n`);
console.log(id, "steps", rows.length);
