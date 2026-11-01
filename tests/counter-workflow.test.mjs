import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow = readFileSync(
  new URL("../.github/workflows/counter.yml", import.meta.url),
  "utf8",
);
const shards = (json) =>
  JSON.parse(json).include.map((x) => `${x.group}:${x.shard}/${x.of}`);
test("e2e matrix: pull requests run the fast group only, main and nightly run all six shards", () => {
  const line = workflow.match(/^ {6}matrix: \$\{\{ fromJSON\((.*)\) \}\}$/m)[1];
  const [, pull, other] = line.match(
    /^github\.event_name == 'pull_request' && '(\{.*?\})' \|\| '(\{.*\})'$/,
  );
  const fast = ["fast:1/3", "fast:2/3", "fast:3/3"];
  assert.deepEqual(shards(pull), fast);
  assert.deepEqual(shards(other), [
    ...fast,
    "timing:1/3",
    "timing:2/3",
    "timing:3/3",
  ]);
});
test("nightly schedule at 01:00 UTC and manual dispatch run the e2e jobs, not the counter job", () => {
  assert.match(workflow, /\n {2}schedule:\n {4}- cron: '0 1 \* \* \*'\n/);
  assert.match(workflow, /\n {2}workflow_dispatch:\n/);
  assert.match(
    workflow,
    /\n {2}counter:\n(?: {4}#.*\n)* {4}if: github\.event_name != 'schedule'\n/,
  );
  // The browser jobs keep the label gate for pull requests only.
  const gate =
    "if: github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'e2e')";
  assert.equal(workflow.split(gate).length - 1, 2);
});
