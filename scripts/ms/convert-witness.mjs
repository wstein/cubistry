// Deterministic converter: research M/S witness (TSV, cubistry.ms-counter.v1,
// research PR #138) into one print entry of the application runtime
// public/ms-counter.v1.json.
//
// The converter is pure: the same TSV bytes and metadata always give the same
// JSON. It replays the witness with its own integer rotation model (independent
// of the app's cube-mechanics) and refuses data that does not show the
// required displays, does not close at the claimed (minimal) period, uses a
// run-in, or disagrees with the native receipts. It is a data-integrity gate,
// not a proof; proof status is governed by proof-checkers/AUTHORITY.md.
import { createHash } from "node:crypto";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const fail = (why) => {
  throw Error(`M/S witness: ${why}`);
};
const need = (ok, why) => ok || fail(why);

// ---- integer rotation model (fixed frame, front +z, up +y) ----
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** k quarter turns about unit axis e (Rodrigues with integer cos/sin). */
function turn(v, e, k) {
  const q = ((k % 4) + 4) % 4,
    c = [1, 0, -1, 0][q],
    s = [0, 1, 0, -1][q],
    x = cross(e, v),
    d = dot(e, v);
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + e[i] * d * (1 - c) + 0);
}
const FACES = {
  R: [0, 1],
  L: [0, -1],
  U: [1, 1],
  D: [1, -1],
  F: [2, 1],
  B: [2, -1],
};
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
// A quarter turn of a face is -side * 90 degrees about its axis, as in the
// research checkers.
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
const stateKey = (state) => JSON.stringify(state.map((s) => [s.p, s.n, s.up]));

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

/** Receipt lines this converter cross-checks, per letter. */
export function parseReceipt(text) {
  const rows = text
    .trimEnd()
    .split("\n")
    .map((r) => r.split("\t"));
  need(rows[0][0] === "cubistry.ms-counter.receipt.v1", "receipt schema");
  need(rows.at(-1).join("\t") === "verdict\tACCEPT", "receipt verdict ACCEPT");
  const witness = rows.find((r) => r[0] === "witness-sha256")?.[1];
  const runs = {};
  const at = (letter) => (runs[letter] ??= {});
  for (const r of rows) {
    if (r[0] === "run")
      Object.assign(at(r[1]), {
        period: Number(r[3]),
        runin: Number(r[5]),
        edges: Number(r[7]),
        total: Number(r[9]),
        max: Number(r[11]),
      });
    if (r[0] === "decrement")
      Object.assign(at(r[1]), { decrement: `${r[3]}/${r[5]}` });
    if (r[0] === "setup")
      Object.assign(at(r[1]), {
        setupHTM: Number(r[3]),
        setup: r[5] === "-" ? "" : r[5],
      });
  }
  return { witness, runs };
}

