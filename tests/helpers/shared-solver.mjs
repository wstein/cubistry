import { readFileSync } from "node:fs";
import { TABLE_URL } from "@puzlwerk/solver-2x2";
import { createCounterSolver } from "../../src/adapters/puzlwerk-2x2.ts";
const bytes = readFileSync(TABLE_URL);
export const prepareTestSolver = (print) =>
  createCounterSolver(print, async () => bytes);
// Fixed regression expectations for this pinned provider, not a production
// lookup table and not a claim of shortest exact-frame paths.
const counts = {
  "15,42": 15,
  "42,44": 7,
  "42,7": 13,
  "42,15": 13,
  "15,14": 10,
  "14,15": 10,
  "15,7": 8,
  "42,43": 10,
  "43,7": 14,
  "7,42": 15,
};
export const expectedHtm = (from, to) => {
  const count = counts[`${from},${to}`];
  if (count === undefined)
    throw Error(`Missing explicit HTM regression ${from}→${to}`);
  return count;
};
