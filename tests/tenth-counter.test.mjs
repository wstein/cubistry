import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  TENTH_MODULUS,
  TENTH_MOVE_MS,
  TENTH_WORDS,
  TENTH_PRINT,
  TENTH_RUN,
  tenthTarget,
  MsTimerTenthCube,
} from "../src/apps/ms-timer/tenth.ts";
import { applyMoves, initialState, matchesTarget, parseAlg } from "@cubistry/cube-mechanics";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("tenth-second Period-1 sequence is an exact 10-step cycle holding stationary 1/10 sticker", () => {
  assert.equal(TENTH_MODULUS, 10);
  assert.equal(TENTH_WORDS.length, 10);
  assert.equal(TENTH_MOVE_MS, 50);

  let state = initialState(TENTH_PRINT);
  for (let i = 0; i < 10; i++) {
    assert(
      matchesTarget(TENTH_PRINT, state, tenthTarget(i)),
      `Target at node ${i} must show digit ${i} and stationary 1/10 unit sticker`,
    );
    const moves = parseAlg(TENTH_WORDS[i]);
    state = applyMoves(state, moves);
  }
  assert.deepEqual(state, initialState(TENTH_PRINT), "Sequence must close after 10 steps");
});

test("tenth-second print preset ms-timer-tenth-20mm-3sets is verified and in catalog", () => {
  const catalog = JSON.parse(readFileSync("public/print/catalog.json", "utf8"));
  const entry = catalog.entries.find((e) => e.id === "ms-timer-tenth-20mm-3sets");
  assert(entry, "Preset ms-timer-tenth-20mm-3sets must be in print catalog");
  assert.equal(entry.design, "ms-timer-tenth");
  assert.equal(entry.sizeMm, 20);
  assert.equal(entry.copies, 3);
  assert.equal(entry.stickerCount, 72);

  const dir = "public/print/" + entry.directory;
  for (const [file, hash] of Object.entries(entry.files)) {
    const actual = sha256(readFileSync(dir + file));
    assert.equal(actual, hash, `File ${file} sha256 mismatch`);
  }

  // Check net.svg contains outside views of all 6 faces and 24 stickers
  const netSvg = readFileSync(dir + "net.svg", "utf8");
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    assert(netSvg.includes(`text-anchor="middle">${face}</text>`), `Net must label face ${face}`);
  }
  for (let i = 0; i < 24; i++) {
    assert(netSvg.includes(`id="sticker-${i}"`), `Net must include sticker-${i}`);
  }
});
