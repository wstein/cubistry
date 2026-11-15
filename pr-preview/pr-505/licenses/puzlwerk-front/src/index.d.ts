export const FRONT_SOLVER_API_VERSION: 1;
export const DEFAULT_TABLE_MS: 3000;
export const DEFAULT_SEARCH_MS: 4000;
export const DEFAULT_MAX_NODES: 5000000;
export const DEFAULT_MAX_MOVES: 21;

export interface FrontRequest {
  /** 54 letters URFDLB, standard layout (U0-8 R9-17 F18-26 D27-35 L36-44 B45-53), centers home. */
  facelets: string;
  /** Twists of the six centers in U R F D L B order, 0..3; their sum has the parity of the corner permutation. */
  centerTwists: number[];
  /** Nine lists (front positions, row-major, facelets 18..26) of accepted home facelet numbers 0..53. */
  accepted: number[][];
  centerUp?: boolean;
  /** Table build budget in ms, 0 = none. */
  tableMs?: number;
  /** Search budget in ms, read every 65,536 nodes. */
  searchMs?: number;
  maxNodes?: number;
  maxMoves?: number;
  /** Progress: tables (permille, strictly rising, ends with 1000) and search (nodes, depth, every 65,536 nodes). Return false to cancel. */
  onProgress?: (e: { stage: "tables"; permille: number } | { stage: "search"; nodes: number; depth: number }) => boolean | void;
  /** A nonzero first element cancels; checked where the budgets are (tables: every 4096 steps, search: every 65,536 nodes). Use a SharedArrayBuffer view in a worker. */
  cancel?: Int32Array;
}

export type FrontResult =
  | { version: 1; status: "ok"; moves: string[]; rotation: string; nodes: number; tablesMs: number }
  | { version: 1; status: "searchBudget"; nodes: number }
  | { version: 1; status: "tableBudget"; permille: number }
  | { version: 1; status: "cancelled"; stage: "tables"; permille: number }
  | { version: 1; status: "cancelled"; stage: "search"; nodes: number }
  | { version: 1; status: "noRoute" | "invalid"; reason: string };

export function solveFront3x3(request: FrontRequest): FrontResult;
/** The text interface of the Cubacle WASM export: one TAB separated line in, [status, text] out. */
export function solveFrontText(input: string, options?: { onProgress?: FrontRequest["onProgress"]; cancel?: Int32Array }): [number, string];
