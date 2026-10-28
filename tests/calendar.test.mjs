import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  validateDesign,
  apply,
  inverse,
  simplify,
  sameState,
  sourcePose,
  matches,
  civilDate,
  findTarget,
  front,
  tokens,
} from "../src/apps/calendar/model.ts";
import { CalendarController } from "../src/apps/calendar/controller.ts";
const pin = JSON.parse(readFileSync("calendar-source.json", "utf8"));
const designs = Object.keys(pin.runtime).map((file) => {
  const bytes = readFileSync("public/calendar/" + file);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    pin.runtime[file],
  );
  return validateDesign(JSON.parse(bytes));
});
test("all 7686 selected calendar witnesses replay with every nonblank sticker upright", () => {
  for (const d of designs)
    for (const t of d.targets) {
      const state = sourcePose(d, t);
      assert(matches(state, t.cells));
      assert(sameState(apply(state, inverse(t.word)), d.printing));
    }
});
test("calendar dates are Gregorian and cover an entire 400-year cycle", () => {
  for (const d of designs) {
    for (
      let epoch = Date.UTC(2000, 0, 1);
      epoch < Date.UTC(2400, 0, 1);
      epoch += 86400000
    ) {
      const date = civilDate(new Date(epoch).toISOString().slice(0, 10));
      findTarget(d, date);
    }
  }
  assert.equal(civilDate("0001-01-01").weekday, 0);
  assert.equal(civilDate("2024-02-29").weekday, 3);
  for (const x of [
    "1900-02-29",
    "2023-02-29",
    "2024-04-31",
    "0000-01-01",
    "2024-1-1",
  ])
    assert.throws(() => civilDate(x));
});
test("same English print shows adjacent day with real optional blank", () => {
  const [a, b] = designs.filter((d) => d.id.startsWith("en"));
  assert.deepEqual(a.printing, b.printing);
  for (const d of [a, b]) {
    const t = findTarget(d, civilDate("2026-01-03"));
    const cells = front(sourcePose(d, t)).map((s) => s.image);
    assert.equal(cells[6], "");
    assert.equal(cells[7], d.id.endsWith("unpadded") ? "" : "0");
    assert.equal(cells[8], "3");
    assert.equal(cells[0], "SAT");
  }
});
test("calendar requests preserve exact poses, coalesce pending requests and propagate failure", async () => {
  const d = designs[0],
    initial = d.targets[0],
    next = d.targets[100],
    latest = d.targets[500];
  let state, release;
  let count = 0,
    errors = [];
  const port = {
    configure(_d, s) {
      state = s;
    },
    async animate(from, token, to) {
      assert(sameState(state, from));
      assert(sameState(apply(from, token), to));
      if (count++ === 0) await new Promise((r) => (release = r));
      state = to;
    },
  };
  const c = new CalendarController(d, initial, port, (_t, _b, e) => {
    if (e) errors.push(e);
  });
  c.request(next);
  c.request(d.targets[300]);
  c.request(latest);
  release();
  while (c.busy) await new Promise((r) => setImmediate(r));
  assert.equal(c.current, latest);
  assert(sameState(state, sourcePose(d, latest)));
  assert.equal(errors.length, 0);
  assert.equal(
    count,
    tokens(simplify(inverse(initial.word) + " " + next.word)).length +
      tokens(simplify(inverse(next.word) + " " + latest.word)).length,
  );
  const broken = new CalendarController(
    d,
    initial,
    {
      configure() {},
      async animate() {
        throw Error("Lost viewer");
      },
    },
    (_t, _b, e) => {
      if (e) errors.push(e);
    },
  );
  broken.request(next);
  while (broken.busy) await new Promise((r) => setImmediate(r));
  assert.equal(errors.length, 1);
  assert.throws(() => broken.request(latest));
});
test("calendar runtime rejects malformed geometry and unsupported moves", () => {
  const d = JSON.parse(JSON.stringify(designs[0]));
  d.printing[0].up = d.printing[0].n;
  assert.throws(() => validateDesign(d));
  assert.throws(() => tokens("M"));
  assert.throws(() => apply(designs[0].printing, "R garbage"));
});

test("vector artwork retains licensed font, immutable IDs, dimensions and embedded glyphs", () => {
  const art = JSON.parse(readFileSync("assets/calendar/manifest.json", "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(readFileSync(art.font.path)), art.font.sha256);
  assert.equal(art.font.license, "SIL-OFL-1.1");
  assert.match(
    readFileSync(art.font.licensePath, "utf8"),
    /SIL OPEN FONT LICENSE/,
  );
  for (const [id, glyphs] of Object.entries(art.designs)) {
    const print = designs.find(
      (d) => d.id === (id === "en-3" ? "en-3-zero" : id),
    ).printing;
    const ids = [];
    for (const [key, glyph] of Object.entries(glyphs)) {
      const bytes = readFileSync("assets/calendar/" + glyph.file),
        svg = bytes.toString();
      assert.equal(hash(bytes), glyph.sha256);
      assert.match(svg, /width="14mm" height="14mm" viewBox="0 0 256 256"/);
      assert.match(svg, /data:font\/woff2;base64,/);
      assert.doesNotMatch(svg, /(?:href|url)\s*\(?["']?https?:/);
      for (const sid of glyph.stickers) {
        const s = print[sid];
        assert.equal(key, `${s.slot}-${s.image || "blank"}`);
        assert(svg.includes(`>${s.image}</text>`));
        ids.push(sid);
      }
    }
    assert.deepEqual(
      ids.sort((a, b) => a - b),
      Array.from({ length: 54 }, (_, i) => i),
    );
  }
});