/** One corner per triple (stickers on its x, y and z faces), README notation. */
function printCode(printing) {
  return [...new Set(printing.map((s) => s.cubie))]
    .sort((a, b) => a - b)
    .map((c) =>
      printing
        .filter((s) => s.cubie === c)
        .sort(
          (a, b) =>
            a.n.findIndex((v) => v !== 0) - b.n.findIndex((v) => v !== 0),
        )
        .map((s) =>
          s.image === ""
            ? "_"
            : /[MS]/.test(s.image)
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
}

/**
 * Convert one witness TSV into a runtime print entry. `receipts` are the two
 * native receipts and `checks` the research checks file, all cross-checked.
 */
export function convertWitness(tsv, { id, label, path, receipts, checks }) {
  need(!tsv.includes("\r") && tsv.endsWith("\n"), "LF-only text");
  const rows = tsv.slice(0, -1).split("\n");
  need(rows[0] === "cubistry.ms-counter.v1", "schema header v1");
  need(rows[1] === "profile\tblank", "blank profile");
  need(rows[2] === "letters\tMS", "letters MS");
  const vec = (t) => t.split(",").map(Number);
  const printing = rows.slice(3, 27).map((r, i) => {
    const f = r.split("\t");
    need(
      f.length === 7 && f[0] === "sticker" && Number(f[1]) === i,
      "sticker rows in id order",
    );
    need(/^[MS0-9_]$/.test(f[6]), "glyph alphabet M, S, 0-9, _");
    return {
      id: i,
      cubie: Number(f[2]),
      p: vec(f[3]),
      n: vec(f[4]),
      up: vec(f[5]),
      image: f[6] === "_" ? "" : f[6],
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
    if (/^[MS]$/.test(s.image))
      need(s.slot === 1, `letter ${s.id} upright at upper-right`);
  const ordered = printing.map(({ id, cubie, p, n, up, slot, image }) => ({
    id,
    cubie,
    p,
    n,
    up,
    slot,
    image,
  }));

  const runs = [];
  let r = 27;
  for (const letter of ["M", "S"]) {
    const f = rows[r++].split("\t");
    need(
      f.length === 6 &&
        f[0] === "run" &&
        f[1] === letter &&
        f[2] === "setup" &&
        f[4] === "period",
      `run row ${letter}`,
    );
    const setup = f[3] === "-" ? "" : f[3],
      laps = Number(f[5]);
    need(Number.isInteger(laps) && laps >= 1, `${letter}: whole laps`);
    const start = apply(ordered, setup);
    need(shows(start, letter, 0), `${letter}: setup shows 00`);
    let state = start;
    const words = [],
      lowerBounds = [],
      seen = new Set([stateKey(start)]);
    for (let j = 0; j < 60 * laps; j++) {
      const g = rows[r++].split("\t"),
        from = j % 60,
        to = (j + 1) % 60;
      need(
        g.length === 7 &&
          g[0] === "edge" &&
          g[1] === letter &&
          Number(g[2]) === j &&
          Number(g[3]) === from &&
          Number(g[4]) === to,
        `edge row ${letter} ${j}`,
      );
      const word = g[5],
        moves = parseWord(word);
      need(moves.length > 0, "every edge turns");
      const previous = state;
      state = apply(state, word);
      need(shows(state, letter, to), `${letter} edge ${j} shows ${to}`);
      need(
        stateKey(apply(state, inverseWord(word))) === stateKey(previous),
        `${letter} edge ${j}: inverse word returns exactly`,
      );
      if (j < 60 * laps - 1) {
        need(!seen.has(stateKey(state)), `${letter}: period revisits a pose`);
        seen.add(stateKey(state));
      }
      // Minimal period: no earlier lap boundary returns to the start.
      if (to === 0 && j < 60 * laps - 1)
        need(
          stateKey(state) !== stateKey(start),
          `${letter}: closes before the claimed period`,
        );
      words.push(word);
      lowerBounds.push(Number(g[6]));
    }
    need(
      stateKey(state) === stateKey(start),
      `${letter}: exact full-state closure`,
    );
    const lengths = words.map((w) => parseWord(w).length);
    runs.push({
      letter,
      setup,
      setupHTM: parseWord(setup).length,
      laps,
      periodEdges: 60 * laps,
      periodHTM: lengths.reduce((a, b) => a + b, 0),
      maximumHTM: Math.max(...lengths),
      histogram: histogram(lengths),
      words,
      lowerBounds,
    });
  }
  const claim = rows[r++].split("\t");
  need(claim[0] === "claim" && claim[1] === "maxEdgeHTM", "claim row");
  const maximumHTM = Math.max(...runs.map((m) => m.maximumHTM));
  need(Number(claim[2]) === maximumHTM, "claimed maximum equals replay");
  need(rows[r] === "end" && r === rows.length - 1, "end row");

  // Cross-check the native receipts and the research checks file.
  const digest = sha256(tsv);
  need(
    receipts.julia === receipts.flix,
    "Julia and Flix receipts byte-identical",
  );
  const receipt = parseReceipt(receipts.julia);
  need(receipt.witness === digest, "receipt names this witness");
  for (const m of runs) {
    const got = receipt.runs[m.letter];
    need(
      got &&
        got.period === m.laps &&
        got.runin === 0 &&
        got.edges === m.periodEdges &&
        got.total === m.periodHTM &&
        got.max === m.maximumHTM &&
        got.decrement === `${m.periodEdges}/exact` &&
        got.setupHTM === m.setupHTM &&
        got.setup === m.setup,
      `receipt agrees on ${m.letter}`,
    );
  }
  const identical = checks.split("\n")[0].split("\t");
  need(
    identical[0] === "receipts" &&
      identical[1] === "IDENTICAL" &&
      identical[2] === sha256(receipts.julia),
    "checks file records the identical receipt digest",
  );
  const negatives = checks.trimEnd().split("\n").slice(1);
  need(
    negatives.length > 0 &&
      negatives.every((l) =>
        /^negative\t[^\t]+\t(julia|flix)\tREJECTED\t/.test(l),
      ),
    "every negative control rejected by both checkers",
  );
  const controls = new Set(negatives.map((l) => l.split("\t")[1]));
  const message = (c, checker) =>
    negatives
      .map((l) => l.split("\t"))
      .find((f) => f[1] === c && f[2] === checker)?.[4];
  for (const c of controls)
    need(
      message(c, "julia") !== undefined &&
        message(c, "julia") === message(c, "flix"),
      `control ${c}: both checkers reject with the same message`,
    );

  return {
    id,
    label,
    printId: `ms_counter_${id}`,
    witnessPath: path,
    witnessSHA256: digest,
    receiptSHA256: sha256(receipts.julia),
    negativeControls: controls.size,
    printCode: printCode(ordered),
    maximumHTM,
    printing: ordered,
    runs,
  };
}
export const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
