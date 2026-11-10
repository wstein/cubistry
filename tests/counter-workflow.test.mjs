// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = name => {
  const url = new URL(`../.github/workflows/${name}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};
const quick = read("counter.yml"), browser = read("counter-browser.yml");
const expectedEnvironment = JSON.parse(readFileSync(new URL("../scripts/ci/browser-environment.json", import.meta.url)));
const shards = json => JSON.parse(json).include.map(x => `${x.group}:${x.shard}/${x.of}`);
const context = (event, action, label) => ({
  event_name: event, ref: "refs/heads/main",
  event: { action, label: { name: label }, pull_request: { number: event === "pull_request" ? 7 : null, labels: [{ name: "e2e" }] } },
});
const evaluate = (expression, github) => Function("github", "contains", "format", `return (${expression});`)(
  github, (values, value) => values.includes(value),
  (template, ...values) => template.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)])),
);
const cancel = workflow => {
  const expression = workflow.match(/^  cancel-in-progress: \$\{\{ (.*) \}\}$/m);
  assert.ok(expression, "workflow has an explicit cancellation policy");
  return github => evaluate(expression[1], github);
};
const group = (workflow, github) => {
  const expression = workflow.match(/^  group: (.*)$/m);
  assert.ok(expression, "workflow has a concurrency group");
  return expression[1].replace(/\$\{\{ (.*?) \}\}/g, (_, expr) => evaluate(expr, github));
};

test("quick counter keeps its check and full validation outside the browser workflow", () => {
  assert.match(quick, /^name: Counter checks$/m);
  assert.match(quick, /^  counter:$/m);
  assert.match(quick, /run: npm run check/);
  assert.match(quick, /npm run test:print-exports/);
  assert.match(quick, /prepare-hm.mjs --check --require-commit/);
  assert.match(quick, /prepare-calendar7.mjs --check --require-commit/);
  assert.doesNotMatch(quick, /^  e2e(?:-pages)?:$/m);
  assert.doesNotMatch(quick, /needs:.*e2e/);
});
test("browser matrix retains three PR fast shards and six main or nightly shards", () => {
  const matrix = browser.match(/^ {6}matrix: \$\{\{ fromJSON\((.*)\) \}\}$/m);
  assert.ok(matrix, "browser workflow retains the complete matrix");
  const [, pull, other] = matrix[1].match(
    /^github\.event_name == 'pull_request' && '(\{.*?\})' \|\| '(\{.*\})'$/,
  );
  const fast = ["fast:1/3", "fast:2/3", "fast:3/3"];
  assert.deepEqual(shards(pull), fast);
  assert.deepEqual(shards(other), [...fast, "timing:1/3", "timing:2/3", "timing:3/3"]);
  assert.match(browser, /^    name: e2e \$\{\{ matrix.group \}\} \(\$\{\{ matrix.shard \}\}\)$/m);
  assert.match(browser, /^  e2e-pages:$/m);
  for (const command of ["test:e2e", "test:pages", "test:pr-preview"])
    assert.ok(browser.includes(`npm run ${command}`), command);
  assert.match(browser, /node scripts\/check-pastel-garden-tiles.mjs/);
});
test("nightly, main and manual triggers retain full browser coverage and quick nightly skip", () => {
  for (const workflow of [quick, browser]) {
    assert.match(workflow, /\n {2}schedule:\n {4}- cron: '0 1 \* \* \*'\n/);
    assert.match(workflow, /\n {2}workflow_dispatch:\n/);
    assert.match(workflow, /push:\n {4}branches: \[main\]/);
    assert.match(workflow, /types: \[opened, reopened, synchronize, labeled\]/);
  }
  assert.match(quick, /if: github.event_name != 'schedule'/);
  assert.match(browser, /\n {2}workflow_call:\n/);
  assert.match(quick, /browser-on-demand:\n(?: {4}#.*\n)* {4}if: github.event_name == 'workflow_dispatch'\n {4}uses: \.\/.github\/workflows\/counter-browser.yml/);
});
test("PR browser work starts for e2e only and unrelated labels cannot cancel it", () => {
  const gates = [...browser.matchAll(/^    if: (.*)$/gm)].map(x => x[1]);
  assert.equal(gates.length, 2, "both browser jobs retain their event gates");
  for (const gate of gates) {
    // GitHub projects labels.*.name to a list before evaluating contains().
    const expression = gate.replace("github.event.pull_request.labels.*.name", "github.event.labels");
    const event = (action, label, labels = ["e2e"]) => ({
      ...context("pull_request", action, label), event: { ...context("pull_request", action, label).event, labels },
    });
    assert.equal(evaluate(expression, event("labeled", "e2e")), true);
    assert.equal(evaluate(expression, event("synchronize", undefined)), true);
    assert.equal(evaluate(expression, event("labeled", "preview")), false);
    assert.equal(evaluate(expression, event("opened", undefined, [])), false);
    assert.equal(evaluate(expression, context("push")), true);
    assert.equal(evaluate(expression, context("schedule")), true);
    assert.equal(evaluate(expression, context("workflow_dispatch")), true);
  }
  assert.equal(cancel(browser)(context("pull_request", "labeled", "preview")), false);
});
test("quick and browser concurrency are independent and latest main pushes supersede only pushes", () => {
  const main = context("push"), manual = context("workflow_dispatch"), nightly = context("schedule");
  assert.notEqual(group(quick, main), group(browser, main));
  for (const workflow of [quick, browser]) {
    assert.equal(cancel(workflow)(main), true);
    assert.equal(cancel(workflow)(context("pull_request", "synchronize")), true);
    assert.equal(cancel(workflow)(nightly), false);
    assert.equal(cancel(workflow)(manual), false);
    assert.notEqual(group(workflow, main), group(workflow, nightly));
    assert.notEqual(group(workflow, main), group(workflow, manual));
  }
});
test("the Pages build image is the same immutable environment as the Counter browser jobs", () => {
  const pages = read("pages.yml");
  const images = [...pages.matchAll(/^ {6}image: (mcr\.microsoft\.com\/playwright:[^\s]+)$/gm)];
  assert.equal(images.length, 1, "the Pages build job pins its image");
  assert.equal(images[0][1], expectedEnvironment.image);
});
test("every Counter browser consumer uses the same immutable matching environment", () => {
  for (const [workflow, jobs] of [[quick, 1], [browser, 2]]) {
    const images = [...workflow.matchAll(/^      image: (mcr\.microsoft\.com\/playwright:[^\s]+)$/gm)];
    assert.equal(images.length, jobs, "each browser-consuming job pins its image");
    for (const [, image] of images) {
      assert.match(image, /^mcr\.microsoft\.com\/playwright:v1\.64\.1-noble@sha256:[a-f0-9]{64}$/);
      assert.equal(image, expectedEnvironment.image);
    }
    assert.equal((workflow.match(/node-version: 24/g) || []).length, jobs);
    assert.equal((workflow.match(/TZ: UTC/g) || []).length, jobs);
    assert.doesNotMatch(workflow, /playwright install|apt-get/);
    assert.equal((workflow.match(/uses: \.\/.github\/actions\/browser-environment/g) || []).length, jobs);
    assert.ok(workflow.indexOf("actions/browser-environment") < workflow.indexOf("run: npm run check") || workflow === browser);
  }
});

test("an unrelated label cannot evict a qualified browser run while cancellation is pending", () => {
  const queue = new Map();
  const submit = (id, github) => {
    const name = group(browser, github), state = queue.get(name) || { active: null, pending: null };
    if (state.active === null) state.active = id;
    else state.pending = id; // GitHub replaces pending work even when cancel-in-progress is false.
    queue.set(name, state);
    return name;
  };
  const a = { ...context("pull_request", "synchronize"), run_id: 1001 };
  const b = { ...context("pull_request", "synchronize"), run_id: 1002 };
  const c = { ...context("pull_request", "labeled", "preview"), run_id: 1003 };
  const qualified = submit("A", a);
  submit("B", b);
  submit("C", c);
  assert.equal(queue.get(qualified).pending, "B", "the newest qualified head must stay pending");
  assert.notEqual(group(browser, b), group(browser, c));
});
