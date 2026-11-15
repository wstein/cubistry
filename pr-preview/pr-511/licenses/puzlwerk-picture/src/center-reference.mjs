import * as Executor from "../res/upstream/Move/MoveExecutor.res.mjs";
import * as Codec from "../res/upstream/State/FaceletCodec.res.mjs";
import * as Centers from "../res/upstream/Solver/PictureCenters.res.mjs";
import * as Parser from "../res/upstream/Move/MoveParser.res.mjs";
const faces = ["U", "L", "F", "R", "B", "D"],
  opposite = { U: "D", D: "U", L: "R", R: "L", F: "B", B: "F" };
const factors = [1, 4, 16, 64, 256, 1024];
const inverse = (word) =>
  word
    .split(" ")
    .reverse()
    .map((t) => (t.endsWith("2") ? t : t.endsWith("'") ? t[0] : t + "'"))
    .join(" ");
let cached;
function table() {
  if (cached) return cached;
  const solved = Codec.render(Executor.parseAndApply(3, "")._0),
    generators = new Map();
  const add = (word) => {
    const parsed = Parser.parse(3, word);
    if (
      parsed.TAG !== "Ok" ||
      Codec.render(
        Executor.applyAlg(Codec.parse(3, solved)._0, parsed._0)._0,
      ) !== solved
    )
      throw Error("Invalid center reference macro");
    const delta = Centers.apply([0, 0, 0, 0, 0, 0], parsed._0)._0,
      key = Centers.encode(delta),
      cost = word.split(" ").length;
    if (!generators.has(key) || generators.get(key).cost > cost)
      generators.set(key, { word, delta, cost });
  };
  for (const f of faces) {
    const r = faces.find((x) => x !== f && x !== opposite[f]);
    add(Array(5).fill(`${r} ${f} ${r}' ${f}`).join(" "));
    const substitution = { R: r, L: opposite[r], F: f, B: opposite[f] };
    const quarter = "R2 F' R2 L2 B L2 R2 F' R2 L2 B L2 R2 F' R2 L2 B L2"
      .split(" ")
      .map((t) => substitution[t[0]] + t.slice(1))
      .join(" ");
    add(quarter);
    add(inverse(quarter));
  }
  for (let a = 0; a < faces.length; a++)
    for (let b = a + 1; b < faces.length; b++)
      if (opposite[faces[a]] !== faces[b]) {
        const word = Array(105).fill(`${faces[a]} ${faces[b]}`).join(" ");
        add(word);
        add(inverse(word));
      }
  const edges = [...generators.values()],
    cost = new Float64Array(4096).fill(Infinity),
    previous = new Int16Array(4096).fill(-1),
    edgeIndex = new Int16Array(4096).fill(-1),
    visited = new Uint8Array(4096);
  cost[0] = 0;
  let reached = 0;
  for (;;) {
    let at = -1,
      best = Infinity;
    for (let i = 0; i < 4096; i++)
      if (!visited[i] && cost[i] < best) {
        at = i;
        best = cost[i];
      }
    if (at < 0) break;
    visited[at] = 1;
    reached++;
    edges.forEach((edge, index) => {
      let next = 0;
      for (let i = 0; i < 6; i++)
        next +=
          (((Math.floor(at / factors[i]) % 4) + edge.delta[i]) % 4) *
          factors[i];
      if (cost[next] > best + edge.cost) {
        cost[next] = best + edge.cost;
        previous[next] = at;
        edgeIndex[next] = index;
      }
    });
  }
  if (reached !== 2048)
    throw Error(
      "Center reference kernel must cover all 2048 even-parity tuples",
    );
  cached = {
    edges,
    cost,
    previous,
    edgeIndex,
    reached,
    maximumMoves: Math.max(...cost.filter(Number.isFinite)),
  };
  return cached;
}
/** A legal exact reference, not a shortest route; a checked fallback may traverse it. */
export function centerKernelReference(orientations) {
  if (
    !Array.isArray(orientations) ||
    !Centers.validOrientations(orientations) ||
    orientations.reduce((a, b) => a + b, 0) % 2
  )
    return Object.freeze({
      status: "invalid",
      reason: "Expected an even-parity physical center kernel tuple",
    });
  const data = table();
  let at = Centers.encode(orientations);
  const words = [];
  while (at !== 0) {
    words.push(data.edges[data.edgeIndex[at]].word);
    at = data.previous[at];
  }
  const moves = words.reverse().flatMap((w) => w.split(" "));
  return Object.freeze({
    status: "reference",
    moves: Object.freeze(moves),
    htm: moves.length,
    maximumReferenceMoves: data.maximumMoves,
  });
}
export function centerKernelReferenceStatistics() {
  const data = table();
  return Object.freeze({
    states: data.reached,
    maximumReferenceMoves: data.maximumMoves,
    generators: data.edges.map(({ word, delta, cost }) => ({
      word,
      delta: [...delta],
      htm: cost,
    })),
  });
}
