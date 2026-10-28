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
  shiftDate,
} from "../src/apps/calendar/model.ts";
import {
  CalendarController,
  countCalendarMoves,
} from "../src/apps/calendar/controller.ts";
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
  assert.equal(c.progress.queued, latest);
  assert.equal(c.estimate(initial), null);
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
  assert.deepEqual(
    art.fonts.map((f) => f.weight),
    [600, 800],
  );
  for (const font of art.fonts) {
    assert.equal(hash(readFileSync(font.path)), font.sha256);
    assert.equal(font.license, "SIL-OFL-1.1");
    assert.match(
      readFileSync(font.licensePath, "utf8"),
      /SIL OPEN FONT LICENSE/,
    );
  }
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
      assert(svg.includes(`font-weight="${glyph.art.weight}"`));
      assert(svg.includes(`fill="${glyph.art.color}"`));
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

test("English weekend artwork is fixed red extra-bold on SAT and both SUN source stickers", async () => {
  const { stickerArt } = await import("../src/apps/calendar/artwork.ts");
  for (const d of designs.filter((d) => d.id.startsWith("en"))) {
    const weekends = d.printing.filter((s) => ["SAT", "SUN"].includes(s.image));
    assert.deepEqual(
      weekends.map((s) => s.id),
      [20, 33, 40],
    );
    for (const s of d.printing) {
      const art = stickerArt(s),
        weekend = weekends.includes(s);
      assert.equal(art.weight, weekend ? 800 : 600);
      assert.equal(art.color === "#ba302c", weekend);
    }
  }
  const german = designs.find((d) => d.id === "de-a");
  assert.equal(stickerArt(german.printing[3]).weight, 600);
  assert.notEqual(stickerArt(german.printing[3]).color, "#ba302c");
});
test("day stepping follows Gregorian boundaries and rejects dates outside the supported domain", () => {
  for (const [from, direction, to] of [
    ["2024-02-28", 1, "2024-02-29"],
    ["2024-02-29", 1, "2024-03-01"],
    ["1900-02-28", 1, "1900-03-01"],
    ["2000-03-01", -1, "2000-02-29"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["0001-01-02", -1, "0001-01-01"],
    ["9999-12-30", 1, "9999-12-31"],
  ])
    assert.equal(shiftDate(civilDate(from), direction).iso, to);
  assert.throws(() => shiftDate(civilDate("0001-01-01"), -1));
  assert.throws(() => shiftDate(civilDate("9999-12-31"), 1));
  assert.throws(() => shiftDate(civilDate("2026-01-01"), 2));
  assert.deepEqual(countCalendarMoves("R2 U' x2 y F"), {
    htm: 3,
    rotations: 2,
  });
});
test("transition estimates use the actual retained source pose and physical progress excludes setup", async () => {
  for (const design of designs) {
    const initial = findTarget(design, civilDate("2026-11-07")),
      next = findTarget(design, civilDate("2026-11-08"));
    let physical, release;
    const actual = [];
    const port = {
      configure(_d, state) {
        physical = state;
      },
      async animate(from, token, to) {
        assert(sameState(physical, from));
        assert(sameState(apply(from, token), to));
        if (actual.length === 0) await new Promise((r) => (release = r));
        actual.push(token);
        physical = to;
      },
    };
    const c = new CalendarController(design, initial, port, () => {});
    assert.deepEqual(c.progress.completed, { htm: 0, rotations: 0 });
    assert.deepEqual(c.progress.total, { htm: 0, rotations: 0 });
    const estimate = c.estimate(next),
      before = c.physicalState;
    const alias = { ...initial, word: initial.word + " B" };
    assert(matches(sourcePose(design, alias), initial.cells));
    assert(!sameState(sourcePose(design, alias), before));
    c.request(alias);
    assert.equal(c.busy, false);
    assert(sameState(c.physicalState, before));
    assert.deepEqual(c.estimate(next), estimate);
    c.request(next);
    assert.equal(c.estimate(initial), null);
    assert.deepEqual(c.progress.total, estimate);
    assert.deepEqual(c.progress.completed, { htm: 0, rotations: 0 });
    release();
    while (c.busy) await new Promise((r) => setImmediate(r));
    assert.deepEqual(c.progress.completed, estimate);
    assert.deepEqual(c.progress.total, estimate);
    assert.equal(
      actual.filter((t) => /^[RLUDFB]/.test(t)).length,
      estimate.htm,
    );
    assert.equal(
      actual.filter((t) => /^[xyz]/.test(t)).length,
      estimate.rotations,
    );
    assert(sameState(c.physicalState, sourcePose(design, next)));
  }
});
// Synthetic upright print isolates route-planner contracts from the date corpus.
const uprightPlannerDesign = () => ({
  ...designs[0],
  printing: designs[0].printing.map((s) => ({
    ...s,
    up: Math.abs(s.n[1]) === 1 ? [0, 0, -s.n[1]] : [0, 1, 0],
  })),
});
test("checked async plans are cached by exact pose and retain noncanonical hidden-state references", async () => {
  const design = uprightPlannerDesign(),
    initial = {
      weekday: 0,
      month: 1,
      day: 1,
      cells: front(design.printing).map((s) => s.image),
      word: "",
    };
  const target = {
    ...initial,
    cells: front(apply(design.printing, "y")).map((s) => s.image),
    word: "y R L R' L'",
  };
  const following = {
    ...initial,
    cells: front(apply(design.printing, "y2")).map((s) => s.image),
    word: "y2",
  };
  let physical,
    resolveFirst,
    calls = 0;
  const moves = [];
  const c = new CalendarController(
    design,
    initial,
    {
      configure(_d, s) {
        physical = s;
      },
      async animate(from, token, to) {
        assert(sameState(physical, from));
        assert(sameState(apply(from, token), to));
        physical = to;
        moves.push(token);
      },
    },
    () => {},
    async (context) => {
      calls++;
      assert(
        sameState(apply(design.printing, context.sourceWord), context.from),
      );
      if (context.target === target)
        return await new Promise((resolve) => (resolveFirst = resolve));
      return "Q"; // Invalid solver output must choose the checked legal fallback.
    },
  );
  assert.equal(c.estimate(target), null);
  const prepared = c.prepare(target);
  assert.equal(c.estimate(target), null);
  resolveFirst("y B");
  assert.deepEqual(await prepared, { htm: 1, rotations: 1 });
  assert.deepEqual(c.estimate(target), { htm: 1, rotations: 1 });
  c.request(target);
  while (c.busy) await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  assert.deepEqual(moves, ["y", "B"]);
  assert(sameState(physical, apply(design.printing, "y B")));
  assert(!sameState(physical, sourcePose(design, target)));
  assert.equal(c.progress.route, "optimized");
  const nextEstimate = await c.prepare(following);
  assert.deepEqual(nextEstimate, { htm: 1, rotations: 1 });
  c.request(following);
  while (c.busy) await new Promise((r) => setImmediate(r));
  assert(sameState(physical, sourcePose(design, following)));
  assert.equal(c.progress.route, "fallback");
  assert.deepEqual(c.progress.completed, nextEstimate);
  assert.equal(calls, 2);
});
test("asynchronous preparation is discarded after the physical source changes", async () => {
  const design = uprightPlannerDesign(),
    initial = {
      weekday: 0,
      month: 1,
      day: 1,
      cells: front(design.printing).map((s) => s.image),
      word: "",
    };
  const first = {
    ...initial,
    cells: front(apply(design.printing, "y")).map((s) => s.image),
    word: "y",
  };
  const next = {
    ...initial,
    cells: front(apply(design.printing, "y2")).map((s) => s.image),
    word: "y2",
  };
  let release,
    firstCall = true,
    physical;
  const c = new CalendarController(
    design,
    initial,
    {
      configure(_d, s) {
        physical = s;
      },
      async animate(from, token, to) {
        assert(sameState(physical, from));
        physical = to;
      },
    },
    () => {},
    async (context) => {
      if (context.target === first && firstCall) {
        firstCall = false;
        return await new Promise((resolve) => (release = resolve));
      }
      return context.fallbackWord;
    },
  );
  const stale = c.prepare(first);
  c.request(next);
  while (c.busy) await new Promise((r) => setImmediate(r));
  release("y");
  assert.equal(await stale, null);
  assert.equal(c.estimate(first), null);
  assert(sameState(physical, sourcePose(design, next)));
  assert.deepEqual(await c.prepare(first), { htm: 0, rotations: 1 });
});
