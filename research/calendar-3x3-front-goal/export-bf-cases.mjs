// usage: node export-bf-cases.mjs <out.tsv> [maxScrambleLength=7]
// Brute-force optima without the Julia solver. Moves are derived from the app's own `apply` (one probe sticker per
// frame), the state is a vector of frame ids, and every candidate goal is confirmed with the app's `matches`.
// Search: iterative deepening over the 18 outer turns, no rotations; same face twice in a row is skipped and
// opposite faces are tried in one order only (both are valid reductions). Scrambles contain opposite-face pairs.
import { writeFileSync } from "node:fs";
import { loadApp, loadDesign, PRINTS } from "./lib.mjs";
const [out, maxS = "7"] = process.argv.slice(2);
const { model } = await loadApp();
const MOVES = [..."RLUDFB"].flatMap((f) => [f, f + "2", f + "'"]);
const fkey = (s) => `${s.p}|${s.n}|${s.up}`;
const frames = [], index = new Map();
const id = (s) => { const k = fkey(s); if (!index.has(k)) { index.set(k, frames.length); frames.push({ p: s.p, n: s.n, up: s.up }); } return index.get(k); };
const probe = (s) => ({ id: 0, cubie: 0, image: "", slot: 0, ...s });
// close the frame set under all tokens (rotations too, the scrambles contain them), then tabulate the 18 turns
const ALL = [...MOVES, ..."xyz"].flatMap((t) => (/[xyz]/.test(t) ? [t, t + "'", t + "2"] : [t]));
for (const p of PRINTS) for (const s of loadDesign(model, p).printing) id(s);
for (let i = 0; i < frames.length; i++) for (const m of ALL) id(model.apply([probe(frames[i])], m)[0]);
const table = MOVES.map((m) => Int32Array.from(frames.map((f) => id(model.apply([probe(f)], m)[0]))));
const face = (m) => "RLUDFB".indexOf(m[0]);
function solve(design, cells, state, maxd) {
  const toState = (ids) => design.printing.map((s, i) => ({ ...s, ...frames[ids[i]] }));
  const quick = (ids) => {
    const slots = [1, 0, -1].flatMap((y) => [-1, 0, 1].map((x) => [x, y, 1]));
    return slots.every((p, j) => {
      for (let i = 0; i < 54; i++) {
        const f = frames[ids[i]];
        if (f.p[0] === p[0] && f.p[1] === p[1] && f.p[2] === 1 && f.n[2] === 1)
          return design.printing[i].image === cells[j] && (!cells[j] || (f.up[0] === 0 && f.up[1] === 1 && f.up[2] === 0));
      }
      return false;
    });
  };
  const path = [];
  const dfs = (ids, d, last) => {
    if (d === 0) return quick(ids) && model.matches(toState(ids), cells);
    for (let m = 0; m < 18; m++) {
      const f = face(MOVES[m]);
      if (f === last) continue;
      if (last >= 0 && last % 2 === 1 && f === last - 1) continue; // L after R etc. skipped
      const next = ids.map((x) => table[m][x]);
      path.push(MOVES[m]);
      if (dfs(next, d - 1, f)) return true;
      path.pop();
    }
    return false;
  };
  for (let d = 0; d <= maxd; d++) { path.length = 0; if (dfs(state, d, -1)) return { opt: d, word: path.join(" ") }; }
  return null;
}
let seedv = 777;
const rnd = () => { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 2 ** 32; };
const rows = ["# print\tcells\tscramble_word\tscramble_length\tbf_opt\tbf_word"];
const pairs = ["R L", "L R", "U D", "D U", "F B", "B F", "R' L2", "U2 D'", "F' B"];
for (const pid of PRINTS) {
  const design = loadDesign(model, pid);
  const ts = design.targets.filter((_, i) => i % 211 === 0);
  for (let c = 0; c < 10; c++) {
    const t = ts[(c * 3 + PRINTS.indexOf(pid)) % ts.length];
    const k = 3 + (c % (Number(maxS) - 2)); // 3..maxS
    const extra = Array.from({ length: Math.max(0, k - 2) }, () => MOVES[Math.floor(rnd() * 18)]);
    const word = [pairs[Math.floor(rnd() * pairs.length)], ...extra].join(" ");
    const pose = model.apply(design.printing, t.word + " " + word);
    const ids = pose.map((s) => id(s));
    const r = solve(design, t.cells, ids, k);
    rows.push([pid, t.cells.join("|"), t.word + " " + word, word.split(" ").length, r ? r.opt : "none", r ? r.word : ""].join("\t"));
    console.error(pid, c, r && r.opt, r && r.word);
  }
}
writeFileSync(out, rows.join("\n") + "\n");
