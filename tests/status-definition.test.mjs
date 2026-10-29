import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stateEquals } from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  inverseMoves,
  matchesTarget,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import {
  StatusWorkflow,
  validateStatusDefinition,
} from "../src/apps/status/definition.ts";
const raw = () => JSON.parse(readFileSync("src/apps/status/definition.json"));

test("all six declarative workflow faces and all36 transitions are legal exact upright physical witnesses", () => {
  const d = validateStatusDefinition(raw()),
    source = initialState(d.print);
  assert.equal(d.statuses.length, 6);
  assert.equal(d.print.stickers.length, 24);
  for (const from of d.statuses) {
    assert(matchesTarget(d.print, from.state, from.target));
    assert(
      stateEquals(applyMoves(from.state, inverseMoves(from.moves)), source),
    );
    for (const to of d.statuses) {
      const moves = [...inverseMoves(from.moves), ...to.moves];
      const end = applyMoves(from.state, moves);
      assert(stateEquals(end, to.state));
      assert(matchesTarget(d.print, end, to.target));
      assert.deepEqual(
        stickerPoses(d.print, applyMoves(end, inverseMoves(moves))),
        stickerPoses(d.print, from.state),
      );
    }
  }
  assert(Object.isFrozen(d.print.stickers));
  assert(Object.isFrozen(d.statuses[0].state.cubies));
  assert.equal(d.assets.fonts[0].license, "SIL-OFL-1.1");
  assert.equal(
    createHash("sha256")
      .update(readFileSync("public" + d.assets.fonts[0].url))
      .digest("hex"),
    d.assets.fonts[0].sha256,
  );
});

test("malformed declarations cannot substitute unreachable targets, rotated art or broken event references", () => {
  const controls = [
    (d) => {
      d.version = 2;
    },
    (d) => {
      d.statuses[1].setup = "F";
    },
    (d) => {
      d.statuses[1].setup = "x";
    },
    (d) => {
      d.statuses[0].assetIds[0] = "unknown";
    },
    (d) => {
      d.statuses[1].id = "idle";
    },
    (d) => {
      d.statuses[0].faceLabel = "WRNG";
    },
    (d) => {
      d.print.stickers[0].up = d.print.stickers[0].normal;
    },
    (d) => {
      d.events[0].to = "missing";
    },
    (d) => {
      d.events[0].from = ["missing"];
    },
    (d) => {
      d.events[1].id = "reset";
    },
    (d) => {
      d.demonstration = ["plan.ready"];
    },
    (d) => {
      d.initial = "missing";
    },
  ];
  for (const mutate of controls) {
    const d = raw();
    mutate(d);
    assert.throws(() => validateStatusDefinition(d));
  }
});

test("deterministic rapid events use logical requested state while invalid events leave it unchanged", () => {
  const d = validateStatusDefinition(raw()),
    workflow = new StatusWorkflow(d);
  assert.throws(() => workflow.dispatch("task.completed"), /not allowed/);
  assert.equal(workflow.requested, "idle");
  for (const event of d.demonstration) workflow.dispatch(event);
  assert.equal(workflow.requested, "done");
  workflow.dispatch("agent.failed");
  assert.equal(workflow.requested, "review");
  assert.match(workflow.fault, /Simulated agent failure/);
  workflow.select("coding");
  assert.equal(workflow.requested, "coding");
  assert.equal(workflow.fault, null);
  assert.throws(() => workflow.dispatch("unknown"), /Unknown/);
  assert.throws(() => workflow.select("unknown"), /Unknown/);
  assert.equal(workflow.requested, "coding");
  for (let i = 0; i < 100; i++) workflow.dispatch("reset");
  assert.equal(workflow.history.length, 12);
});
