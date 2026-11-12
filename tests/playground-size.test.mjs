import test from "node:test";
import assert from "node:assert/strict";
import {
  CUBE_SIZES,
  PLAYABLE_SIZES,
  DEFAULT_SIZE,
  resolveSize,
  sizeSearch,
  sizeNote,
} from "../src/apps/playground/size.ts";
import { CAPABILITY } from "../src/apps/playground/model.ts";

test("the size control offers 2 to 7 and plays only what the engine supports", () => {
  assert.deepEqual([...CUBE_SIZES], [2, 3, 4, 5, 6, 7]);
  assert.deepEqual([...PLAYABLE_SIZES], [CAPABILITY.size]);
  assert.ok(PLAYABLE_SIZES.includes(DEFAULT_SIZE));
});

test("resolveSize: a playable size is used as requested", () => {
  assert.deepEqual(resolveSize("2"), { size: 2, requested: 2, note: "" });
});

test("resolveSize: no parameter uses the default without a note", () => {
  assert.deepEqual(resolveSize(null), { size: DEFAULT_SIZE, requested: null, note: "" });
});

test("resolveSize: a valid but not yet playable size keeps the playable one and says so", () => {
  for (const n of [3, 4, 5, 6, 7]) {
    const r = resolveSize(String(n));
    assert.equal(r.size, DEFAULT_SIZE, `size=${n}`);
    assert.equal(r.requested, n);
    assert.match(r.note, new RegExp(`${n}×${n} is not playable yet`));
  }
});

test("resolveSize: values outside 2 to 7 or not whole numbers fall back with a note", () => {
  for (const raw of ["", "1", "8", "2.5", "abc", "-3", "03", "3 ", "0x3"]) {
    const r = resolveSize(raw);
    assert.equal(r.size, DEFAULT_SIZE, raw);
    assert.equal(r.requested, null, raw);
    assert.match(r.note, /size= must be a whole number from 2 to 7/, raw);
  }
});

test("sizeSearch sets size= and keeps the other parameters", () => {
  assert.equal(sizeSearch("", 2), "?size=2");
  assert.equal(sizeSearch("?a=1&size=5", 2), "?a=1&size=2");
});

test("sizeNote names every size that is not playable", () => {
  assert.match(sizeNote(), /Sizes 3 to 7 are not playable yet/);
});
