import * as Search from "../res/FrontSearch.res.mjs";

export const FRONT_SOLVER_API_VERSION = 1;
export const DEFAULT_TABLE_MS = 3000;
export const DEFAULT_SEARCH_MS = 4000;
export const DEFAULT_MAX_NODES = 5_000_000;
export const DEFAULT_MAX_MOVES = 21;

// INTERNAL, for measurement and tests only; not part of the API (absent from index.d.ts), may change or vanish.
// true (default): a child is dropped as soon as one table reaches the depth left (same decisions and node counts, fewer
// table reads); false: all nine tables are read for every child, as the Rust engine does.
let lazyBound = true;
export function unstable_setLazyBound(on) {
  lazyBound = Boolean(on);
}

const bad = (reason) => Object.freeze({ version: 1, status: "invalid", reason });

/**
 * Synchronous front-goal search: nine front positions, each with the sticker identities it may show, any whole-cube
 * rotation, optionally the center upright. Builds the tables per call and returns a shortest route in half turns.
 */
export function solveFront3x3(request) {
  if (!request || typeof request !== "object") return bad("Expected a front request");
  const {
    facelets,
    centerTwists,
    accepted,
    centerUp = false,
    tableMs = DEFAULT_TABLE_MS,
    searchMs = DEFAULT_SEARCH_MS,
    maxNodes = DEFAULT_MAX_NODES,
    maxMoves = DEFAULT_MAX_MOVES,
    onProgress,
    cancel,
  } = request;
  if (typeof facelets !== "string" || !/^[URFDLB]{54}$/.test(facelets) || [..."URFDLB"].some((c) => facelets.split(c).length !== 10))
    return bad("facelets are not 54 letters of URFDLB");
  if (!Array.isArray(centerTwists) || centerTwists.length !== 6 || !centerTwists.every((t) => Number.isInteger(t) && t >= 0 && t <= 3))
    return bad("twists are not six numbers 0 to 3");
  if (!Array.isArray(accepted) || accepted.length !== 9) return bad("accepted needs nine lists");
  for (let i = 0; i < 9; i++) {
    const list = accepted[i];
    if (!Array.isArray(list) || list.length === 0 || !list.every((x) => Number.isInteger(x) && x >= 0))
      return bad(`position ${i} accepts no sticker`);
    const over = list.find((x) => x >= 54);
    if (over !== undefined) return bad(`position ${i}: sticker identity ${over} is not below 54`);
  }
  for (const [name, v] of [["tableMs", tableMs], ["searchMs", searchMs], ["maxNodes", maxNodes], ["maxMoves", maxMoves]])
    if (!Number.isInteger(v) || v < 0) return bad(`${name} is not a non-negative integer`);
  if (onProgress !== undefined && typeof onProgress !== "function") return bad("onProgress is not a function");
  if (cancel !== undefined && !(cancel instanceof Int32Array)) return bad("cancel is not an Int32Array");
  const out = Search.solve(
    facelets,
    [...centerTwists],
    accepted.map((l) => [...l]),
    Boolean(centerUp),
    tableMs,
    searchMs,
    maxNodes,
    Math.min(maxMoves, 255),
    lazyBound,
    ...observers(onProgress),
    cancel,
  );
  switch (out.TAG) {
    case "Found":
      return Object.freeze({ version: 1, status: "ok", moves: out.moves === "" ? [] : out.moves.split(" "), rotation: out.rotation, nodes: out.nodes, tablesMs: out.tablesMs });
    case "SearchBudget":
      return Object.freeze({ version: 1, status: "searchBudget", nodes: out.nodes });
    case "TableBudgetOut":
      return Object.freeze({ version: 1, status: "tableBudget", permille: out.permille });
    case "TableCancelledOut":
      return Object.freeze({ version: 1, status: "cancelled", stage: "tables", permille: out.permille });
    case "SearchCancelled":
      return Object.freeze({ version: 1, status: "cancelled", stage: "search", nodes: out.nodes });
    case "NoRoute":
      return Object.freeze({ version: 1, status: "noRoute", reason: out._0 });
    default:
      return Object.freeze({ version: 1, status: "invalid", reason: out._0 });
  }
}

