// M/S counter (research PR #138): pins, the deterministic conversion, every
// saved increment and its exact inverse decrement replayed through the real
// controller with exact HTM, S3's two-lap seconds period, walks after
// interruptions, and negative controls for the runtime validator.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  validateMsDesign,
  msTarget,
  MS_EDGE_LIMIT,
} from "../src/apps/ms/design.ts";
import { MsPeriod } from "../src/apps/ms/period.ts";
import { MsController } from "../src/apps/ms/controller.ts";
import { poseKey } from "../src/apps/hsm/periods.ts";
import {
  buildRuntime,
  build,
  RESEARCH_FILES,
  MS_PRINT,
} from "../scripts/prepare-ms.mjs";
import { convertWitness, inverseWord } from "../scripts/ms/convert-witness.mjs";
import {
  applyMoves,
  initialState,
  inverseMoves,
  matchesTarget,
  parseAlg,
  serializeMove,
} from "../packages/cube-mechanics/src/index.ts";
import { stateEquals } from "../packages/cube-core/src/index.ts";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pin = JSON.parse(readFileSync("ms-source.json", "utf8"));
const runtimeBytes = readFileSync(pin.runtimePath);
const raw = JSON.parse(runtimeBytes);
const design = validateMsDesign(raw);
const s3 = design.print;
const text = (moves) => moves.map((m) => serializeMove(m)).join(" ");
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- provenance

test("the research copies and the runtime are pinned to PR #138", () => {
  assert.equal(pin.pullRequest, 138);
  assert.equal(pin.branch, "research/ms-counter-3move");
  assert.equal(pin.commit, "ee88e5725be8e5e1acf554d924ae9a6d5da43de3");
  // The open question stays explicit in the pin.
  assert.match(pin.reviewStatus, /Max 3 HTM for both units: UNKNOWN\./);
  assert.match(pin.reviewStatus, /not proofs\./);
  assert.deepEqual(Object.keys(pin.researchFiles), Object.keys(RESEARCH_FILES));
  for (const [research, copy] of Object.entries(pin.copies)) {
    assert.equal(RESEARCH_FILES[research], copy);
    assert.equal(sha(readFileSync(copy)), pin.researchFiles[research], copy);
  }
  // Only S3 is pinned and copied; M3 stays in the research branch.
  assert.equal(MS_PRINT.id, "s3");
  assert.ok(Object.keys(pin.researchFiles).every((f) => !/-m3\./.test(f)));
  // Both checkers' receipts are byte-identical.
  const e = (f) => pin.researchFiles[`research/ms-counter-3move/evidence/${f}`];
  assert.equal(e("receipt-s3.julia.tsv"), e("receipt-s3.flix.tsv"));
  assert.equal(sha(runtimeBytes), pin.runtimeSHA256);
  assert.deepEqual(raw.source, {
    repository: pin.repository,
    pullRequest: pin.pullRequest,
    branch: pin.branch,
    commit: pin.commit,
  });
});

test("the runtime is exactly the converter output of the pinned copies", () => {
  assert.equal(runtimeBytes.toString("utf8"), build(pin));
  // Deterministic: a second conversion gives the same bytes.
  assert.equal(build(pin), build(pin));
});

// --------------------------------------------------- research summary values

test("S3 meets max 4 HTM with three edges at 4; its seconds stay within 3", () => {
  assert.equal(design.edgeLimitHTM, 4);
  assert.equal(s3.label, "S3");
  assert.equal(raw.prints, undefined, "one print only");
  // Values from the research README ("Witness S3").
  const expected = {
    M: { laps: 1, periodHTM: 177, maximumHTM: 4, setup: "" },
    S: {
      laps: 2,
      periodHTM: 324,
      maximumHTM: 3,
      setup: "F2 L U' B2 D R2 U R' B2",
    },
  };
  assert.equal(s3.maximumHTM, 4);
  let atFour = 0;
  for (const letter of ["M", "S"]) {
    const r = s3.runs[letter];
    const { laps, periodHTM, maximumHTM, setup } = r;
    assert.deepEqual(
      { laps, periodHTM, maximumHTM, setup },
      expected[letter],
      letter,
    );
    // 4-HTM edges per 60-edge lap.
    atFour += r.words.filter((w) => parseAlg(w).length === 4).length / r.laps;
  }
  assert.equal(atFour, 3, "three edges at 4 HTM");
  // The named 4-HTM edges.
  assert.deepEqual(
    s3.runs.M.words
      .map((w, i) => [i, w])
      .filter(([, w]) => parseAlg(w).length === 4)
      .map(([i, w]) => `${i}->${(i + 1) % 60} ${w}`),
    ["14->15 R' F2 L F2", "35->36 F2 L' F2 R", "55->56 F2 L' F2 R"],
  );
});

