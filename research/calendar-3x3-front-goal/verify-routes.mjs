// usage: node verify-routes.mjs <results.tsv> [...]   (results from run_steps.jl)
// Independent check with the app's own move engine and predicate: every route is applied with `apply` from
// src/apps/calendar/model.ts and the end state must satisfy `matches(state, target.cells)` for the target the app
// itself finds for that date. App-pose variant: the start pose is replayed from the app's recorded routes.
// Own-pose variant: the poses are chained from this solver's routes only. Exit code 1 on any failure.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadApp, loadDesign, here, poseToField } from "./lib.mjs";

const { model, controller } = await loadApp();
const { apply, matches, civilDate, findTarget } = model;
let bad = 0, checked = 0;
const fail = (msg) => { bad++; console.error("FAIL", msg); };

for (const file of process.argv.slice(2)) {
  const rows = readFileSync(file, "utf8").split("\n").filter((l) => l && !l.startsWith("print\t")).map((l) => l.split("\t"));
  const byPrint = Map.groupBy(rows, (r) => r[0] + "\t" + r[1]);
  for (const [key, list] of byPrint) {
    const [id, variant] = key.split("\t");
    const design = loadDesign(model, id);
    const init = readFileSync(`${here}/data/initial-${id}.tsv`, "utf8").trim().split("\t");
    const app = readFileSync(`${here}/data/app-chain-${id}.tsv`, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    let pose = apply(design.printing, init[2]);
    for (const r of list) {
      const [, , step, date, , , status, htm, rot, , , , , route] = r;
      const a = app[Number(step) - 1];
      if (a[0] !== step || a[1] !== date) { fail(`${id} step ${step}: date mismatch`); continue; }
      if (variant === "app" && String(parseInt(createHash("sha1").update(poseToField(pose)).digest("hex").slice(0, 12), 16)) !== a[8])
        fail(`${id} ${variant} step ${step}: replayed pose differs from the app's recorded pose`);
      if (status !== "solved") {
        if (variant === "own") { fail(`${id} own step ${step}: not solved`); break; }
        pose = apply(pose, a[6]); continue;
      }
      const target = findTarget(design, civilDate(date));
      const end = apply(pose, route);
      checked++;
      if (!matches(end, target.cells)) fail(`${id} ${variant} step ${step}: route ${route} does not show ${target.cells.join("|")}`);
      const c = controller.countCalendarMoves(route);
      if (c.htm !== Number(htm) || c.rotations !== Number(rot)) fail(`${id} ${variant} step ${step}: counts ${c.htm}/${c.rotations} != ${htm}/${rot}`);
      pose = variant === "own" ? end : apply(pose, a[6]);
    }
  }
}
if (checked === 0) fail("no route was verified (every row unsolved or no rows)");
console.log(`verified ${checked} routes with the app engine, failures ${bad}`);
process.exit(bad ? 1 : 0);