// onProgress({stage: "tables", permille}) while the tables are built (strictly rising, ends with 1000) and
// onProgress({stage: "search", nodes, depth}) every 65,536 nodes; a return value of false cancels.
function observers(onProgress) {
  if (!onProgress) return [undefined, undefined];
  return [
    (permille) => onProgress({ stage: "tables", permille }) !== false,
    (nodes, depth) => onProgress({ stage: "search", nodes, depth }) !== false,
  ];
}

const U8 = (s) => (/^\+?\d+$/.test(s) && Number(s) <= 255 ? Number(s) : null);
const U64 = (s) => (/^\+?\d+$/.test(s) ? Number(s) : null);

/**
 * The text interface of the Cubacle WASM export (api.md of the spike, ABI 3): one TAB separated line in, [status, text] out.
 * Status 0 ok, 1 bad input, 2 no route, 3 search budget, 4 table budget or table build cancelled (permille=),
 * 5 search cancelled (nodes=; not in the Rust export). options: { onProgress, cancel } as in solveFront3x3.
 */
export function solveFrontText(input, options = {}) {
  const badText = (why) => [1, `1\t${why}`];
  const f = input.split("\t");
  if (f[0] !== "1") return badText(`unsupported version ${JSON.stringify(f[0])}, expected 1`);
  if (f.length !== 9) return badText("expected nine tab separated fields");
  if (!/^[URFDLB]{54}$/.test(f[1]) || [..."URFDLB"].some((c) => f[1].split(c).length !== 10)) return badText("facelets are not 54 letters of URFDLB");
  const tw = f[2].split(",").map(U8);
  if (tw.some((x) => x === null)) return badText("twists are not numbers");
  if (tw.length !== 6) return badText("twists are not six numbers");
  if (tw.some((x) => x > 3)) return badText("twists are not each 0 to 3");
  const groups = f[3].split(" ").map((g) => g.split(",").map(U8));
  if (groups.some((g) => g.some((x) => x === null))) return badText("accepted lists are not numbers");
  if (groups.length !== 9) return badText("accepted needs nine lists");
  if (f[4] !== "1" && f[4] !== "0") return badText("center_up is 0 or 1");
  for (let i = 0; i < 9; i++) {
    const over = groups[i].find((x) => x >= 54);
    if (over !== undefined) return badText(`position ${i}: sticker identity ${over} is not below 54`);
  }
  const nums = f.slice(5).map(U64);
  const names = ["table_ms", "search_ms", "max_nodes", "max_moves"];
  const k = nums.findIndex((x) => x === null);
  if (k >= 0) return badText(`${names[k]} is not a number`);
  const [tableMs, searchMs, maxNodes, maxMoves] = nums;
  const out = Search.solve(
    f[1],
    tw,
    groups,
    f[4] === "1",
    tableMs === 0 ? DEFAULT_TABLE_MS : tableMs,
    searchMs === 0 ? DEFAULT_SEARCH_MS : searchMs,
    maxNodes === 0 ? DEFAULT_MAX_NODES : maxNodes,
    maxMoves > 0 ? Math.min(maxMoves, 255) : DEFAULT_MAX_MOVES,
    lazyBound,
    ...observers(options.onProgress),
    options.cancel,
  );
  switch (out.TAG) {
    case "Found":
      return [0, `1\t${out.moves}\t${out.rotation}\t${out.nodes}\t${out.tablesMs.toFixed(3)}`];
    case "SearchBudget":
      return [3, `1\tnodes=${out.nodes}`];
    case "TableBudgetOut":
    case "TableCancelledOut":
      return [4, `1\tpermille=${out.permille}`];
    case "SearchCancelled":
      return [5, `1\tnodes=${out.nodes}`];
    case "NoRoute":
      return [2, `1\t${out._0}`];
    default:
      return badText(out._0);
  }
}
