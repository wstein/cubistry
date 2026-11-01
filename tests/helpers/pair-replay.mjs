// Independent replay for the two-cube pair tests. It reads the converted
// runtime data (public/ms-counter.v1.json, public/hsm-counter.v3.json) as raw
// JSON and keeps its own sticker model with integer quarter-turn rotations
// (fixed frame, front +z, up +y; a quarter turn of a face is -side * 90
// degrees about its axis, as in the research checkers). It shares no code with
// the application's cube mechanics, the controllers or their periods.
import { readFileSync } from "node:fs";

const FACES = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function rotate(v, e, k) {
  const q = ((k % 4) + 4) % 4,
    c = [1, 0, -1, 0][q],
    s = [0, 1, 0, -1][q],
    x = cross(e, v),
    d = dot(e, v);
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + e[i] * d * (1 - c) + 0);
}
/** Parse one token of the outer-face notation (R, R', R2, ...); anything else throws. */
export function parseToken(token) {
  if (!/^[RLUDFB](2|')?$/.test(token)) throw Error(`illegal move ${JSON.stringify(token)}`);
  const [axis, side] = FACES[token[0]];
  return { axis, side, amount: token.length === 1 ? 1 : token[1] === "2" ? 2 : -1 };
}
export const tokens = (word) => (word === "" || word === "-" ? [] : word.trim().split(/\s+/));
export const htm = (word) => tokens(word).length;
export const inverseWord = (word) =>
  tokens(word)
    .reverse()
    .map((m) => (m.endsWith("'") ? m[0] : m.endsWith("2") ? m : m + "'"))
    .join(" ");

export function turn(state, token) {
  const { axis, side, amount } = parseToken(token),
    e = [0, 0, 0];
  e[axis] = 1;
  const k = -side * amount;
  return state.map((s) =>
    s.p[axis] === side ? { ...s, p: rotate(s.p, e, k), n: rotate(s.n, e, k), up: rotate(s.up, e, k) } : s,
  );
}
export const play = (state, word) => tokens(word).reduce(turn, state);
/** Full pose, hidden stickers included. */
export const key = (state) => JSON.stringify(state.map((s) => [s.id, s.p, s.n, s.up]));

const CELLS = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** Front reads [blank, letter, tens, ones]; the blank in any orientation, glyphs upright. */
export function shows(state, letter, value) {
  const want = ["", letter, ...String(value).padStart(2, "0")];
  return want.every((glyph, c) => {
    const seen = state.filter((s) => same(s.p, CELLS[c]) && same(s.n, [0, 0, 1]));
    if (seen.length !== 1) return false;
    const [s] = seen;
    return glyph === "" ? s.image === "" : s.image === glyph && same(s.up, [0, 1, 0]);
  });
}
const solved = (printing) =>
  printing.map(({ id, p, n, up, image }) => ({ id, p: [...p], n: [...n], up: [...up], image }));

/**
 * One counting period replayed independently: node poses, the words between
 * them, and every pose on the period (nodes and edge interiors) for the
 * "never leaves the saved period" check.
 */
function replayPeriod(printing, setup, words, valueOf, letter) {
  let state = play(solved(printing), setup);
  const nodes = [],
    onPeriod = new Set();
  words.forEach((word, i) => {
    if (!shows(state, letter, valueOf(i))) throw Error(`${letter} node ${i} does not show ${valueOf(i)}`);
    nodes.push(state);
    for (const t of tokens(word)) {
      onPeriod.add(key(state));
      state = turn(state, t);
    }
  });
  if (key(state) !== key(nodes[0])) throw Error(`${letter} period does not close`);
  return { nodes, words, onPeriod, nodeIndex: new Map(nodes.map((s, i) => [key(s), i])) };
}

/** S3 (research PR #138) from the converted runtime: one period per letter, walked both ways. */
export function loadS3Replay(path = "public/ms-counter.v1.json") {
  const raw = JSON.parse(readFileSync(path, "utf8")),
    { printing, runs } = raw.print,
    periods = {};
  for (const run of runs) periods[run.letter] = replayPeriod(printing, run.setup, run.words, (i) => i % 60, run.letter);
  return {
    printing,
    periods,
    runs: Object.fromEntries(runs.map((r) => [r.letter, r])),
    /** MsController.configure(value) installs the first-lap node. */
    start: (letter, value) => periods[letter].nodes[value],
  };
}

/** The HSM seconds-first print from the converted runtime: one period per letter, range and direction. */
export function loadHsmReplay(path = "public/hsm-counter.v3.json") {
  const raw = JSON.parse(readFileSync(path, "utf8")),
    periods = new Map();
  for (const p of raw.periods) {
    const n = p.maximum + 1;
    periods.set(
      `${p.letter}/${p.maximum}/${p.direction}`,
      replayPeriod(raw.printing, p.setup, p.words, (i) => (((p.direction * i) % n) + n) % n, p.letter),
    );
  }
  const period = (letter, maximum, direction) => periods.get(`${letter}/${maximum}/${direction}`);
  return {
    printing: raw.printing,
    period,
    /** HsmController.configure(value) installs the first node of the mode's period that shows `value`. */
    start(letter, maximum, direction, value) {
      const e = period(letter, maximum, direction);
      return e.nodes.find((s) => shows(s, letter, value));
    },
  };
}

/** An independent model of one physical cube, fed by the moves the viewer is asked to animate. */
export class ReplayCube {
  constructor(state, serialize) {
    this.state = state;
    this.serialize = serialize;
    this.played = [];
  }
  apply(move) {
    const token = this.serialize(move);
    this.state = turn(this.state, token);
    this.played.push(token);
    return token;
  }
  /** Moves since the last call. */
  take() {
    const out = this.played.join(" ");
    this.played = [];
    return out;
  }
}
