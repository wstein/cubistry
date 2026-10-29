import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stateEquals, rotate } from "@cubistry/cube-core";
import {
  applyMoves,
  applyMove,
  parseMove,
  inverseMoves,
  initialState,
  matchesTarget,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import {
  StatusWorkflow,
  validateStatusDefinition,
  displayTarget,
  frontSnapshot,
  snapshotValue,
  valueSnapshot,
  CATEGORY_IDS,
  STATE_IDS,
} from "../src/apps/status/definition.ts";
import { QualityPolicy, rankFour } from "../src/apps/status/policy.ts";
const raw = () => JSON.parse(readFileSync("src/apps/status/definition.json"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const d = validateStatusDefinition(raw()),
  bytes = readFileSync("public/assets/quality/distances.u8"),
  policy = new QualityPolicy(d, bytes);
const catalog = JSON.parse(readFileSync("src/apps/status/policy-catalog.json"));
test("all625 fixed-print witnesses match complete eight-body evidence hashes and immutable24 sticker IDs/up", () => {
  assert.equal(d.targets.length, 625);
  assert.equal(d.print.stickers.length, 24);
  assert.equal(d.assets.images.length, 20);
  assert.equal(hash(bytes), d.policy.certificateSHA256);
  assert.equal(
    hash(readFileSync("src/apps/status/policy-catalog.json")),
    d.policy.catalogSHA256,
  );
  const before = JSON.stringify(d.print),
    source = initialState(d.print);
  for (const [value, target] of d.targets.entries()) {
    assert.equal(snapshotValue(target.states), value);
    assert.deepEqual(valueSnapshot(value), target.states);
    assert(matchesTarget(d.print, target.state, target.target));
    assert.deepEqual(frontSnapshot(d.print, target.state), target.states);
    const compact = target.state.cubies.map((b) => [
      b.id,
      b.position,
      b.orientation,
    ]);
    assert.equal(hash(JSON.stringify(compact)), target.physicalStateSHA256);
    assert(
      stateEquals(
        applyMoves(target.state, inverseMoves(awaitlessParse(target.setup))),
        source,
      ),
    );
    assert.equal(stickerPoses(d.print, target.state).length, 24);
  }
  assert.equal(JSON.stringify(d.print), before);
  assert(Object.isFrozen(d.print.stickers));
  for (const image of d.assets.images) {
    const svg = readFileSync("public" + image.url, "utf8");
    assert.equal(hash(svg), image.sha256);
    assert(!/<(?:text|image|script)\b/.test(svg));
    assert(svg.includes('width="256"'));
  }
  const art = JSON.parse(readFileSync("public/assets/quality/provenance.json"));
  assert.equal(hash(readFileSync(art.font.path)), art.font.sha256);
  assert.equal(art.font.license, "SIL-OFL-1.1");
});
function awaitlessParse(s) {
  return s ? s.split(" ").map(parseMove) : [];
}
test("finite certificate has exact distances for all136080 ranks and every legal edge", () => {
  const unrank = (index) => {
    let p = Math.floor(index / 81),
      t = index % 81;
    const ds = [],
      ts = [];
    for (let j = 3; j >= 0; j--) {
      ds[j] = p % (8 - j);
      p = Math.floor(p / (8 - j));
      ts[j] = t % 3;
      t = Math.floor(t / 3);
    }
    const av = [0, 1, 2, 3, 4, 5, 6, 7];
    return ds.map((v, i) => 3 * av.splice(v, 1)[0] + ts[i]);
  };
  const hist = [];
  let zeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    const q = unrank(i);
    assert.equal(rankFour(q), i);
    hist[bytes[i]] = (hist[bytes[i]] ?? 0) + 1;
    if (!bytes[i]) zeros++;
    let descending = false;
    for (let m = 0; m < 18; m++) {
      const next = rankFour(q.map((v) => catalog.transitions[v][m]));
      assert(bytes[i] <= bytes[next] + 1);
      if (bytes[next] + 1 === bytes[i]) descending = true;
    }
    assert(i === 66258 || descending);
  }
  assert.equal(zeros, 1);
  assert.deepEqual(hist, [1, 15, 198, 2030, 15396, 61768, 53528, 3144]);
});
test("catalog pose projection and every action agree with canonical mechanics across all eight bodies", () => {
  const mul = (a, b) => b.map((v) => rotate(v, a)),
    transpose = (m) => [0, 1, 2].map((i) => m.map((v) => v[i]));
  for (let body = 0; body < 8; body++)
    for (let q = 0; q < 24; q++) {
      const orientation = mul(catalog.poses[q], transpose(catalog.refs[body]));
      const source = {
        ...initialState(d.print),
        cubies: d.print.cubies.map((b) => ({
          id: b.id,
          position: rotate(b.position, orientation),
          orientation,
        })),
      };
      for (let m = 0; m < 18; m++) {
        const actual = applyMove(
          source,
          parseMove(catalog.moves[m]),
        ).cubies.find((b) => b.id === body);
        assert.deepEqual(
          mul(actual.orientation, catalog.refs[body]),
          catalog.poses[catalog.transitions[q][m]],
        );
      }
    }
});
test("continuous625 arbitrary targets and repeated13-edge single-field requests preserve actual IDs within6/7 HTM", () => {
  let state = d.targets[0].state,
    snapshot = d.initial;
  const before = JSON.stringify(d.print);
  let maximum = 0;
  for (let repeat = 0; repeat < 2; repeat++)
    for (const target of d.targets) {
      const plan = policy.plan(state, target.states);
      assert(plan.moves.length <= 7);
      assert(stateEquals(applyMoves(state, plan.moves), plan.state));
      assert(
        stateEquals(applyMoves(plan.state, inverseMoves(plan.moves)), state),
      );
      state = plan.state;
      snapshot = target.states;
      for (const category of [0, 1, 2, 3])
        for (const [from, to] of d.edges) {
          const prep = [...snapshot];
          prep[category] = from;
          state = policy.plan(state, prep).state;
          const next = [...prep];
          next[category] = to;
          const p = policy.plan(state, next);
          assert.equal(p.bound, 6);
          assert.equal(p.preserved.length, 3);
          assert(p.moves.length <= 6);
          maximum = Math.max(maximum, p.moves.length);
          const before = stickerPoses(d.print, state),
            after = stickerPoses(d.print, p.state);
          for (const id of p.preserved)
            assert.deepEqual(
              before.find((s) => s.id === id),
              after.find((s) => s.id === id),
            );
          assert(matchesTarget(d.print, p.state, displayTarget(next)));
          state = p.state;
          snapshot = next;
        }
    }
  assert.equal(maximum, 6);
  assert.equal(JSON.stringify(d.print), before);
});
test("strict definitions reject malformed states, artwork, print frames, witnesses, event edges and provenance", () => {
  const controls = [
    (d) => (d.version = 2),
    (d) => (d.states[1].word = "RUN"),
    (d) => d.categories.reverse(),
    (d) => d.targets.pop(),
    (d) => (d.targets[1].setup = "x"),
    (d) => (d.targets[1].setup = "F"),
    (d) => (d.targets[1].states = d.targets[0].states),
    (d) => (d.print.stickers[0].up = d.print.stickers[0].normal),
    (d) => (d.assets.images[0].id = "unknown"),
    (d) => d.events[0].from.push("missing"),
    (d) => d.events[0].from.push("open"),
    (d) => (d.events[0].to = "open"),
    (d) => d.edges.pop(),
    (d) => (d.demonstration[0].event = "unknown"),
    (d) => (d.policy.certificateSHA256 = "0".repeat(64)),
    (d) => (d.policy.catalogSHA256 = "bad"),
    (d) => (d.initial[0] = "missing"),
  ];
  for (const mutate of controls) {
    const value = raw();
    mutate(value);
    assert.throws(() => validateStatusDefinition(value));
  }
  assert.throws(() => new QualityPolicy(d, bytes.subarray(1)), /Malformed/);
  const corrupt = Uint8Array.from(bytes);
  corrupt[0] = 255;
  assert.throws(() => new QualityPolicy(d, corrupt), /Malformed/);
});
test("all625 manual snapshots and13 event edges use the requested field; error differs from blocked", () => {
  const w = new StatusWorkflow(d);
  assert.equal(d.edges.length, 13);
  for (const target of d.targets) {
    w.selectSnapshot(target.states);
    assert.deepEqual(w.requested, target.states);
  }
  for (const c of CATEGORY_IDS)
    for (const event of d.events)
      for (const state of STATE_IDS) {
        w.selectSnapshot(d.initial);
        w.select(c, state);
        const before = w.requested;
        if (event.from.includes(state)) {
          w.dispatch(c, event.id);
          assert.equal(w.requested[CATEGORY_IDS.indexOf(c)], event.to);
        } else {
          assert.throws(() => w.dispatch(c, event.id), /not allowed/);
          assert.equal(w.requested, before);
        }
      }
  w.selectSnapshot(d.initial);
  for (const step of d.demonstration) w.dispatch(step.category, step.event);
  assert.deepEqual(w.requested, ["ok", "ok", "ok", "ok"]);
  w.select("build", "error");
  assert.match(w.fault, /attempt failed/);
  w.select("build", "blocked");
  assert.match(w.fault, /prerequisite/);
  assert.throws(() => w.select("missing", "open"));
  assert.throws(() => w.select("build", "missing"));
  assert.throws(() => w.dispatch("build", "missing"));
  assert.equal(w.history.length, 12);
});

test("policy transport rejects corrupt, oversized and unavailable certificate bytes before initialization", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(bytes);
    assert(await QualityPolicy.load(d, "/cubistry/"));
    for (const payload of [
      new Uint8Array(136081),
      Uint8Array.from(bytes, (v, i) => (i === 10 ? v ^ 1 : v)),
    ]) {
      globalThis.fetch = async () => new Response(payload);
      await assert.rejects(QualityPolicy.load(d), /limit|integrity/);
    }
    globalThis.fetch = async () => new Response("", { status: 404 });
    await assert.rejects(QualityPolicy.load(d), /could not be loaded/);
    const malformed = {
      ...d,
      policy: { ...d.policy, catalogSHA256: "0".repeat(64) },
    };
    await assert.rejects(QualityPolicy.load(malformed), /catalog integrity/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("every manual single-category state pair is within six across all source copies and alternate-body back poses", () => {
  // Overapproximate every legal hidden completion: the alternate category body
  // can occupy any of four back positions with any of three twists. Other
  // category bodies retain their actual front IDs, so their normalized twists
  // are zero independently of which artwork copies are currently shown.
  const frontPositions = [3, 7, 1, 5];
  const backPoses = catalog.poses
    .map((_, q) => q)
    .filter((q) => !frontPositions.includes(Math.floor(q / 3)));
  let checked = 0;
  for (let category = 0; category < 4; category++) {
    const stickers = d.print.stickers.filter((s) =>
      s.assetId.startsWith(`quality-${CATEGORY_IDS[category]}-`),
    );
    for (const source of stickers)
      for (const alternatePose of backPoses)
        for (const target of STATE_IDS) {
          let minimum = Infinity;
          for (const destination of stickers.filter(
            (s) => s.assetId === `quality-${CATEGORY_IDS[category]}-${target}`,
          )) {
            const sourcePose =
              destination.cubie === source.cubie
                ? 3 * frontPositions[category] + (source.id % 3)
                : alternatePose;
            const targetTwist = destination.id % 3;
            const partial = frontPositions.map((p) => 3 * p);
            partial[category] =
              sourcePose -
              (sourcePose % 3) +
              (((sourcePose % 3) - targetTwist + 3) % 3);
            minimum = Math.min(minimum, bytes[rankFour(partial)]);
          }
          assert(minimum <= 6);
          checked++;
        }
  }
  assert.equal(checked, 1440);
});