test("S3 matches the research sticker inventory per corner", () => {
  // The README table lists each corner's three faces in witness sticker-row
  // order; the converted print code is in x, y, z face order. Compare sets.
  const readme = [
    "T4 _ T1",
    "T3 _ T0",
    "M S U3",
    "U4 U8 U0",
    "U1 S U5",
    "U6 U2 U9",
    "U7 M S",
    "T5 _ T2",
  ];
  const sorted = (t) => t.split(" ").sort().join(" ");
  assert.deepEqual(
    raw.print.printCode.split(" | ").map(sorted),
    readme.map(sorted),
  );
});

// -------------------------------------------------------- every saved route

test("every increment and its inverse decrement replays with exact HTM", () => {
  for (const p of [s3])
    for (const letter of ["M", "S"]) {
      const run = p.runs[letter],
        period = new MsPeriod(p.print, run),
        label = `${p.label} ${letter}`;
      const start = applyMoves(initialState(p.print), parseAlg(run.setup));
      assert.ok(matchesTarget(p.print, start, msTarget(letter, 0)), label);
      let state = start,
        total = 0;
      run.words.forEach((word, i) => {
        const moves = parseAlg(word),
          next = applyMoves(state, moves);
        assert.ok(moves.length >= 1 && moves.length <= MS_EDGE_LIMIT);
        assert.ok(moves.length >= run.lowerBounds[i], `${label} lb ${i}`);
        assert.ok(
          matchesTarget(p.print, next, msTarget(letter, (i + 1) % 60)),
          `${label} edge ${i}`,
        );
        // Decrement: the reversed word with inverted tokens, exactly back.
        assert.equal(text(inverseMoves(moves)), inverseWord(word));
        assert.ok(stateEquals(applyMoves(next, inverseMoves(moves)), state));
        assert.equal(period.nodeOf(state), i);
        assert.equal(text(period.step(i, 1).moves), word);
        assert.equal(
          text(period.step((i + 1) % run.words.length, -1).moves),
          inverseWord(word),
        );
        total += moves.length;
        state = next;
      });
      assert.ok(stateEquals(state, start), `${label} closes`);
      assert.equal(total, run.periodHTM);
    }
});

test("S3 seconds need two laps; minutes close after one", () => {
  for (const p of [s3])
    for (const letter of ["M", "S"]) {
      const run = p.runs[letter];
      const start = applyMoves(initialState(p.print), parseAlg(run.setup));
      let state = start;
      const closures = [];
      run.words.forEach((w, i) => {
        state = applyMoves(state, parseAlg(w));
        if ((i + 1) % 60 === 0) closures.push(stateEquals(state, start));
      });
      const expected = letter === "S" ? [false, true] : [true];
      assert.deepEqual(closures, expected, `${p.label} ${letter}`);
    }
  // The two S3 seconds laps show the same values on different full poses.
  const period = new MsPeriod(s3.print, s3.runs.S);
  assert.equal(period.length, 120);
  for (let v = 0; v < 60; v++)
    assert.notEqual(poseKey(period.nodes[v]), poseKey(period.nodes[v + 60]));
});

// ------------------------------------------------- through the controller

