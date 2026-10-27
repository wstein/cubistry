import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCubing2x2Adapter } from "../../src/adapters/cubing-2x2.ts";
import {
  acceptanceFixture,
  GOAL_VALUES,
  START_WORD,
} from "../../src/dev/acceptance-fixture.ts";
const raw = readFileSync(
    new URL("../../public/counter-design.v2.json", import.meta.url),
  ),
  fixture = acceptanceFixture(JSON.parse(raw)),
  adapter = await createCubing2x2Adapter(),
  cases = [];
for (const value of GOAL_VALUES) {
  const result = await adapter.solveBetween(
    fixture.print,
    fixture.start,
    fixture.goal(value),
  );
  cases.push({ value, ...result });
}
const evidence = {
  schema: "cubistry.live-solver-evidence",
  version: 1,
  puzzle: "2x2x2",
  startWord: START_WORD,
  designSHA256: createHash("sha256").update(raw).digest("hex"),
  cases,
};
const output = process.argv[2];
if (output) writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
else console.log(JSON.stringify(evidence, null, 2));
