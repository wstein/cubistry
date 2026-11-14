// Shared glue: loads the app's own modules and converts states to and from the TSV formats Julia reads.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, "../..");
export const PRINTS = ["de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded"];

export async function loadApp() {
  const model = await import(`${root}/src/apps/calendar/model.ts`);
  const controller = await import(`${root}/src/apps/calendar/controller.ts`);
  const planner = await import(`${root}/src/apps/calendar/center-planner.mjs`);
  return { model, controller, planner };
}

export function loadDesign(model, id) {
  return model.validateDesign(
    JSON.parse(readFileSync(`${root}/public/calendar/${id}.json`, "utf8")),
  );
}

const v = (a) => a.join(" ");
export const poseToField = (state) =>
  state.map((s) => `${v(s.p)} ${v(s.n)} ${v(s.up)}`).join(" ");
export function fieldToPose(printing, field) {
  const n = field.trim().split(/\s+/).map(Number);
  if (n.length !== 54 * 9) throw Error("Bad pose field");
  return printing.map((s, i) => {
    const o = i * 9;
    return {
      ...s,
      p: n.slice(o, o + 3),
      n: n.slice(o + 3, o + 6),
      up: n.slice(o + 6, o + 9),
    };
  });
}
export const printTsv = (design) =>
  design.printing
    .map((s) => [s.id, s.image, s.cubie, v(s.p), v(s.n), v(s.up)].join("\t"))
    .join("\n") + "\n";