const view = { configure() {}, animate: async () => {}, resetCamera() {} };
const assets = async () => ({ dispose() {} });
const settled = async (c) => {
  for (let n = 0; c.busy && n < 10000; n++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};

test("the controller counts every period both ways with the saved words", async () => {
  for (const p of [s3])
    for (const letter of ["M", "S"]) {
      const run = p.runs[letter],
        c = new MsController(view, p, {}, letter, () => {}, assets),
        n = run.words.length,
        label = `${p.label} ${letter}`;
      await c.configure();
      assert.equal(c.node, 0);
      // Up over the whole period (two laps for S3 seconds), then once more.
      const up = [];
      for (let i = 0; i < n + 1; i++) {
        const node = c.node,
          target = (c.currentValue + 1) % 60;
        assert.equal(text(c.prepare(target)), run.words[node]);
        c.request(target);
        await settled(c);
        assert.equal(c.currentValue, target);
        assert.equal(c.node, (node + 1) % n);
        assert.ok(matchesTarget(p.print, c.state, msTarget(letter, target)));
        up.push(c.progress.total);
        assert.ok(c.progress.total <= MS_EDGE_LIMIT, label);
      }
      assert.equal(
        up.slice(0, n).reduce((a, b) => a + b, 0),
        run.periodHTM,
        label,
      );
      // Down: the exact inverse traversal, the 00 -> 59 wrap included.
      const down = [];
      for (let i = 0; i < n + 1; i++) {
        const node = c.node,
          target = (c.currentValue + 59) % 60,
          previous = (node - 1 + n) % n;
        assert.equal(
          text(c.prepare(target)),
          inverseWord(run.words[previous]),
          `${label} down from node ${node}`,
        );
        c.request(target);
        await settled(c);
        assert.equal(c.currentValue, target);
        assert.equal(c.node, previous);
        down.push(c.progress.total);
      }
      assert.deepEqual(
        down.slice(0, n),
        up.slice(1, n + 1).reverse(),
        `${label}: down mirrors up`,
      );
      assert.equal(c.lap.laps, run.laps);
    }
});

test("jumps walk the period the cheaper way round, landing on a node", async () => {
  const p = s3;
  for (const letter of ["M", "S"]) {
    const c = new MsController(view, p, {}, letter, () => {}, assets);
    await c.configure();
    for (const target of [59, 30, 1, 45, 0]) {
      const from = c.node;
      c.request(target);
      await settled(c);
      assert.equal(c.currentValue, target);
      assert.ok(c.node >= 0, "a period node");
      assert.equal(c.node % 60, target);
      // Independently: the chosen walk is no longer than either direction to
      // any node showing the target.
      const words = p.runs[letter].words.map((w) => parseAlg(w).length),
        n = words.length;
      let best = Infinity;
      for (let t = target; t < n; t += 60) {
        let fwd = 0,
          bwd = 0;
        for (let k = from; k !== t; k = (k + 1) % n) fwd += words[k];
        for (let k = from; k !== t; k = (k - 1 + n) % n)
          bwd += words[(k - 1 + n) % n];
        best = Math.min(best, fwd, bwd);
      }
      assert.equal(c.progress.total, best, `${letter} -> ${target}`);
    }
  }
});

test("an interrupted route finishes or undoes its edge, then walks on", async () => {
  const p = s3;
  let turns = 0,
    c;
  const interrupting = {
    configure() {},
    resetCamera() {},
    animate: async () => {
      // A newer target arrives after the first turn of the route.
      if (++turns === 1) c.request(5);
    },
  };
  c = new MsController(interrupting, p, {}, "S", () => {}, assets);
  await c.configure(10);
  // The 10 -> 11 word has several turns, so one turn leaves an interior pose.
  assert.ok(parseAlg(p.runs.S.words[10]).length > 1);
  c.request(11);
  await settled(c);
  // Undoing the one turn back to node 10 and walking down to 5 is cheaper
  // than finishing the edge first.
  const down = p.runs.S.words
    .slice(5, 10)
    .reduce((a, w) => a + parseAlg(w).length, 0);
  assert.equal(c.progress.sessionTotal, 1 + 1 + down);
  assert.equal(c.currentValue, 5);
  assert.ok(c.node >= 0 && c.node % 60 === 5);
  assert.ok(matchesTarget(p.print, c.state, msTarget("S", 5)));
  // An off-period pose is refused rather than routed.
  const period = new MsPeriod(p.print, p.runs.S);
  assert.equal(
    period.route(applyMoves(period.nodes[0], parseAlg("F F")), 1),
    null,
  );
});

test("configure installs the first-lap node of each value", async () => {
  for (const p of [s3])
    for (const letter of ["M", "S"]) {
      const c = new MsController(view, p, {}, letter, () => {}, assets);
      for (const value of [0, 1, 37, 59]) {
        await c.configure(value);
        assert.equal(c.node, value);
        assert.deepEqual(c.lap, { lap: 1, laps: p.runs[letter].laps });
        const r = p.runs[letter];
        assert.ok(
          stateEquals(
            c.state,
            applyMoves(
              initialState(p.print),
              parseAlg([r.setup, ...r.words.slice(0, value)].join(" ")),
            ),
          ),
        );
      }
    }
});

// --------------------------------------------------------- negative controls

test("the runtime validator rejects tampered data", () => {
  const tamper = (fn) => {
    const copy = clone(raw);
    fn(copy);
    return () => validateMsDesign(copy);
  };
  const at = (d) => d.print;
  assert.throws(
    tamper((d) => (d.edgeLimitHTM = 5)),
    /Invalid M\/S runtime/,
  );
  assert.throws(
    tamper((d) => (at(d).runs[0].words[5] = "R' B R")),
    /wrong value|does not close/,
  );
  assert.throws(
    tamper((d) => (at(d).runs[0].words[14] = "R' F2 L F2 U U'")),
    /outside its bounds/,
  );
  assert.throws(
    tamper((d) => (at(d).runs[1].lowerBounds[3] = 4)),
    /outside its bounds/,
  );
  // S3 seconds claimed as one lap: the words no longer fit.
  assert.throws(
    tamper((d) => (at(d).runs[1].laps = 1)),
    /Invalid M\/S run/,
  );
  // Doubled M period (period 2 claimed with the lap repeated) closes early.
  assert.throws(
    tamper((d) => {
      const r = at(d).runs[0];
      r.laps = 2;
      r.words = [...r.words, ...r.words];
      r.lowerBounds = [...r.lowerBounds, ...r.lowerBounds];
      r.periodHTM *= 2;
    }),
    /closes early/,
  );
  assert.throws(
    tamper((d) => (at(d).runs[1].periodHTM = 323)),
    /length mismatch/,
  );
  assert.throws(
    tamper((d) => (at(d).printing[0].image = "H")),
    /glyph/,
  );
  assert.throws(
    tamper((d) => (at(d).printing[1].image = "7")),
    /wrong value/,
  );
  // The runtime carries one print; a print list is refused.
  assert.throws(
    tamper((d) => (d.prints = [d.print])),
    /Invalid M\/S runtime/,
  );
});

test("the converter rejects tampered research data", () => {
  const read = (f) => readFileSync(pin.copies[f], "utf8");
  const E = "research/ms-counter-3move/evidence/";
  const input = (id, patch = {}) => ({
    tsv: read(`${E}witness-${id}.tsv`),
    meta: {
      id,
      label: id.toUpperCase(),
      path: `${E}witness-${id}.tsv`,
      receipts: {
        julia: read(`${E}receipt-${id}.julia.tsv`),
        flix: read(`${E}receipt-${id}.flix.tsv`),
      },
      checks: read(`${E}checks-${id}.tsv`),
      ...patch,
    },
  });
  const ok = input("s3");
  assert.doesNotThrow(() => convertWitness(ok.tsv, ok.meta));
  // A changed route move.
  assert.throws(
    () =>
      convertWitness(
        ok.tsv.replace(
          "edge\tM\t5\t5\t6\tR' B' R'",
          "edge\tM\t5\t5\t6\tR' B' R",
        ),
        ok.meta,
      ),
    /shows 6/,
  );
  // S period claimed as one lap: after 60 edges the pose is not the start.
  assert.throws(
    () =>
      convertWitness(
        ok.tsv.replace("R' B2\tperiod\t2", "R' B2\tperiod\t1"),
        ok.meta,
      ),
    /S: exact full-state closure/,
  );
  // Receipts that differ, or that name another witness.
  assert.throws(
    () =>
      convertWitness(ok.tsv, {
        ...ok.meta,
        receipts: { ...ok.meta.receipts, flix: ok.meta.receipts.flix + "x" },
      }),
    /byte-identical/,
  );
  const other = (r) =>
    r.replace(
      /witness-sha256\t[0-9a-f]{64}/,
      `witness-sha256\t${"0".repeat(64)}`,
    );
  assert.throws(
    () =>
      convertWitness(ok.tsv, {
        ...ok.meta,
        receipts: {
          julia: other(ok.meta.receipts.julia),
          flix: other(ok.meta.receipts.flix),
        },
      }),
    /names this witness/,
  );
  // A negative control accepted by one checker.
  assert.throws(
    () =>
      convertWitness(ok.tsv, {
        ...ok.meta,
        checks: ok.meta.checks.replace("flix\tREJECTED", "flix\tACCEPTED"),
      }),
    /negative control/,
  );
  // Pins: a modified copy fails the build input check.
  assert.throws(() =>
    buildRuntime(pin, (f) =>
      f.endsWith("witness-s3.tsv")
        ? readFileSync(f, "utf8").replace(
            "claim\tmaxEdgeHTM\t4",
            "claim\tmaxEdgeHTM\t3",
          )
        : readFileSync(f, "utf8"),
    ),
  );
});

// ------------------------------------- interrupted routes and pose collisions

/**
 * Independent oracle: every (edge, offset) whose pose equals `state`, found by
 * replaying the words, and the least HTM to a node showing `value` from any of
 * them (undo the offset, or finish the edge, then walk either way round).
 */
function interruptOracle(run) {
  const W = run.words.map((w) => parseAlg(w)),
    L = W.map((w) => w.length),
    n = W.length,
    at = new Map();
  let s = applyMoves(initialState(s3.print), parseAlg(run.setup));
  W.forEach((w, i) => {
    for (let o = 0; o < w.length; o++) {
      const k = poseKey(s);
      at.set(k, [...(at.get(k) ?? []), [i, o]]);
      s = applyMoves(s, [w[o]]);
    }
  });
  const walk = (a, t) => {
    let f = 0,
      b = 0;
    for (let k = a; k !== t; k = (k + 1) % n) f += L[k];
    for (let k = a; k !== t; k = (k - 1 + n) % n) b += L[(k - 1 + n) % n];
    return Math.min(f, b);
  };
  return {
    places: (state) => at.get(poseKey(state)) ?? [],
    best(state, value) {
      let best = Infinity;
      for (const [e, o] of at.get(poseKey(state)) ?? [])
        for (let t = value; t < n; t += 60)
          best = Math.min(
            best,
            o + walk(e, t),
            o === 0 ? Infinity : L[e] - o + walk((e + 1) % n, t),
          );
      return best;
    },
  };
}
/** Count one step from `from` in `direction`, interrupted after `k` turns by `target`. */
async function interrupted(letter, from, direction, k, target) {
  let turns = 0,
    c,
    mid = null;
  const played = [];
  const view = {
    configure() {},
    resetCamera() {},
    animate: async (pr) => {
      played.push(serializeMove(pr.move));
      if (++turns === k) {
        mid = pr.to;
        c.request(target);
      }
    },
  };
  c = new MsController(view, s3, {}, letter, () => {}, assets);
  await c.configure(from);
  c.request((from + direction + 60) % 60);
  await settled(c);
  return { c, mid, played, after: c.progress.sessionTotal - k };
}

test("S3 research words share interior poses across steps", () => {
  // Words often cancel across step boundaries, so one pose lies inside
  // several steps; the planner must consider all of them.
  for (const letter of ["M", "S"]) {
    const o = interruptOracle(s3.runs[letter]);
    const period = new MsPeriod(s3.print, s3.runs[letter]);
    let shared = 0;
    period.words.forEach((w, i) => {
      let s = period.nodes[i];
      for (let j = 1; j < w.length; j++) {
        s = applyMoves(s, [w[j - 1]]);
        if (o.places(s).length > 1) shared++;
      }
    });
    assert.ok(shared > 0, `${letter} has shared interior poses`);
  }
});

test("an interrupted S3 step undoes one turn instead of walking a detour", async () => {
  // M 00 -> 01 is "R' B' R"; after its first turn the target becomes 00 again:
  // the least continuation is the inverse of that one turn.
  const w = s3.runs.M.words[0];
  assert.equal(w, "R' B' R");
  let r = await interrupted("M", 0, 1, 1, 0);
  assert.deepEqual(r.played, ["R'", "R"]);
  assert.equal(r.c.currentValue, 0);
  assert.equal(r.c.node, 0);
  // Target 59 instead: undo the turn, then the 59 -> 00 word inverted.
  r = await interrupted("M", 0, 1, 1, 59);
  assert.deepEqual(
    r.played.join(" "),
    `R' R ${inverseWord(s3.runs.M.words[59])}`,
  );
  assert.equal(r.after, 1 + parseAlg(s3.runs.M.words[59]).length);
});

test("every interrupted S3 step continues with the least HTM over all shared poses", async () => {
  for (const letter of ["M", "S"]) {
    const run = s3.runs[letter],
      oracle = interruptOracle(run),
      words = run.words.map((w) => parseAlg(w));
    const turnsOf = new Set(words.flat().map((m) => serializeMove(m)));
    for (let from = 0; from < 60; from++)
      for (const direction of [1, -1])
        for (let k = 1; k < 4; k++) {
          const node = from,
            step =
              direction === 1
                ? words[node]
                : words[(node - 1 + words.length) % words.length];
          if (k >= step.length) continue;
          for (const second of [0, 2, -1, 5]) {
            const target = (from + direction * second + 120) % 60;
            const r = await interrupted(letter, from, direction, k, target);
            const label = `${letter} ${from} ${direction > 0 ? "+" : "-"} k${k} -> ${target}`;
            assert.ok(r.mid, label);
            assert.equal(r.after, oracle.best(r.mid, target), label);
            assert.equal(r.c.currentValue, target, label);
            assert.ok(r.c.node >= 0 && r.c.node % 60 === target, label);
            // Every played turn is a turn of a saved step (or its inverse).
            for (const t of r.played)
              assert.ok(
                turnsOf.has(t) || turnsOf.has(inverseWord(t)),
                `${label}: ${t}`,
              );
          }
        }
  }
});
