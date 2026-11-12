import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTenthPrint } from "../scripts/export-tenth-print.mjs";

const shipped = () => JSON.parse(readFileSync("public/ms-timer-tenth.v1.json", "utf8"));

test("buildTenthPrint writes a net for the shipped tenth print", () => {
  const { netSvg } = buildTenthPrint();
  assert.match(netSvg, /<svg /);
  for (const face of ["U", "L", "F", "R", "B", "D"]) assert.match(netSvg, new RegExp(`>${face}</text>`));
  assert.doesNotMatch(netSvg, /rotate\(null/);
});

test("buildTenthPrint refuses a face that is not four stickers", () => {
  const source = shipped();
  const u = source.printing.find((s) => s.n[0] === 0 && s.n[1] === 1 && s.n[2] === 0);
  source.printing = source.printing.filter((s) => s !== u);
  assert.throws(() => buildTenthPrint(source), /Face U needs 4 stickers, found 3/);
});

test("buildTenthPrint refuses an up vector that is not in the face plane", () => {
  const source = shipped();
  source.printing[0] = { ...source.printing[0], up: [0, 0, 0] };
  assert.throws(() => buildTenthPrint(source), /up not in face plane/);
});
