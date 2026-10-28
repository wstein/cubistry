/** Scoped 3×3 calendar mechanics. The shared size-2 library keeps its contract. */
export type V = readonly [number, number, number];
export interface Sticker {
  readonly id: number;
  readonly cubie: number;
  readonly p: V;
  readonly n: V;
  readonly up: V;
  readonly image: string;
  readonly slot: number;
}
export type State = readonly Sticker[];
export interface Target {
  readonly weekday: number;
  readonly day: number;
  readonly month: number;
  readonly cells: readonly string[];
  readonly word: string;
}
export interface Design {
  readonly schema: string;
  readonly version: number;
  readonly id: string;
  readonly printing: State;
  readonly targets: readonly Target[];
}
export const eq = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
export const dot = (a: V, b: V): number =>
  a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export const faces: Record<string, readonly [number, number | null, number]> = {
  R: [0, 1, -1],
  L: [0, -1, 1],
  U: [1, 1, -1],
  D: [1, -1, 1],
  F: [2, 1, -1],
  B: [2, -1, 1],
  x: [0, null, -1],
  y: [1, null, -1],
  z: [2, null, -1],
};
export function tokens(word: string): string[] {
  const t = word.split(/\s+/).filter(Boolean);
  demand(
    t.every((t) => /^[RLUDFBxyz](2|')?$/.test(t)),
    "Illegal calendar move",
  );
  return t;
}
export function moveInfo(token: string): {
  axis: number;
  layer: number | null;
  turns: number;
} {
  demand(tokens(token).length === 1, "Expected one calendar move");
  const [axis, layer, dir] = faces[token[0]];
  return {
    axis,
    layer,
    turns: dir * (token.endsWith("2") ? 2 : token.endsWith("'") ? -1 : 1),
  };
}
const quarter = (v: V, axis: number): V => {
  const [x, y, z] = v;
  return [
    [x, -z, y],
    [z, y, -x],
    [-y, x, z],
  ][axis].map((n) => (n === 0 ? 0 : n)) as unknown as V;
};
export function apply(state: State, word: string): State {
  for (const token of tokens(word)) {
    const { axis, layer, turns } = moveInfo(token),
      q = (turns + 4) % 4;
    state = state.map((s) => {
      if (layer !== null && s.p[axis] !== layer) return s;
      let { p, n, up } = s;
      for (let i = 0; i < q; i++) {
        p = quarter(p, axis);
        n = quarter(n, axis);
        up = quarter(up, axis);
      }
      return { ...s, p, n, up };
    });
  }
  return state;
}
export const sameState = (a: State, b: State): boolean =>
  a.length === b.length &&
  a.every(
    (s, i) =>
      s.id === b[i].id &&
      s.cubie === b[i].cubie &&
      s.image === b[i].image &&
      eq(s.p, b[i].p) &&
      eq(s.n, b[i].n) &&
      eq(s.up, b[i].up),
  );
export function inverse(word: string): string {
  return tokens(word)
    .reverse()
    .map((t) => (t.endsWith("2") ? t : t.endsWith("'") ? t[0] : t + "'"))
    .join(" ");
}
export function simplify(word: string): string {
  const out: string[] = [];
  for (const t of tokens(word)) {
    const p = out.at(-1);
    if (p?.[0] === t[0]) {
      out.pop();
      const v =
          (p.endsWith("2") ? 2 : p.endsWith("'") ? 3 : 1) +
          (t.endsWith("2") ? 2 : t.endsWith("'") ? 3 : 1),
        n = v % 4;
      if (n) out.push(t[0] + (n === 2 ? "2" : n === 3 ? "'" : ""));
    } else out.push(t);
  }
  return out.join(" ");
}
export function front(state: State): Sticker[] {
  return [1, 0, -1].flatMap((y) =>
    [-1, 0, 1].map((x) => {
      const s = state.find((s) => eq(s.p, [x, y, 1]) && eq(s.n, [0, 0, 1]));
      demand(s, "Missing calendar front sticker");
      return s;
    }),
  );
}
export function matches(state: State, cells: readonly string[]): boolean {
  return front(state).every(
    (s, i) => s.image === cells[i] && (!s.image || eq(s.up, [0, 1, 0])),
  );
}
const frozen = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
};
export function validateDesign(raw: unknown): Design {
  const d = raw as Design;
  demand(
    d?.schema === "cubistry.calendar-runtime" &&
      d.version === 1 &&
      ["de-a", "en-3-zero", "en-3-unpadded"].includes(d.id),
    "Invalid calendar runtime",
  );
  demand(
    Array.isArray(d.printing) &&
      d.printing.length === 54 &&
      Array.isArray(d.targets) &&
      d.targets.length === 2562,
    "Incomplete calendar runtime",
  );
  const positions = new Set<string>(),
    planes = new Set<string>();
  for (const [i, s] of d.printing.entries()) {
    const lattice = (v: V) =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => Number.isInteger(n) && Math.abs(n) <= 1);
    demand(
      s.id === i &&
        Number.isInteger(s.cubie) &&
        s.cubie >= 0 &&
        s.cubie < 26 &&
        lattice(s.p) &&
        lattice(s.n) &&
        lattice(s.up),
      "Invalid calendar source geometry",
    );
    demand(
      dot(s.n, s.n) === 1 &&
        dot(s.up, s.up) === 1 &&
        dot(s.n, s.up) === 0 &&
        dot(s.p, s.n) === 1,
      "Invalid calendar sticker frame",
    );
    demand(
      typeof s.image === "string" &&
        /^[A-ZÄÖÜ0-9]{0,3}$/.test(s.image) &&
        Number.isInteger(s.slot) &&
        s.slot >= -1 &&
        s.slot <= 8,
      "Invalid permanent calendar image",
    );
    const body = d.printing.filter((t) => t.cubie === s.cubie);
    demand(
      body.every((t) => eq(t.p, s.p)),
      "Split calendar body",
    );
    positions.add(JSON.stringify(s.p));
    const key = JSON.stringify([s.p, s.n]);
    demand(!planes.has(key), "Duplicate calendar plane");
    planes.add(key);
  }
  demand(
    positions.size === 26 &&
      new Set(d.printing.map((s) => s.cubie)).size === 26,
    "Missing calendar bodies",
  );
  const keys = new Set<string>();
  for (const t of d.targets) {
    demand(
      Number.isInteger(t.weekday) &&
        t.weekday >= 0 &&
        t.weekday < 7 &&
        Number.isInteger(t.day) &&
        t.day >= 1 &&
        t.day <= 31 &&
        Number.isInteger(t.month) &&
        t.month >= 1 &&
        t.month <= 12 &&
        Array.isArray(t.cells) &&
        t.cells.length === 9 &&
        t.cells.every((s: unknown) => typeof s === "string"),
      "Invalid calendar target",
    );
    const key = targetKey(t);
    demand(!keys.has(key), "Duplicate calendar target");
    keys.add(key);
    tokens(t.word);
  }
  return frozen(d);
}
export const targetKey = (
  t: Pick<Target, "weekday" | "month" | "day">,
): string => `${t.weekday}/${t.month}/${t.day}`;
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly weekday: number;
  readonly iso: string;
}
export function civilDate(iso: string): CivilDate {
  demand(/^\d{4}-\d{2}-\d{2}$/.test(iso), "Use YYYY-MM-DD");
  const [year, month, day] = iso.split("-").map(Number),
    d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(0, 0, 0, 0);
  demand(
    year >= 1 &&
      year <= 9999 &&
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day,
    "Invalid Gregorian date",
  );
  return { year, month, day, weekday: (d.getUTCDay() + 6) % 7, iso };
}
export function localDate(epoch: number): CivilDate {
  const d = new Date(epoch);
  return civilDate(
    `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  );
}
const targetIndexes = new WeakMap<Design, Map<string, Target>>();
export function findTarget(design: Design, date: CivilDate): Target {
  let index = targetIndexes.get(design);
  if (!index) {
    index = new Map(design.targets.map((t) => [targetKey(t), t]));
    targetIndexes.set(design, index);
  }
  const t = index.get(targetKey(date));
  demand(t, "Date is missing from the verified calendar");
  return t;
}
export function sourcePose(design: Design, t: Target): State {
  const state = apply(design.printing, t.word);
  demand(matches(state, t.cells), "Calendar route failed its visible target");
  return state;
}
