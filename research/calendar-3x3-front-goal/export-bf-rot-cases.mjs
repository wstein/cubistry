// usage: node export-bf-rot-cases.mjs <out.tsv> [casesPerPrint=6] [maxDepth=5]
// Brute-force optima WITH free whole-cube rotations, without the Julia solver. Moves and rotations come from the app's
// own `apply` (one probe sticker per frame), every goal is confirmed with the app's `matches`.
// Search: iterative deepening over the 18 outer turns after each rotation word of at most two tokens (the 24 distinct
// rotations, shortest word first). Only scrambles where the optimum needs a rotation of two tokens are kept: no word of at
// most one token reaches a goal within the optimum, so a solver that tries only one-token rotations returns a longer route.
import { writeFileSync } from "node:fs";
import { loadApp, loadDesign, PRINTS } from "./lib.mjs";
const [out, perPrint = "6", maxD = "5"] = process.argv.slice(2);
const { model } = await loadApp();
const MOVES = [..."RLUDFB"].flatMap((f) => [f, f + "2", f + "'"]);
const RTOK = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
const fkey = (s) => `${s.p}|${s.n}|${s.up}`;
const frames = [], index = new Map();
const id = (s) => { const k = fkey(s); if (!index.has(k)) { index.set(k, frames.length); frames.push({ p: s.p, n: s.n, up: s.up }); } return index.get(k); };
const probe = (s) => ({ id: 0, cubie: 0, image: "", slot: 0, ...s });
for (const p of PRINTS) for (const s of loadDesign(model, p).printing) id(s);
for (let i = 0; i < frames.length; i++) for (const m of [...MOVES, ...RTOK]) id(model.apply([probe(frames[i])], m)[0]);
const tab = (t) => Int32Array.from(frames.map((f) => id(model.apply([probe(f)], t)[0])));
const table = MOVES.map(tab), rtab = RTOK.map(tab);
const face = (m) => "RLUDFB".indexOf(m[0]);
// the 24 rotations as words, found by breadth-first search over the app's tokens, signature = images of all frames
const sig = (ids) => ids.join(",");
const ident = Int32Array.from(frames.map((_, i) => i));
const seen = new Map([[sig(ident), ""]]);
const order = [{ w: "", t: ident }];
for (const { w, t } of order) for (let k = 0; k < RTOK.length; k++) {
  const nt = t.map((x) => rtab[k][x]);
  const s = sig(nt);
  if (seen.has(s)) continue;
  const word = w ? w + " " + RTOK[k] : RTOK[k];
  seen.set(s, word); order.push({ w: word, t: nt });
}
if (order.length !== 24) throw new Error("rotation group incomplete: " + order.length);
const ntok = (w) => (w ? w.split(" ").length : 0);
const frontCenter = (ids) => ids.findIndex((x) => { const f = frames[x]; return f.p[0] === 0 && f.p[1] === 0 && f.p[2] === 1 && f.n[2] === 1; });
function search(design, cells, state, maxd) {
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
      if (last >= 0 && last % 2 === 1 && f === last - 1) continue;
      path.push(MOVES[m]);
      if (dfs(ids.map((x) => table[m][x]), d - 1, f)) return true;
      path.pop();
    }
    return false;
  };
  // only rotations that bring a center with the required image to the front can reach a goal (outer turns never move
  // the front center); the check uses the sticker image of the app's printing, so it prunes without changing optima
  const cands = order.map(({ w, t }) => ({ w, ids: state.map((x) => t[x]) }))
    .filter(({ ids }) => design.printing[frontCenter(ids)].image === cells[4]);
  for (let d = 0; d <= maxd; d++) {
    const hits = [];
    for (const { w, ids } of cands) { path.length = 0; if (dfs(ids, d, -1)) hits.push({ w, word: [w, ...path].filter(Boolean).join(" ") }); }
    if (hits.length) return { opt: d, hits };
  }
  return null;
}
let seedv = 4242;
const rnd = () => { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const rows = ["# print\tcells\tscramble_word\tscramble_length\tbf_opt\tbf_word\tmin_rotation_tokens"];
for (const pid of PRINTS) {
  const design = loadDesign(model, pid);
  const ts = design.targets.filter((_, i) => i % 97 === 0 && design.targets.length);
  let kept = 0;
  while (kept < Number(perPrint)) {
    const t = pick(ts);
    if (!t.cells[4]) continue;
    const rot = pick(order.filter((o) => ntok(o.w) === 2)).w;
    const moves = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => pick(MOVES)).join(" ");
    const word = `${t.word} ${rot} ${moves}`;
    const pose = model.apply(design.printing, word);
    const r = search(design, t.cells, pose.map((s) => id(s)), Number(maxD));
    if (!r || r.opt === 0 || r.hits.some((h) => ntok(h.w) <= 1)) continue; // keep only cases where the optimum needs two rotation tokens
    const best = r.hits[0];
    rows.push([pid, t.cells.join("|"), word, moves.split(" ").length, r.opt, best.word, Math.min(...r.hits.map((h) => ntok(h.w)))].join("\t"));
    console.error(pid, kept, r.opt, best.word);
    kept++;
  }
}
writeFileSync(out, rows.join("\n") + "\n");
