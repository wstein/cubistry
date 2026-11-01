// Deterministic converter: research H/M witness (TSV, cubistry.hm-counter.v2)
// into the application's modes witness JSON (cubistry.hm-counter-modes).
//
// The converter is pure: the same TSV bytes and source metadata always give
// the same JSON text. It replays the witness with its own integer rotation
// model (independent of the app's cube-mechanics) and refuses data that does
// not show the required displays, does not close, or uses a run-in. It is a
// data-integrity gate, not a proof; the research checkers are the authority.
import { createHash } from "node:crypto";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const fail = (why) => {
  throw Error(`H/M witness: ${why}`);
};
const need = (ok, why) => ok || fail(why);

// ---- integer rotation model (fixed frame, front +z, up +y) ----
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** k quarter turns about unit axis e, counterclockwise seen from +e. */
function turn(v, e, k) {
  const q = ((k % 4) + 4) % 4,
    c = [1, 0, -1, 0][q],
    s = [0, 1, 0, -1][q],
    x = cross(e, v),
    d = dot(e, v);
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + e[i] * d * (1 - c) + 0);
}
const FACES = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };
export function parseWord(word) {
  if (word === "-" || word === "") return [];
  return word.split(" ").map((t) => {
    need(/^[RLUDFB](2|')?$/.test(t), `illegal move token ${JSON.stringify(t)}`);
    const [axis, side] = FACES[t[0]];
    return { axis, side, amount: t.length === 1 ? 1 : t[1] === "2" ? 2 : -1 };
  });
}
/** Inverse of a word in the research notation: reversed, each turn undone. */
export const inverseWord = (word) =>
  word
    .split(" ")
    .reverse()
    .map((m) => (m.endsWith("'") ? m[0] : m.endsWith("2") ? m : m + "'"))
    .join(" ");
function move(state, { axis, side, amount }) {
  const e = [0, 0, 0];
  e[axis] = 1;
  const k = -side * amount;
  return state.map((s) =>
    s.p[axis] === side
      ? { ...s, p: turn(s.p, e, k), n: turn(s.n, e, k), up: turn(s.up, e, k) }
      : s,
  );
}
const apply = (state, word) => parseWord(word).reduce(move, state);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stateKey = (state) =>
  JSON.stringify(state.map((s) => [s.p, s.n, s.up]));

/** Front cells: upper-left, upper-right, lower-left, lower-right. */
export const CELLS = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
const MOVES = Object.keys(FACES).flatMap((f) =>
  ["", "2", "'"].map((m) => parseWord(f + m)[0]),
);
/** The 24 sticker frames that can turn into upright front cell `c`. */
function cellOrbit(c) {
  const seed = { p: CELLS[c], n: [0, 0, 1], up: [0, 1, 0] };
  const seen = new Map([[JSON.stringify(seed), seed]]);
  const queue = [seed];
  for (let i = 0; i < queue.length; i++)
    for (const m of MOVES) {
      const [q] = move([queue[i]], m),
        k = JSON.stringify(q);
      if (!seen.has(k)) {
        seen.set(k, q);
        queue.push(q);
      }
    }
  need(seen.size === 24, "24 frames per front cell");
  return new Set(seen.keys());
}
const ORBITS = CELLS.map((_, c) => cellOrbit(c));
const slotOf = (s) => {
  const k = JSON.stringify({ p: s.p, n: s.n, up: s.up }),
    hits = ORBITS.flatMap((o, c) => (o.has(k) ? [c] : []));
  need(hits.length === 1, `sticker ${s.id} has no unique front cell`);
  return hits[0];
};

function shows(state, letter, value) {
  const want = ["", letter, ...String(value).padStart(2, "0")];
  return want.every((glyph, c) => {
    const seen = state.filter(
      (s) => same(s.p, CELLS[c]) && same(s.n, [0, 0, 1]),
    );
    if (seen.length !== 1) return false;
    const [s] = seen;
    // A blank reads as blank in every orientation.
    return glyph === ""
      ? s.image === ""
      : s.image === glyph && same(s.up, [0, 1, 0]);
  });
}

const histogram = (lengths) => {
  const h = {};
  for (let d = 1; d <= Math.max(...lengths); d++)
    h[d] = lengths.filter((x) => x === d).length;
  return h;
};

/**
 * Parse the receipt lines this converter cross-checks: per mode, the setup,
 * preperiod and period edge counts, and the period total and maximum.
 */
export function parseReceipt(text) {
  const rows = text.trimEnd().split("\n").map((r) => r.split("\t"));
  need(rows[0][0] === "cubistry.hm-counter.receipt.v2", "receipt schema");
  need(rows.at(-1).join("\t") === "verdict\tACCEPT", "receipt verdict ACCEPT");
  const witness = rows.find((r) => r[0] === "witness-sha256")?.[1];
  const modes = {};
  for (const r of rows) {
    if (r[0] === "mode")
      modes[`${r[1]}${r[2]}`] = {
        ...modes[`${r[1]}${r[2]}`],
        setupHTM: Number(r[4]),
        preperiod: Number(r[6]),
        period: Number(r[8]),
        laps: Number(r[10]),
      };
    if (r[0] === "period")
      modes[`${r[1]}${r[2]}`] = {
        ...modes[`${r[1]}${r[2]}`],
        total: Number(r[4]),
        max: Number(r[6]),
        closure: r.at(-1),
      };
    if (r[0] === "decrement")
      modes[`${r[1]}${r[2]}`] = { ...modes[`${r[1]}${r[2]}`], decrement: r[4] };
  }
  return { witness, modes };
}

/**
 * Convert the witness TSV. `source` names where the bytes came from
 * (repository, branch, commit, path); `receipts` are the two native receipts
 * and `checks` the research checks file, all cross-checked here.
 */
export function convertWitness(tsv, { source, receipts, checks, label }) {
  need(!tsv.includes("\r") && tsv.endsWith("\n"), "LF-only text");
  const rows = tsv.slice(0, -1).split("\n");
  need(rows[0] === "cubistry.hm-counter.v2", "schema header v2");
  need(rows[1] === "profile\tblank", "blank profile");
  need(rows[2] === "letters\tHM", "letters HM");
  const vec = (t) => t.split(",").map(Number);
  const printing = rows.slice(3, 27).map((r, i) => {
    const f = r.split("\t");
    need(f.length === 7 && f[0] === "sticker" && Number(f[1]) === i, "sticker rows in id order");
    need(/^[HM0-9_]$/.test(f[6]), "glyph alphabet H, M, 0-9, _");
    return {
      id: i,
      cubie: Number(f[2]),
      p: vec(f[3]),
      n: vec(f[4]),
      image: f[6] === "_" ? "" : f[6],
      up: vec(f[5]),
    };
  });
  for (const s of printing) {
    need(dot(s.p, s.n) === 1 && dot(s.n, s.up) === 0, "outward tangent frames");
    s.slot = slotOf(s);
  }
  need(
    new Set(printing.map((s) => JSON.stringify([s.p, s.n]))).size === 24,
    "complete 24-facelet lattice",
  );
  for (const s of printing)
    if (/^[HM]$/.test(s.image))
      need(s.slot === 1, `letter ${s.id} upright at upper-right`);
  const ordered = printing.map(({ id, cubie, p, n, slot, image, up }) => ({
    id,
    cubie,
    p,
    n,
    slot,
    image,
    up,
  }));
  // Print code: one triple per corner (stickers on its x, y and z faces).
  const code = [...new Set(ordered.map((s) => s.cubie))]
    .map((c) =>
      ordered
        .filter((s) => s.cubie === c)
        .sort(
          (a, b) =>
            a.n.findIndex((v) => v !== 0) - b.n.findIndex((v) => v !== 0),
        )
        .map((s) =>
          s.image === ""
            ? "_"
            : /[HM]/.test(s.image)
              ? s.image
              : s.slot === 2
                ? `T${s.image}`
                : s.slot === 3
                  ? `U${s.image}`
                  : fail(`digit ${s.id} not upright in a lower cell`),
        )
        .join(" "),
    )
    .join(" | ");

  const home = ordered;
  const modes = [];
  let r = 27;
  for (const [letter, maximum] of [
    ["M", 59],
    ["H", 23],
    ["H", 11],
  ]) {
    const f = rows[r++].split("\t");
    need(f.length === 6 && f[0] === "mode" && f[1] === letter && Number(f[2]) === maximum, `mode row ${letter}${maximum}`);
    const setup = f[3] === "-" ? "" : f[3],
      P = Number(f[4]),
      Q = Number(f[5]),
      n = maximum + 1;
    need(P === 0, `${letter}${maximum}: the application needs a period without run-in`);
    need(Q > 0 && Q % n === 0, `${letter}${maximum}: whole laps`);
    const start = apply(home, setup);
    need(shows(start, letter, 0), `${letter}${maximum}: setup shows 00`);
    let state = start;
    const steps = [],
      seen = new Set([stateKey(start)]);
    for (let j = 0; j < Q; j++) {
      const g = rows[r++].split("\t"),
        from = j % n,
        to = (j + 1) % n;
      need(
        g.length === 7 && g[0] === "step" && g[1] === letter && Number(g[2]) === maximum && Number(g[3]) === from && Number(g[4]) === to,
        `step row ${letter}${maximum} ${j}`,
      );
      const word = g[5],
        moves = parseWord(word);
      need(moves.length > 0, "every step turns");
      const previous = state;
      state = apply(state, word);
      need(shows(state, letter, to), `${letter}${maximum} step ${j} shows ${to}`);
      need(
        stateKey(apply(state, inverseWord(word))) === stateKey(previous),
        `${letter}${maximum} step ${j}: inverse word returns exactly`,
      );
      if (j < Q - 1) {
        need(!seen.has(stateKey(state)), `${letter}${maximum}: period revisits a pose`);
        seen.add(stateKey(state));
      }
      steps.push({ from, to, word, htm: moves.length, lowerBound: Number(g[6]) });
    }
    need(stateKey(state) === stateKey(start), `${letter}${maximum}: exact full-state closure`);
    const lengths = steps.map((s) => s.htm);
    modes.push({
      letter,
      maximum,
      direction: 1,
      setup,
      setupHTM: parseWord(setup).length,
      preperiodEdges: P,
      periodStart: 0,
      periodEdges: Q,
      laps: Q / n,
      periodHTM: lengths.reduce((a, b) => a + b, 0),
      maximumHTM: Math.max(...lengths),
      histogram: histogram(lengths),
      steps,
    });
  }
  const claim = rows[r++].split("\t");
  need(claim[0] === "claim" && claim[1] === "maxEdgeHTM", "claim row");
  const edgeLimit = Math.max(...modes.map((m) => m.maximumHTM));
  need(Number(claim[2]) === edgeLimit, "claimed maximum equals replay");
  need(rows[r] === "end" && r === rows.length - 1, "end row");

  // Cross-check the native receipts and the research checks file.
  const digest = sha256(tsv);
  need(receipts.julia === receipts.flix, "Julia and Flix receipts byte-identical");
  const receipt = parseReceipt(receipts.julia);
  need(receipt.witness === digest, "receipt names this witness");
  for (const m of modes) {
    const got = receipt.modes[`${m.letter}${m.maximum}`];
    need(
      got &&
        got.setupHTM === m.setupHTM &&
        got.preperiod === 0 &&
        got.period === m.periodEdges &&
        got.total === m.periodHTM &&
        got.max === m.maximumHTM &&
        got.closure === "exact" &&
        got.decrement === "exact",
      `receipt agrees on ${m.letter}${m.maximum}`,
    );
  }
  const identical = checks.split("\n")[0].split("\t");
  need(
    identical[0] === "receipts" && identical[1] === "IDENTICAL" && identical[2] === sha256(receipts.julia),
    "checks file records the identical receipt digest",
  );
  const negatives = checks.trimEnd().split("\n").slice(1);
  need(
    negatives.length > 0 && negatives.every((l) => /^negative\t[^\t]+\t(julia|flix)\tREJECTED\t/.test(l)),
    "every negative control rejected by both checkers",
  );

  const appModes = modes.flatMap((m) =>
    [1, -1].map((direction) => ({
      letter: m.letter,
      maximum: m.maximum,
      direction,
      sourceDirection: 1,
      traversal: direction === 1 ? "forward" : "inverse",
      periodHTM: m.periodHTM,
      periodEdges: m.periodEdges,
      maximumHTM: m.maximumHTM,
    })),
  );
  return {
    schema: "cubistry.hm-counter-modes",
    version: 1,
    label,
    source: { ...source, sha256: digest },
    printCode: code,
    edgeLimitHTM: edgeLimit,
    receiptSHA256: sha256(receipts.julia),
    printing: ordered,
    modes,
    appModes,
  };
}
export const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
