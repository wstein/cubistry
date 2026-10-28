import test from "node:test";
import assert from "node:assert/strict";
import { SequenceNumber } from "../src/apps/shared/sequence-number.ts";

test("sequence numbering follows starts, not requests, frames, completion or session-move resets", () => {
  const counter = new SequenceNumber();
  let progress = { status: "idle", completed: 0, total: 0, target: null, queuedTarget: null, sessionTotal: 0 };
  const observe = (patch, expected) => {
    progress = { ...progress, ...patch };
    assert.equal(counter.observe(progress), expected);
  };
  observe({}, 0);
  observe({ status: "playing", target: 3, total: 4 }, 1);
  observe({}, 1);
  observe({ queuedTarget: 2 }, 1);
  observe({ status: "stopping" }, 1);
  observe({ status: "playing", queuedTarget: null }, 1);
  observe({ completed: 1, sessionTotal: 1 }, 1);
  observe({ completed: 4, sessionTotal: 4 }, 1);
  observe({ status: "completed" }, 1);
  observe({}, 1);
  observe({ sessionTotal: 0 }, 1);
  observe({ total: 0, completed: 0 }, 1);
  observe({ status: "playing", target: 2, total: 3 }, 2);
  observe({ status: "failed" }, 2);
  observe({ status: "idle", total: 0, target: null }, 0);
  observe({ status: "playing", target: 2, total: 3 }, 1);
  observe({ status: "stopped", completed: 3, sessionTotal: 3 }, 1);
  observe({ status: "playing", target: 1, completed: 0, total: 5 }, 2);
});
