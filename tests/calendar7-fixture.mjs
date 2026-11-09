// SPDX-License-Identifier: AGPL-3.0-or-later
// Hand-made test fixture of a solved 7x7 cube with a made-up front layout (not research data, not the shipped print):
// row 1 carries a month name as three multi-letter labels in columns 1-3, row 2 the weekdays, rows 3-7 dates.
// Every other face is blank. Used by tests/calendar7-stickerless.test.mjs and tests/browser/calendar7-stickerless.spec.mjs.
import { STICKERS } from "../src/apps/calendar7/engine.ts";

export const FIXTURE_ROW1 = ["NO", "VEM", "BER", "", "", "", ""];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const FACES = [
  { n: [0, 0, 1], up: [0, 1, 0] },
  { n: [0, 0, -1], up: [0, 1, 0] },
  { n: [1, 0, 0], up: [0, 1, 0] },
  { n: [-1, 0, 0], up: [0, 1, 0] },
  { n: [0, 1, 0], up: [0, 0, -1] },
  { n: [0, -1, 0], up: [0, 0, 1] },
];

/** The 49 front cells, row-major: text and ink. */
export function frontCells() {
  const cells = [];
  for (let c = 0; c < 7; c++) cells.push({ text: FIXTURE_ROW1[c], ink: FIXTURE_ROW1[c] ? "month" : "blank" });
  for (let c = 0; c < 7; c++) cells.push({ text: WEEKDAYS[c], ink: c === 0 || c === 6 ? "red" : "weekday" });
  const dates = ["", "", "", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23/30", "24/31", "25", "26", "27", "28"];
  for (let k = 0; k < 35; k++) {
    const text = dates[k] ?? "";
    cells.push({ text, ink: text === "" ? "blank" : k % 7 === 0 || k % 7 === 6 ? "red" : "dark" });
  }
  return cells;
}

/** { printing, pose } with 294 stickers on 218 bodies, solved; the front face (+z) shows `frontCells()`. */
export function layoutFixture() {
  const piece = [], text = [], ink = [];
  const pose = { pos: new Int8Array(3 * STICKERS), normal: new Int8Array(3 * STICKERS), up: new Int8Array(3 * STICKERS) };
  const ids = new Map();
  const cells = frontCells();
  let i = 0;
  for (const { n, up } of FACES) {
    const a = n.findIndex((x) => x !== 0);
    const [b, c] = [0, 1, 2].filter((k) => k !== a);
    for (let rowOrder = -3; rowOrder <= 3; rowOrder++)
      for (let colOrder = -3; colOrder <= 3; colOrder++) {
        const p = [0, 0, 0];
        p[a] = 3 * n[a];
        p[b] = colOrder;
        p[c] = rowOrder;
        const key = p.join(",");
        if (!ids.has(key)) ids.set(key, ids.size + 1);
        piece.push(ids.get(key));
        pose.pos.set(p, 3 * i);
        pose.normal.set(n, 3 * i);
        pose.up.set(up, 3 * i);
        const front = n[2] === 1 ? cells[(3 - p[1]) * 7 + (p[0] + 3)] : { text: "", ink: "blank" };
        text.push(front.text);
        ink.push(front.ink);
        i++;
      }
  }
  return { printing: { piece, text, ink }, pose };
}
