// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_RULE_PROFILE } from "../src/apps/calendar7/profile.ts";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
test("the shipped calendar uses strict upright data for May 2026 through December 2099", () => {
  assert.equal(DEFAULT_RULE_PROFILE, "strict");
  const graph = parseGraph(json("public/calendar7/graph.v1.json"));
  assert.deepEqual([graph.nodes[0].year, graph.nodes[0].month], [2026, 5]);
  assert.deepEqual([graph.nodes.at(-1).year, graph.nodes.at(-1).month], [2099, 12]);
  assert.equal(graph.edges.length, 883);
  const { printing } = parseState(json("public/calendar7/state.v1.json"));
  for (const text of ["MON", "FRI"]) assert.ok(printing.text.includes(text));
  for (const text of ["M0N", "FR1"]) assert.ok(!printing.text.includes(text));
});

test("the seam joins different January 2028 states without changing other source edges", async () => {
  const { parseChain, check } = await import("../scripts/prepare-calendar7.mjs");
  const { encodeMoves } = await import("../src/apps/calendar7/graph.ts");
  const pin = json("calendar7-source.json");
  const graph = parseGraph(json("public/calendar7/graph.v1.json"));
  const chain = (name) => parseChain(readFileSync(`data/calendar7/research/strict/${name}/moves.tsv`, "utf8"));
  const window = chain("window"), full = chain("full");
  assert.notEqual(window.edges.at(-1).endHash, full.source.hash);
  assert.equal(graph.nodes[20].hash, full.source.hash);
  assert.equal(graph.edges[19].htm, 3057);
  for (let i = 0; i < 19; i++) assert.equal(encodeMoves(graph.edges[i].moves), encodeMoves(window.edges[i].moves));
  for (let i = 0; i < 863; i++) assert.equal(encodeMoves(graph.edges[i + 20].moves), encodeMoves(full.edges[i].moves));
  const artifact = structuredClone(pin);
  const artifactFile = Object.keys(artifact.artifacts[0].files)[0];
  artifact.artifacts[0].files[artifactFile] = "0".repeat(64);
  assert.throws(() => check(artifact), /does not match its artifact pin/);
  const generated = structuredClone(pin);
  generated.generatedSources["data/calendar7/research/strict/chain-2026-2099.moves.tsv"] = "0".repeat(64);
  assert.throws(() => check(generated), /does not match its generated pin/);
});
